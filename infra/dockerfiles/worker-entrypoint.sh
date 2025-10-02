#!/bin/sh
set -e

if command -v freshclam >/dev/null 2>&1; then
  echo "[startup] Updating ClamAV signatures" >&2
  if ! freshclam --stdout; then
    echo "[startup] freshclam initial update failed" >&2
  fi
  (
    while true; do
      sleep 86400
      echo "[freshclam] Running scheduled signature refresh" >&2
      freshclam --stdout || echo "[freshclam] scheduled update failed" >&2
    done
  ) &
fi

exec "$@"
