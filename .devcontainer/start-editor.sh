#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# A lock held for the lifetime of the editor prevents duplicate starts on resume.
# Authenticate the contributor on every start; never fall back to operator/demo.
state_dir="${TMPDIR:-/tmp}/bcb-editor-${CODESPACE_NAME:-local}"
mkdir -p "$state_dir"
nohup flock -n "$state_dir/server.lock" npm run dev:editor:contribute >>"$state_dir/server.log" 2>&1 </dev/null &
disown
echo "BCB Editor startet mit deiner bestätigten GitHub-Identität."
for attempt in {1..30}; do
  if curl --fail --silent --max-time 2 --output /dev/null http://127.0.0.1:4321/__editor/; then
    echo "BCB Editor bereit. Port 4321 privat öffnen, dann /__editor/ aufrufen."
    if [[ -n "${CODESPACE_NAME:-}" ]]; then
      echo "https://${CODESPACE_NAME}-4321.app.github.dev/__editor/"
    fi
    exit 0
  fi
  sleep 1
done
echo "BCB Editor nicht bereit. Startprotokoll: cat $state_dir/server.log" >&2
exit 1
