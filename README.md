# infrastructure

Shared infra primitives used across Dev-Better-Inc projects.

## Layout

```
infrastructure/
├── actions/                  # composite + JS GitHub Actions
│   └── vault-env/            # resolve .env from .env.tpl via HashiCorp Vault
├── .github/
│   └── workflows/            # reusable workflows
│       └── deploy-cf-spa.yml # build + Vault env + S3 sync + CloudFront invalidation
└── tofu-modules/             # shared OpenTofu modules (placeholder for now)
```

## Using from a downstream repo

### Reusable workflow

```yaml
jobs:
  deploy:
    uses: Dev-Better-Inc/infrastructure/.github/workflows/deploy-cf-spa.yml@main
    with:
      environment: staging
      site_url: https://staging.example.com
      aws_role_arn: arn:aws:iam::123456789012:role/example-staging-deploy
      s3_bucket: staging.example.com
      cloudfront_distribution_id: E1ABCXYZ
    secrets:
      vault_url:      ${{ secrets.VAULT_URL }}
      vault_username: ${{ secrets.VAULT_USERNAME }}
      vault_password: ${{ secrets.VAULT_PASSWORD }}
```

The downstream repo must contain `.env.<environment>.tpl` files (e.g. `.env.staging.tpl`, `.env.production.tpl`) — see [`actions/vault-env/README.md`](actions/vault-env/README.md) for the format.

### Action only

```yaml
- uses: Dev-Better-Inc/infrastructure/actions/vault-env@main
  with:
    vault_url:      ${{ secrets.VAULT_URL }}
    vault_username: ${{ secrets.VAULT_USERNAME }}
    vault_password: ${{ secrets.VAULT_PASSWORD }}
    template_file:  .env.staging.tpl
```

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
