#!/bin/sh
set -eu
# Run from the project root. Keep HOSTINGER_Token in a server-local .env.
case "${1:-}" in
  issue)
    docker compose run --rm acme --issue --server letsencrypt --dns dns_hostinger \
      -d aibooking.store -d '*.aibooking.store' --keylength ec-256
    docker compose run --rm acme --install-cert -d aibooking.store --ecc \
      --key-file /certs/key.pem --fullchain-file /certs/fullchain.pem
    ;;
  renew)
    docker compose run --rm acme --cron
    docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile
    docker compose exec -T caddy caddy reload --force --config /etc/caddy/Caddyfile
    ;;
  *) echo 'Usage: sh deploy/certificates.sh issue|renew' >&2; exit 2 ;;
esac
