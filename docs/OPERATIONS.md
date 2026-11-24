# Operations and troubleshooting

## Pi layout

| Resource | Location/name |
| --- | --- |
| Public app | `https://aibooking.store/` |
| SSH server | `ssh pi` |
| Configuration and certificate-maintenance source | `/home/pi/aibooking` |
| Active release source | `/home/pi/aibooking-current` symlink |
| Successful release identifier | `/home/pi/aibooking-current-revision` |
| Release archives extracted for deployment | `/home/pi/aibooking-releases/<commit SHA>` |
| Application container | `aibooking-app-1` |
| Compose project / file | `aibooking` / `compose.pi.yaml` |
| Application environment | `/home/pi/aibooking/.env` |
| Local app listener | `127.0.0.1:3090` |
| Application data volume | `aibooking_app_data` |
| Shared proxy | `caddy-mail` |
| Shared certificate volume | `infra_certbot_data` |
| Renewal timer | User unit `aibooking-renew.timer` |

The active-release layout was exercised directly over SSH. GitHub publishing and the first Actions run still require working authentication; see [CI/CD](../deploy/GITHUB-ACTIONS.md). Do not assume the repository exists merely because a local `origin` is configured.

The original source directory remains necessary for `.env` and certificate-renewal scripts. After release-based deployment, rebuilding from that directory can deploy older source. Inspect the recorded revision and active symlink first. Do not start the standalone `compose.yaml` on pi: its proxy ports conflict with the shared proxy.

## Routine checks

```sh
curl --fail --silent --show-error https://aibooking.store/api/status
ssh pi 'cat /home/pi/aibooking-current-revision; readlink -f /home/pi/aibooking-current'
ssh pi 'docker inspect --format "{{.State.Health.Status}}" aibooking-app-1'
ssh pi 'docker logs --tail 50 aibooking-app-1'
ssh pi 'systemctl --user status aibooking-renew.timer --no-pager'
```

A healthy status endpoint proves the app responds. `railkitConfigured` and `aiConfigured` only test whether credentials are present. To check RailKit, make one non-personal query such as `/api/railkit?type=train&value=12301`; that checks only that operation and those inputs. Do not use a PNR or a chat containing personal data for monitoring.

Review logs locally and redact identifiers before sharing. Avoid `docker inspect` without a narrow format and `docker compose config` in shared output: they can expose environment secrets. Public rail requests currently share the proxy's 20-request/minute bucket, so repeated smoke tests can affect users.

## “Information unavailable” and rail failures

1. Record the service, station codes/train number, journey/start date, class, quota, time and HTTP status. Do not record real PNR values or passenger responses in issues.
2. Check ISO date format and the service's date window. Tracking uses the date the train started, which can differ from the boarding date. A valid station code can identify a different station from the city the user intended.
3. Use the status table in [API reference](API.md). Missing credentials give `503`; recognized absent data gives `404`; app/provider limits give `429`; `502` includes generic provider errors, SDK exceptions and the 20-second deadline.
4. Check whether one operation fails while a basic train-detail query succeeds. A valid key for one operation does not establish availability or entitlement for another. Provider text is sanitized, so the generic message alone cannot establish the root cause.
5. For running status, users can explicitly try the alternative tracker in the rail menu with the same train start date. Both trackers use RailKit; this is not independent-provider failover. Timetables and route details describe schedules and must not be presented as live running or seat availability.
6. If the provider remains unavailable, offer the official IRCTC booking link already provided in the app, or request provider support with non-personal reproduction details. AIBooking cannot complete a transaction or guarantee inventory while upstream data is missing.

There is currently no bounded retry layer, rail-result cache or independent fallback API. Repeated clicking can consume quota and reach the app limit. Integrating another API requires a valid credential, verified field/date semantics and acceptable usage terms; a community MCP server alone does not establish those requirements. UI/filter improvements and independent-provider resilience remain open work, not features established by this documentation.

## AI errors

If the AI endpoint returns `503`, check whether the server has a Gemini credential. For `429`, distinguish the app's minute/hour/concurrency/daily limits from Gemini quota using the returned message. Restarting does not reset the persistent daily model budget; each primary/fallback attempt counts, even on failure. A budget date changes at IST midnight.

Transient model failures can use the configured fallback once. If models remain unavailable, users can continue with the direct service forms. A source label of RailKit indicates a deterministic explanation of retrieved rail data, not a successful Gemini generation. Do not raise quotas or change models without checking account access and expected cost.

## Restart and manual rebuild

To restart the existing container without changing its release:

```sh
ssh pi 'docker restart aibooking-app-1'
```

To rebuild the source selected by the successful-release symlink, preserving the established project, environment and volume:

```sh
ssh pi 'cd /home/pi/aibooking-current && docker compose --env-file /home/pi/aibooking/.env -p aibooking -f compose.pi.yaml up -d --build --no-deps --wait --wait-timeout 90 app'
```

This manual command does not provide the deployment script's automatic image rollback. Prefer the main-branch pipeline once configured. Never run `docker compose down -v` against production: it deletes persistent application volumes.

## Backup and recovery

SQLite uses WAL. Copying only `aibooking.sqlite` while writes continue is not a consistent backup strategy. The following creates a protected, consistent directory copy by briefly stopping the app; schedule the interruption and verify the restart:

```sh
ssh pi 'sh -s' <<'REMOTE'
set -eu
umask 077
backup_dir="/home/pi/aibooking-backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
docker stop aibooking-app-1
trap 'docker start aibooking-app-1 >/dev/null' EXIT HUP INT TERM
docker cp aibooking-app-1:/app/data/. "$backup_dir/"
printf 'Backup saved in %s\n' "$backup_dir"
REMOTE
curl --fail https://aibooking.store/api/status
```

Keep encrypted off-server backups and separately protect `.env`, certificate state and the shared proxy configuration. Business enquiries contain contact data; restrict backup access and apply a retention policy. Verify backup readability and a restore in an isolated environment before relying on it. No scheduled database backup or automatic retention policy is installed by this documentation.

Restore requires stopping the app, preserving a copy of current data, restoring the complete consistent SQLite directory into `aibooking_app_data`, matching the container user's ownership, then starting and verifying the app. Test the selected backup first and avoid restoring over a running writer. Application image rollback does not restore database content; there is no migration rollback mechanism.

## Release rollback

The deployment script retains the prior image ID before replacing the app and attempts to restore it if container startup/health or the local API check fails. It does not undo schema changes or roll back solely because GitHub's later public HTTPS check fails. Inspect failed deployment logs rather than assuming rollback succeeded.

After Actions is configured, re-run the successful run for the desired main-branch revision:

```sh
gh run list --repo Akt-AI/AIBooking --workflow ci-cd.yml
gh run rerun <successful-run-id> --repo Akt-AI/AIBooking
```

Replace the placeholder with an actual verified run ID. A re-run rebuilds the old source with the Dockerfile's current base tag resolution; it is not a byte-identical image restore. Releases and images are retained but not automatically pruned. Monitor disk use; do not remove the active release, configuration directory, current/prior rollback images, database volume or certificate volume.

## Wildcard TLS and DNS

Pi uses the existing Caddy proxy and Let's Encrypt apex/wildcard certificates. The protected server `.env` supplies `HOSTINGER_API_KEY` to certificate tooling, not the web application. Renewal uses DNS validation and its cleanup script preserves unrelated TXT records. Check the existing timer and certificate before changing DNS or requesting another certificate:

```sh
ssh pi 'systemctl --user list-timers aibooking-renew.timer --no-pager'
ssh pi 'journalctl --user -u aibooking-renew.service -n 40 --no-pager'
printf '' | openssl s_client -connect aibooking.store:443 -servername aibooking.store 2>/dev/null | openssl x509 -noout -dates -issuer
```

For an observed renewal failure, review the protected configuration, Hostinger key permissions and DNS challenge records, then use the established renewal service. Review logs for sensitive material before sharing. The script reloads Caddy after a changed certificate and retries a pending reload; see the [deployment record](../deploy/PI-DEPLOYMENT.md) for the shared certificate mount and service details. Do not replace or restart unrelated shared services as part of an app release.
