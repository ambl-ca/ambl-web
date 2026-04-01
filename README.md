# ambl-web

Astro 6 app deployed to **Cloudflare Workers** using `@astrojs/cloudflare`.

## Cloudflare setup

This project follows Astro's Cloudflare deployment guide:
https://docs.astro.build/en/guides/deploy/cloudflare/

- Runtime: Cloudflare Workers
- Adapter: `@astrojs/cloudflare`
- Output mode: `server`
- Wrangler config: `wrangler.toml`

## Local development

Install dependencies:

```bash
pnpm install
```

Run Astro dev server in Cloudflare-compatible runtime:

```bash
pnpm dev
```

Preview the built worker with Wrangler (guide-style flow):

```bash
pnpm dev:wrangler
```

## Secrets and env vars

Cloudflare secrets must not be committed.

1. Copy local secret template:

```bash
cp .dev.vars.example .dev.vars
```

2. Fill `.dev.vars` with real local values.

3. Set production secrets in Cloudflare:

```bash
pnpm secret:put RESEND_API_KEY
pnpm secret:put RESEND_FROM_EMAIL
pnpm secret:put RESEND_FROM_NAME
```

`LOG_LEVEL` is a non-secret env var configured in `wrangler.toml`.

## Build and deploy

Build worker artifacts:

```bash
pnpm build
```

Deploy to Cloudflare Workers:

```bash
pnpm deploy
```

## Scripts

- `pnpm dev` - `wrangler types` + `astro dev`
- `pnpm preview` - `wrangler types` + `astro preview`
- `pnpm dev:wrangler` - `astro build` + `wrangler dev`
- `pnpm build` - `wrangler types` + `astro build`
- `pnpm deploy` - `astro build` + `wrangler deploy`
