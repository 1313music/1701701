# Umami Netlify Deployment

This is for the standalone Umami service at `tongji.1701701.xyz`. Do not deploy the `1701701` Vite app as the Umami service; the main site only loads the tracker script.

## What Failed Last Time

- Umami is a Next.js server app with PostgreSQL, not a static site.
- `DATABASE_URL` must be available during the Netlify build because Umami creates or verifies database tables during `pnpm run build`.
- Runtime variables must also be available to Netlify Functions. Setting them only in `netlify.toml` is not enough for SSR/runtime code.
- The failed Netlify build used `pnpm run build-app`, which skips Prisma client generation. Use `pnpm run build`.

## Netlify Site Setup

Use the official Umami repository or your fork:

```text
https://github.com/umami-software/umami
```

The official repo already includes `netlify.toml` with `@netlify/plugin-nextjs`, so keep that file.

Recommended Netlify settings:

```text
Framework preset: Next.js
Build command: pnpm run build
Base directory: repository root
Node version: 22
```

If Netlify does not install pnpm automatically, change the build command to:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm run build
```

## Required Environment Variables

Set these in Netlify UI, not only in `netlify.toml`. Scope them for both Builds and Functions.

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require
APP_SECRET=<openssl rand -hex 32>
DISABLE_TELEMETRY=1
NODE_VERSION=22
```

Notes:

- `DATABASE_URL` is the only required Umami variable, but `APP_SECRET` should be explicitly set for login token security.
- This deployment currently serves the tracker at `https://tongji.1701701.xyz/script.js`. Use that in the main-site config unless a custom tracker path is verified with `curl -I`.
- Use PostgreSQL 12.14 or newer. Neon, Supabase, or another managed PostgreSQL database is fine.

## Domain Setup

1. In Netlify, add `tongji.1701701.xyz` to the Umami site as a custom domain.
2. In Cloudflare DNS for `1701701.xyz`, add:

```text
Type: CNAME
Name: tongji
Target: <your-netlify-site>.netlify.app
Proxy: DNS only
```

3. Wait for Netlify HTTPS provisioning to finish.
4. Verify:

```bash
curl -I https://tongji.1701701.xyz/
curl -I https://tongji.1701701.xyz/script.js
```

## Main Site Connection

After Umami is reachable:

1. Log in to Umami with `admin` / `umami`.
2. Change the default password immediately.
3. Add the website `1701701.xyz`.
4. Copy the website ID.
5. Update the static tracker tag in `index.html`:

```html
<script defer src="https://tongji.1701701.xyz/script.js" data-website-id="<website-id-from-umami>" data-host-url="https://tongji.1701701.xyz" data-domains="1701701.xyz"></script>
```

The main site does not read an R2 runtime analytics config. Changing the Umami service URL or website ID requires a main-site redeploy.
