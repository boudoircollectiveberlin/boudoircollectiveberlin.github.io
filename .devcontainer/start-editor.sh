#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# A lock held for the lifetime of the editor prevents duplicate starts on resume.
# Authenticate the contributor on every start; never fall back to operator/demo.
state_dir="${TMPDIR:-/tmp}/bcb-editor-${CODESPACE_NAME:-local}"
mkdir -p "$state_dir"
nohup flock -n "$state_dir/server.lock" npm run dev:editor:contribute >"$state_dir/server.log" 2>&1 </dev/null &
echo "BCB Editor startet mit deiner bestätigten GitHub-Identität."
echo "Port 4321 privat öffnen, dann /__editor/ aufrufen."
echo "Bei Startfehlern: cat $state_dir/server.log"
