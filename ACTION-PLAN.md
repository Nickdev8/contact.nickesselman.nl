# Security and Discoverability Action Plan

## Goal

Keep the contact page as visually simple as it is now while making it:

1. safe to submit personal information and images;
2. resilient against spam and resource exhaustion;
3. unambiguous as Nick Esselman’s official contact page;
4. easy for branded search engines to discover;
5. measurable without invasive tracking.

## Phase 0 — Immediate protection

### 1. Force HTTPS

- Enable Cloudflare **Always Use HTTPS**, or return a Caddy `308` from HTTP to the identical HTTPS URL.
- Confirm every required subdomain supports HTTPS.
- Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- Consider `preload` only after every subdomain is verified and the long-term commitment is understood.

**Acceptance:** HTTP requests never return form HTML; they redirect once to HTTPS.

### 2. Patch the mail dependency and validate one mailbox

- Upgrade Nodemailer from 7.0.5 to a currently patched release; the audit currently identifies 7.0.13 as the non-major remediation target.
- Run `npm audit --omit=dev` after updating.
- Enforce a maximum 254-character email and validate exactly one mailbox.
- Do not pass a user-controlled display-name/address string directly to Nodemailer’s parser.
- Set `requireTLS: true` and TLS minimum version 1.2.

**Acceptance:** production audit has no known high/critical issue; comma/bracket/CRLF address tests are rejected.

### 3. Make Turnstile fail closed

- Treat missing or mismatched production keys as an unhealthy deployment.
- Refuse submissions when verification cannot be configured.
- Validate Siteverify `hostname === "contact.nickesselman.nl"`.
- Validate Siteverify `action === "contact"`.
- Configure the trusted proxy chain so the real visitor IP—not the local proxy—is used.
- Keep the current token reset/remove lifecycle.

**Acceptance:** missing key, invalid token, wrong hostname, wrong action, expired token and replayed token all fail without email delivery.

### 4. Add rate limits and backpressure

At Cloudflare, before the request body reaches the origin:

- Rate-limit `POST /` by IP, initially around 5 attempts per 10 minutes with managed challenge/block.
- Add a broader global rule for sudden submission spikes.
- Keep verified search crawlers exempt only from GET rules, never form POST.

At the app:

- Limit concurrent form parsing and SMTP sends.
- Add a short per-IP/token cooldown.
- Return 429 with `Retry-After`.
- Reject oversized requests at the reverse proxy before Node parses them.

**Acceptance:** a load test cannot create unbounded memory, Turnstile, or SMTP work.

### 5. Add browser security headers

Start with:

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin
```

Use a tested CSP that permits the exact Turnstile endpoints:

```text
default-src 'self';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
object-src 'none';
script-src 'self' https://challenges.cloudflare.com;
frame-src https://challenges.cloudflare.com;
connect-src 'self' https://challenges.cloudflare.com;
style-src 'self';
font-src 'self';
img-src 'self' data:;
```

Self-host DM Sans before enforcing the CSP, or temporarily add the required Google Fonts origins.

**Acceptance:** CSP runs in report-only mode without required-resource violations, then moves to enforcement.

## Phase 1 — Input, privacy and SEO foundation

### 1. Bound every field

Suggested server-side maximums:

| Field | Maximum |
|---|---:|
| Name | 100 characters |
| Email | 254 characters |
| Phone/contact detail | 100 characters |
| Instagram handle | 30 characters after `@` |
| Message | 5,000 characters |
| Source | Existing 120-character limit |

- Normalize Unicode and remove control characters.
- Validate email, phone and Instagram according to the selected reply method.
- Require the name server-side or deliberately label anonymous submission as supported.

### 2. Treat uploads as hostile

- Verify signatures/magic bytes.
- Decode and re-encode accepted images into a safe server-generated format/name.
- Set maximum width, height, pixel count, animation frames and decoded memory.
- Strip metadata, including EXIF location.
- Reject SVG and ambiguous/polyglot files.
- Consider antivirus scanning or quarantine before attachments reach the mailbox.

### 3. Add concise privacy guidance

Place directly below the submit area:

> Your details and attachments are used only to respond to this message. Do not send passwords, API keys, identity documents, or other secrets.

Link to a short policy stating:

- controller/contact identity;
- purpose and lawful basis;
- Cloudflare/Gmail processing;
- retention period;
- attachment handling;
- deletion/access request process;
- whether analytics are used.

### 4. Fix metadata and error pages

- Remove the unresolved `%sveltekit.base%` tag.
- Keep exactly one title.
- Move homepage canonical, robots and social metadata into the homepage route.
- Add a custom error page with `noindex,follow`, its own title, and no homepage canonical.
- Add a favicon.

Recommended title:

> Contact Nick Esselman | Projects, Questions & Support

Recommended description:

> Contact Nick Esselman about a website project, technical question, or bug report. Choose how you want a reply, attach images, or email Nick directly.

### 5. Strengthen entity clarity without adding filler

- Change or semantically supplement the H1 so “Contact Nick Esselman” appears visibly.
- Add one sentence:

> This is the official contact page for Nick Esselman, a Netherlands-based full-stack developer and maker.

- Link “Nick Esselman” to `https://nickesselman.nl/`.
- Add the exact LinkedIn profile where appropriate.
- Keep the rest of the page concise.

### 6. Add truthful structured data

Render JSON-LD in initial HTML:

- `ContactPage` for `https://contact.nickesselman.nl/#webpage`.
- `WebSite` for `https://contact.nickesselman.nl/#website`.
- Reference, do not duplicate, `https://nickesselman.nl/#person`.
- Use `about` and `mainEntity` to connect the ContactPage.
- Do not add FAQPage, HowTo, LocalBusiness or Organization.

### 7. Add a one-URL sitemap

Serve `/sitemap.xml` containing only:

```xml
<url>
  <loc>https://contact.nickesselman.nl/</loc>
</url>
```

Add:

```text
Sitemap: https://contact.nickesselman.nl/sitemap.xml
```

to robots policy if Cloudflare’s managed robots system permits an appended custom directive.

## Phase 2 — Runtime and UX hardening

### 1. Modernize the container

- Move from EOL Node 20 to supported Node 24 LTS.
- Pin the base image by digest and automate rebuilds.
- Run as an unprivileged user.
- Replace host networking with a private bridge and bind the origin only where Caddy can reach it.
- Add a health/readiness endpoint and Docker healthcheck.
- Add memory, CPU and PID limits.
- Use a read-only root filesystem, writable `tmpfs`, and drop Linux capabilities.
- Restrict direct origin access so Cloudflare cannot be bypassed.

### 2. Make delivery durable

- Put accepted submissions into a small persistent queue.
- Assign a submission ID and deduplicate retries.
- Separate “accepted” from “delivered” status.
- Alert on queue age, SMTP failures and repeated Turnstile errors.
- Do not include personal message content in operational logs.

### 3. Protect secrets

- Change `.env` permissions to `0600`.
- Prefer Docker/systemd secrets over broad environment exposure.
- Use a least-privileged mail credential.
- Rotate Turnstile and mail credentials periodically and after suspected exposure.

### 4. Refine mobile behavior

- Restore 48px minimum input/button heights.
- Keep supporting text at least 13–14px.
- Replace the faint text token on placeholders and “Optional” with a color meeting at least 4.5:1 contrast.
- Add padding to the mobile wordmark so its touch target reaches 48px.
- Accept that the full form plus Turnstile needs a short mobile scroll; do not hide or shrink the security control to force a no-scroll target.
- Self-host DM Sans to remove third-party font requests and simplify CSP.

## Phase 3 — Findability and monitoring

### 1. Search setup

- Verify both `nickesselman.nl` and `contact.nickesselman.nl` in Google Search Console.
- Submit the sitemap and request initial indexing.
- Add Bing Webmaster Tools and submit the same sitemap.
- Monitor branded queries: `Nick Esselman`, `contact Nick Esselman`, and role/location variants.
- Confirm the correct Netherlands-based entity outranks same-name ambiguity.

### 2. Privacy-respecting measurement

Track only what is needed:

- landing source/referrer category;
- form started;
- Turnstile completed/failed;
- submission accepted/failed;
- no message content, email, telephone number, handle or filename.

Cloudflare Web Analytics or a self-hosted privacy-first tool is preferable to invasive cross-site tracking.

### 3. Entity consistency

- Keep the main site, contact page, LinkedIn, GitHub and blog names/role/location consistent.
- Keep `https://nickesselman.nl/#person` as the canonical Person identifier.
- Link the contact page back to the primary portfolio.
- Keep the main portfolio’s contact link prominent.

### 4. Ongoing security

- Enable Dependabot or Renovate.
- Run production dependency and container scans on every merge.
- Add regression tests for CSRF, Turnstile hostname/action/replay, rate limits, field bounds, upload magic bytes, image bombs and SMTP address parsing.
- Define log retention and alert thresholds.
- Capture an SEO drift baseline after the fixes.

## Crawler and AI policy

Current Cloudflare rules allow ordinary search, OAI-SearchBot, ChatGPT-User, PerplexityBot and Bingbot while blocking several training crawlers.

Recommended policy:

- Continue allowing Googlebot and Bingbot.
- Continue blocking CCBot, Bytespider and training crawlers if training opt-out is desired.
- Explicitly allow OAI-SearchBot and ChatGPT-User for live search discovery.
- Decide whether Claude search visibility is worth allowing the relevant Anthropic crawler.
- Do not prioritize `llms.txt` over sitemap, schema, entity links or Search Console.

## Success metrics

| Metric | Target |
|---|---|
| HTTP plaintext responses | 0; one redirect to HTTPS |
| High/critical production dependency findings | 0 |
| Invalid/missing/replayed Turnstile email deliveries | 0 |
| Security headers | CSP enforced, HSTS, nosniff, referrer and permissions policies present |
| 5xx submission rate | <1%, excluding deliberate abuse |
| Rate-limit behavior | Predictable 429 before body/SMTP work |
| Indexed canonical URLs | Exactly 1 |
| Branded contact query | Correct official page/entity discoverable |
| Mobile horizontal overflow | 0 |
| CWV | LCP <2.5s, INP <200ms, CLS <0.1 at p75 once field data exists |

## Recommended implementation order

1. HTTPS redirect and HSTS.
2. Nodemailer update and strict mailbox parsing.
3. Rate limiting and Turnstile fail-closed validation.
4. CSP/security headers.
5. Field and upload validation.
6. Privacy notice.
7. Metadata/error/base fixes.
8. Person/ContactPage schema and sitemap.
9. Container/runtime hardening.
10. GSC/Bing/monitoring and regression automation.
