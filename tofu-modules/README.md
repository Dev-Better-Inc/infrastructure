# tofu-modules

Reserved for shared OpenTofu modules. Empty for now.

Likely first candidates:
- `cloudfront-spa` — S3 (private, OAC) + CloudFront + ACM + Route53 alias for a static SPA (currently inlined in checkprod-react/infra).
- `github-oidc-deploy-role` — IAM role + scoped policy template for a GitHub Actions deploy role.
