# vault-env action

Resolve a `.env` file from a committed `.env.tpl` mapping by reading values from HashiCorp Vault (KV v2, userpass auth).

## Why

`hashicorp/vault-action` requires per-key listing in the workflow file. Adding/removing an env var = workflow PR. This action moves the mapping into a `.env.tpl` file living next to the consuming app, so adding a new var is a one-line change in the consumer repo.

## Inputs

| Name | Required | Default | Notes |
|---|---|---|---|
| `vault_url` | yes | — | Vault address |
| `auth_method` | no | `jwt` | `jwt` \| `userpass` \| `token` |
| `vault_role` | jwt | — | JWT role (used when `auth_method=jwt`) |
| `vault_audience` | no | `https://github.com/Dev-Better-Inc` | Audience for the GH OIDC token |
| `vault_username` | userpass | — | Used when `auth_method=userpass` |
| `vault_password` | userpass | — | Used when `auth_method=userpass` |
| `vault_token` | token | — | Used when `auth_method=token` |
| `template_file` | no | `.env.tpl` | Path to template, see format below |
| `output_file` | no | `.env` | Where to write the resolved file |

## Auth methods

- **`jwt` (default)** — exchanges the GitHub Actions OIDC token at `auth/jwt/login`. No long-lived secrets in GitHub. Requires `vault_role` and that Vault has the `jwt` auth method configured against GitHub's issuer.
- **`userpass`** — classic username/password against `auth/userpass/login/<username>`. Long-lived; rotate manually.
- **`token`** — supply an already-issued Vault token directly. Useful when another step/system has obtained one (or for local testing).

## Template format

```
# Comments and blank lines are ignored.
ENV_KEY=<mount>/<secret/path>/<vaultKey>
```

The reference is split as: first `/` separates the KV v2 mount, last `/` separates the key inside the secret, anything between is the secret path. Reads happen at `<mount>/data/<path>` and pull the named key out of the response.

## Example

`.env.staging.tpl`:
```
VITE_API_URL=projects/checkprod/staging/app/FRONT_URL
VITE_API_BASE=projects/checkprod/staging/app/API_URL
VITE_GTM=projects/checkprod/shared/web/GTM_ID
VITE_BUGSNAG_API_KEY=projects/checkprod/shared/web/BUGSNAG_API_KEY
```

Multiple lines pointing at the same secret share a single read (cached per run).

Workflow:
```yaml
- uses: Dev-Better-Inc/infrastructure/actions/vault-env@main
  with:
    vault_url: ${{ secrets.VAULT_URL }}
    vault_username: ${{ secrets.VAULT_USERNAME }}
    vault_password: ${{ secrets.VAULT_PASSWORD }}
    template_file: .env.staging.tpl
- run: npm run build   # Vite picks up .env automatically
```

## Build

```bash
cd actions/vault-env
npm install
npm run build   # produces dist/index.js (committed bundle)
```

The committed `dist/` is what GitHub Actions runs. CI should fail if `dist/` is out of date relative to `src/`.

## Behaviour notes

- All resolved values are passed to `core.setSecret()` so they are masked in logs.
- Multiple keys pointing at the same Vault path share a single read (cached in-memory per run).
- If a vault key is missing, the action emits a warning and writes an empty value rather than failing — change this if you want hard-fail.
