# Pi deployment with wildcard TLS

The current Pi is deployed using its existing shared proxy; see [the actual deployment record](PI-DEPLOYMENT.md). This guide describes a new standalone installation, not the shared-proxy commands for the current server.

The Compose stack uses acme.sh's Hostinger DNS hook to issue a Let's Encrypt certificate covering both `aibooking.store` and `*.aibooking.store`. The DNS hook automatically adds/removes validation TXT records. Caddy loads this certificate. A daily systemd timer checks renewal and reloads Caddy after the certificate files are updated. Certificate and ACME account state persist in Docker volumes. No Docker socket is exposed to containers.

## Preflight and copy

On a network-enabled host, inspect `ssh pi` first: Docker/Compose availability, 64-bit ARM support, existing proxy/certificates, port 80/443 listeners and domain DNS. Reuse an existing proxy rather than displacing other applications. The commands below assume no conflicting stack and a dedicated `/opt/aibooking` directory owned by the deployment account.

Copy reviewed project files there using SSH/rsync. Exclude `.env`, `.git`, `node_modules`, and local secrets. Do not overwrite an existing deployment without preserving its configuration and rollback image.

## Hostinger key and DNS

Place `HOSTINGER_Token=...` in `/opt/aibooking/.env` using a secure editor on the Pi, then set mode 600. The key is passed only to the ACME container; acme.sh also persists it in the private ACME state volume for renewal. Treat that volume as a secret backup. Optionally set `RAILKIT_API_KEY` in the same file. Do not print `.env` or expanded Compose configuration.

Confirm Hostinger hosts authoritative DNS for the domain. `deploy/hostinger-dns.py` can plan/apply only the apex and wildcard A groups using the documented Hostinger API. It leaves unrelated records alone and refuses to proceed if potentially conflicting AAAA/CNAME records exist. Verify the server's actual public ingress IPv4; the SSH address alone is not proof of HTTP routing.

From the project root on the Pi, load the credential from the protected file only if it contains trusted shell assignment syntax:

```sh
set -a
. ./.env
set +a
python3 deploy/hostinger-dns.py --ipv4 VERIFIED_PUBLIC_IPV4
python3 deploy/hostinger-dns.py --ipv4 VERIFIED_PUBLIC_IPV4 --apply
unset HOSTINGER_Token RAILKIT_API_KEY
```

The first command prints the affected records and proposed change. Inspect them before the second command. Never replace the entire zone or delete mail records. Ensure any CAA policy permits Let's Encrypt and that ingress TCP 80/443 reaches the proxy. DNS-01 certificate issuance itself requires outbound HTTPS and DNS, not inbound validation ports.

## Issue, deploy and verify

```sh
cd /opt/aibooking
docker compose config --quiet
sh deploy/certificates.sh issue
docker compose up -d --build app caddy
docker compose ps
curl --fail https://aibooking.store/api/status
```

The proxy cannot start before initial certificate issuance/installation. Issuance failures must be resolved before launching Caddy. Do not repeatedly force issuance against production ACME rate limits.

Verify the served certificate SANs include the apex and wildcard, the issuer is Let's Encrypt, its validity dates are current, and the public app runs. Exercise train search, passenger entry, payment failure/retry and demo cancellation from a phone. Docker health reports only the app's status endpoint, not TLS or external reachability.

## Enable renewal

After successful deployment:

```sh
sudo cp deploy/aibooking-renew.service deploy/aibooking-renew.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now aibooking-renew.timer
sudo systemctl start aibooking-renew.service
sudo systemctl status aibooking-renew.service --no-pager
sudo systemctl list-timers aibooking-renew.timer
```

The units assume `/opt/aibooking`. Adjust both paths if using another directory. Monitor renewal failures through journald and verify certificate expiry independently. `renew` does not force early issuance; it runs acme.sh's due-date checks, then validates/reloads Caddy.

Sources:
- https://github.com/acmesh-official/acme.sh/blob/master/dnsapi/dns_hostinger.sh
- https://github.com/acmesh-official/acme.sh/wiki/Run-acme.sh-in-docker
- https://github.com/hostinger/api-python-sdk/blob/main/docs/DNSZoneApi.md
