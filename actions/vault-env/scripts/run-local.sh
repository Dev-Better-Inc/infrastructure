#!/usr/bin/env bash
#
# Run the built action locally against a real Vault using a pre-supplied token.
#
# Prereqs:
#   - dist/index.js exists (run `pnpm install && pnpm build` first).
#   - VAULT_ADDR + VAULT_TOKEN are set in your shell (e.g. after `vault login`).
#
# Usage:
#   ./scripts/run-local.sh path/to/.env.staging.tpl [output.env]    # template mode
#   ./scripts/run-local.sh projects/checkprod/staging/app [output.env]  # vault_path mode
#
# An existing file path is treated as template mode; anything else is a vault_path.
#

set -e

ARG="${1:-}"
OUT="${2:-/tmp/vault-env-local.out}"

[ -n "$ARG" ]            || { echo "Usage: $0 <template-file|vault-path> [output-file]" >&2; exit 1; }
[ -n "${VAULT_ADDR:-}" ] || { echo "VAULT_ADDR is not set" >&2; exit 1; }
[ -n "${VAULT_TOKEN:-}" ] || { echo "VAULT_TOKEN is not set (run 'vault login' or 'export VAULT_TOKEN=...')" >&2; exit 1; }

cd "$(dirname "$0")/.."
[ -f dist/index.js ] || { echo "dist/index.js missing — run 'pnpm install && pnpm build' first" >&2; exit 1; }

if [ -f "$ARG" ]; then
  MODE="template"
  INPUT_TEMPLATE_FILE="$ARG"
  INPUT_VAULT_PATH=""
else
  MODE="vault_path"
  INPUT_TEMPLATE_FILE=""
  INPUT_VAULT_PATH="$ARG"
fi

echo "Running in $MODE mode → $OUT"

INPUT_VAULT_URL="$VAULT_ADDR" \
INPUT_AUTH_METHOD="token" \
INPUT_VAULT_TOKEN="$VAULT_TOKEN" \
INPUT_TEMPLATE_FILE="$INPUT_TEMPLATE_FILE" \
INPUT_VAULT_PATH="$INPUT_VAULT_PATH" \
INPUT_OUTPUT_FILE="$OUT" \
node dist/index.js 2>&1 | grep -v '^::add-mask::' || true

echo
echo "--- $OUT ---"
cat "$OUT"
