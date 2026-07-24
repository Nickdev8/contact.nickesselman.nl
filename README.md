# contact.nickesselman.nl

Small SvelteKit contact form for Nick Esselman. Submissions are validated, checked by Cloudflare
Turnstile, and delivered directly to one configured mailbox. The application does not keep a
database, upload files, or queue messages.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Development uses Cloudflare's official test widget keys. SMTP settings are still required to test
successful delivery.

## Configuration

Non-secret settings live in `.env`:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=nick.esselman@gmail.com
EMAIL_FROM=Nick Contact <nick.esselman@gmail.com>
EMAIL_TO=info@nickesselman.nl
PUBLIC_TURNSTILE_SITE_KEY=your-site-key
```

Production secrets live in extensionless files:

```text
secrets/smtp_password
secrets/turnstile_secret
```

The SMTP password must be a Gmail App Password rather than the Gmail account password. Never commit
either secret file. Production refuses to start when mail, Turnstile, the canonical origin, or the
trusted Cloudflare address header is missing.

## Verification

```bash
npm run check
npm test
npm run build
npm audit --omit=dev
docker compose config
docker compose build
```

Test SMTP authentication without sending:

```bash
npm run test:mail
```

Send one clearly labelled smoke-test email:

```bash
npm run test:mail -- --send
```

## Production

The container:

- Runs as an unprivileged Node 24 user.
- Binds only to host loopback on port `3021`.
- Uses a read-only filesystem, dropped capabilities, resource limits, and a health check.
- Accepts at most `32K` request bodies.
- Receives the visitor address only from `CF-Connecting-IP`.

Start it with:

```bash
docker compose up --build -d
docker compose ps
```

Create a named Cloudflare Tunnel and copy
[`deploy/cloudflared-config.yml.example`](deploy/cloudflared-config.yml.example) to
`/etc/cloudflared/config.yml`, replacing the tunnel ID. Route `contact.nickesselman.nl` to the
tunnel, enable the Cloudflare edge HTTPS redirect, and set an edge rate limit of five `POST /`
requests per IP per ten minutes.

Only remove the old Caddy `contact.nickesselman.nl` route after the tunnel responds successfully.
The tunnel ingress has a mandatory catch-all `404`, so no other local service is exposed.

## Search contract

- Canonical URL: `https://contact.nickesselman.nl/`
- Portfolio referral: `https://contact.nickesselman.nl/?from=portfolio`
- Blog referral: `https://contact.nickesselman.nl/?from=blog`
- Sitemap: `https://contact.nickesselman.nl/sitemap.xml`
- Shared Person ID: `https://nickesselman.nl/#person`

Submit the sitemap through the `nickesselman.nl` Google Search Console domain property and Bing
Webmaster Tools. Cloudflare's robots controls should permit search and AI-search crawlers while
keeping AI-training opt-out enabled.
