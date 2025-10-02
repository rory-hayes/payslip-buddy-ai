#!/usr/bin/env bash
set -euo pipefail

audit_file="AUDIT.md"
if [[ ! -f "$audit_file" ]]; then
  echo "check_audit_green: $audit_file not found" >&2
  exit 1
fi

if ! grep -q "Overall Status: Green" "$audit_file"; then
  echo "check_audit_green: AUDIT.md must record 'Overall Status: Green' before shipping." >&2
  exit 1
fi

echo "check_audit_green: AUDIT.md status confirmed as Green."
