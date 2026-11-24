#!/bin/sh
set -eu
cd /home/pi/aibooking
COMPOSE='docker compose -p aibooking -f compose.pi.yaml'
# A failed reload remains pending across runs until successfully applied.
# This also retries a reload after a previous process was interrupted.
before=$(cat /home/pi/aibooking/.tls-loaded.sha256 2>/dev/null || true)
umask 077
log=$(mktemp)
trap 'rm -f "$log"' EXIT HUP INT TERM
status=0
$COMPOSE run --rm acme --cron > "$log" 2>&1 || status=$?
cat "$log"
python3 deploy/cleanup-acme.py "$log"
[ "$status" -eq 0 ] || exit "$status"
after=$(docker exec caddy-mail sha256sum /etc/letsencrypt/live/aibooking.store/fullchain.pem)
if [ "$before" != "$after" ]; then
    docker exec caddy-mail caddy validate --config /etc/caddy/Caddyfile
    docker exec caddy-mail caddy reload --force --config /etc/caddy/Caddyfile
    printf '%s\n' "$after" > /home/pi/aibooking/.tls-loaded.sha256
fi
