#!/usr/bin/env bash
set -e

#vault auth enable jwt

#vault write auth/jwt/config \
#  oidc_discovery_url="https://token.actions.githubusercontent.com" \
#  bound_issuer="https://token.actions.githubusercontent.com" \
#  default_role="dev-better-deploy"

#vault policy write checkprod-read - <<'EOF'
#path "projects/data/checkprod/*" {
#  capabilities = ["read"]
#}
#path "projects/metadata/checkprod/*" {
#  capabilities = ["read", "list"]
#}
#EOF

vault write auth/jwt/role/dev-better-deploy - <<'EOF'
{
  "role_type": "jwt",
  "user_claim": "actor",
  "bound_audiences": "https://github.com/Dev-Better-Inc",
  "bound_claims_type": "glob",
  "bound_claims": { "repository_owner": "Dev-Better-Inc" },
  "token_policies": "checkprod-read",
  "token_ttl": "15m",
  "token_max_ttl": "30m"
}
EOF
