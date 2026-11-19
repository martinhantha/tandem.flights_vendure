#!/usr/bin/env bash
# Build the tandem.flights Vendure images locally (Docker Desktop, linux/amd64) and load them onto the
# Coolify server via SSH – the shared server (avelom) has too little RAM to build Vendure itself.
# Usage: yarn tandem:image [--no-load]
set -euo pipefail
cd "$(dirname "$0")/.."

CTX=${DOCKER_BUILD_CONTEXT:-desktop-linux}
HOST=${TANDEM_DOCKER_HOST:-coolify.myflights.cloud}
TAG=$(git rev-parse --short HEAD)$(git diff --quiet || echo "-dirty")

echo "→ building tandem-vendure-server-base:$TAG (context $CTX)"
docker --context "$CTX" buildx build --builder "$CTX" --platform linux/amd64 -f Dockerfile \
  -t "tandem-vendure-server-base:$TAG" -t tandem-vendure-server-base:latest --load .
echo "→ building tandem-vendure-backup:latest"
docker --context "$CTX" buildx build --builder "$CTX" --platform linux/amd64 -f cron.Dockerfile \
  -t tandem-vendure-backup:latest --load .

# safety: no env files with secrets inside the image
if docker --context "$CTX" run --rm --platform linux/amd64 --entrypoint sh tandem-vendure-server-base:latest -c 'ls -a /usr/src/app | grep -qx ".env"'; then
  echo "✗ .env found inside the image – aborting"; exit 1
fi

[ "${1:-}" = "--no-load" ] && exit 0
echo "→ loading images on $HOST"
docker --context "$CTX" save "tandem-vendure-server-base:$TAG" tandem-vendure-server-base:latest tandem-vendure-backup:latest \
  | gzip -1 | ssh "$HOST" 'gunzip | docker load'
echo "✅ images loaded on $HOST – redeploy the Coolify resource"
