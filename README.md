# gomtmui

`gomtmui` is a public CI/CD demo repository for the future gomtmui migration.

## Scope

- Minimal `Next.js + OpenNext + Wrangler` project
- Single `Hello World` page
- Separate CI and deploy workflows for a public GitHub repository
- Automatic deployment to Cloudflare Workers via GitHub Actions

## Local Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run lint
npm run build
```

## Deployment

Deployments run from `.github/workflows/deploy.yml` on every push to `main` and on manual dispatch.

Required GitHub Secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The deploy workflow reads Cloudflare credentials from GitHub Secrets only. No secrets should be committed to this repository.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
