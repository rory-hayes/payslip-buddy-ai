#!/usr/bin/env bash
set -euo pipefail

PATTERN='(https://[a-z0-9-]{12,}\.supabase\.co|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9)'

violations=()
while IFS= read -r file; do
  if grep -nE "$PATTERN" "$file" >/tmp/grep_out.$$; then
    while IFS= read -r line; do
      violations+=("$file:$line")
    done < /tmp/grep_out.$$
  fi
done < <(git ls-files | grep -Ev '(^scripts/ci/check_supabase_keys\.sh$|node_modules/|\.env|\.cache)')
rm -f /tmp/grep_out.$$ || true

if ((${#violations[@]})); then
  printf 'Supabase secret guard failed. Remove hard-coded URLs or keys:\n' >&2
  printf '  %s\n' "${violations[@]}" >&2
  exit 1
fi

echo "Supabase secret guard passed."
