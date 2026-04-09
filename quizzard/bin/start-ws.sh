#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Bulletproof entrypoint for the standalone Socket.IO presence + cowork
# server (ws-server.ts).
#
# Why this exists: DigitalOcean App Platform's "run command" field
# auto-wraps Node service commands in `npm`, which turns `tsx ws-server.ts`
# into `npm tsx ws-server.ts` and fails with "Unknown command: tsx".
# Wrapping the invocation in a bash script bypasses that auto-wrap
# entirely — App Platform just runs `bash bin/start-ws.sh` literally.
#
# The script works in any environment that has Node + the npm install
# already done. It calls tsx via its node_modules/.bin path so we don't
# depend on PATH ordering or `npx`.
#
# AP run command: bash bin/start-ws.sh
# Local equivalent: cd quizzard && bash bin/start-ws.sh
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

# Resolve to the project root regardless of where the script is invoked from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

if [ ! -f "ws-server.ts" ]; then
  echo "[start-ws] ERROR: ws-server.ts not found in ${PROJECT_ROOT}" >&2
  exit 1
fi

if [ ! -x "node_modules/.bin/tsx" ]; then
  echo "[start-ws] ERROR: node_modules/.bin/tsx is missing." >&2
  echo "[start-ws] Did 'npm ci' run during the build step?" >&2
  echo "[start-ws] If tsx is in devDependencies, set NODE_ENV before install" >&2
  echo "[start-ws] or move it to dependencies in package.json." >&2
  exit 1
fi

echo "[start-ws] booting ws-server.ts via $(pwd)/node_modules/.bin/tsx"
exec node_modules/.bin/tsx ws-server.ts
