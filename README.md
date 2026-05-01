# infrastructure

Shared infra primitives used across Dev-Better-Inc projects.

## Layout

```
infrastructure/
├── actions/                  # GitHub Actions
│   └── vault-env/            # resolve .env from .env.tpl or vault path via HashiCorp Vault
├── vault/                    # Vault bootstrap
│   └── setup.sh
└── tofu-modules/             # shared OpenTofu modules (placeholder)
```

## Using the vault-env action

```yaml
- uses: Dev-Better-Inc/infrastructure/actions/vault-env@main
  with:
    vault_url: https://vault.example.com
    vault_role: dev-better-deploy   # OIDC/JWT (default auth_method)
    template_file: .env.staging.tpl
```

See [`actions/vault-env/README.md`](actions/vault-env/README.md) for full input docs and the template format.

## Versioning

Until `v1` is tagged, downstream repos pin to `@main`. Once stable:

```bash
git tag -a v0.1.0 -m "initial release"
git tag -f v1   # floating major
git push --tags --force
```

Downstream then pins to `@v1`.

## Building the action

```bash
cd actions/vault-env
npm install
npm run build    # ncc → dist/index.js (committed)
```

CI on this repo should re-run the build and fail if `dist/` differs from the committed bundle.
