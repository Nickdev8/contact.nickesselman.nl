# Full SEO and Security Audit

**Site:** https://contact.nickesselman.nl/  
**Audited:** 24 July 2026  
**Business type:** Personal contact utility  
**Scope:** Live site, source code, deployment configuration, public search results, responsive rendering, dependency audit

## Executive summary

**SEO health score: 65/100**

The page is a good contact utility with strong search-engine rendering and clear UX. It should remain concise. Its largest weaknesses are not a lack of marketing copy: they are transport security, application hardening, entity clarity, and incomplete search infrastructure.

| Category | Score | Summary |
|---|---:|---|
| Technical SEO | 67/100 | Strong SSR and fast responses; HTTP duplicate, headers, 404 metadata, sitemap and base-tag issues |
| Content quality | 81/100 | Clear and appropriately brief for a contact utility |
| On-page SEO | 70/100 | Correct branded intent; title/description/entity signals can be stronger |
| Structured data | 0/100 | No JSON-LD, Microdata or RDFa detected |
| Performance | 78/100* | Small and fast by inspection; no field CWV data available |
| AI-search readiness | 44/100 | Search crawlers can read the page, but entity and citation signals are weak |
| Images/social | 80/100 | No content-image problems; favicon and social preview image are missing |

\*Performance is a source/network heuristic, not a measured Lighthouse or CrUX score.

**Fit-for-purpose SXO score: 81/100.** The contact page serves known visitors and bug reporters very well. Identity-verifying visitors are the weakest audience because multiple people named Nick Esselman appear in search results.

## Highest-priority findings

### Critical

1. **HTTP does not redirect to HTTPS.** `http://contact.nickesselman.nl/` returns the complete form with `200 OK`. This exposes an insecure duplicate and permits information to travel over plaintext between the browser and Cloudflare’s edge.

### High

1. **No meaningful browser security headers.** HTTPS responses lack HSTS, CSP, `X-Content-Type-Options`, clickjacking protection, `Referrer-Policy`, and `Permissions-Policy`.
2. **Production dependency vulnerability.** `npm audit --omit=dev` reports one high-severity vulnerable direct dependency: Nodemailer 7.0.5. The installed address parser is especially relevant because visitor input reaches `Reply-To`.
3. **No rate limiting or backpressure is visible in application code.** Turnstile and the honeypot help, but concurrent multipart requests can still consume memory and hold workers through external verification and SMTP timeouts.
4. **Turnstile can fail open when configuration is incomplete.** Production verification runs only when both keys exist. The server also does not validate the returned hostname or `action`.
5. **404 pages inherit homepage SEO metadata.** A real missing URL correctly returns 404, but it also receives the homepage canonical and `index,follow`.
6. **The form collects personal data without a visible privacy/retention notice.** Names, email addresses, telephone numbers, social handles, messages, and image uploads may be processed by Cloudflare and Gmail.

### Medium

1. The live document contains unresolved `<base href="%sveltekit.base%">`.
2. There is no XML sitemap or sitemap declaration in `robots.txt`.
3. File validation trusts the browser-supplied MIME string instead of decoding the image.
4. There are no explicit server-side length limits for text/contact fields.
5. The Docker runtime uses EOL Node 20, runs as root, uses host networking, and has no healthcheck/resource limits/read-only filesystem.
6. Mobile controls are 42px high at the smallest breakpoint, below the recommended 48px touch target.
7. DM Sans is loaded through a render-blocking Google Fonts CSS import.
8. The page does not clearly connect itself to the established Person entity at `https://nickesselman.nl/#person`.

## Technical SEO

### Crawlability and rendering

- HTTPS homepage: `200 OK`.
- Important content, headings, metadata and form labels are server-rendered.
- Browser and Googlebot responses were identical at 5,667 bytes.
- JavaScript is required for Turnstile and conditional fields, not for discovering the page’s meaning.
- `robots.txt` permits normal search crawling.
- A genuine missing path returns 404 rather than a soft 404.
- No sitemap exists at `/sitemap.xml` or `/sitemap_index.xml`.

### Indexability and canonicalization

- Self-referencing HTTPS canonical is correct.
- Query-string variants retain the clean root canonical.
- `http://` serves a duplicate instead of redirecting.
- The page uses `index,follow`.
- No clear evidence that the contact subdomain currently surfaces for branded searches was found. Search Console data was unavailable.

### Metadata

- Title: `Contact Nick Esselman` (21 characters; exact branded intent but shorter than common title guidance).
- Meta description: `Standalone contact page for Nick Esselman with source-aware links for other sites.` (82 characters and implementation-focused).
- H1: `Get in touch.`; H2: `Send a message`.
- Duplicate identical `<title>` elements are emitted.
- Open Graph basics exist; `og:image` and Twitter card metadata are missing.
- `/favicon.ico` returns 404.

### Security headers and transport

- Valid Cloudflare-managed TLS certificate, TLS 1.3, HTTP/2, and HTTP/3 advertised.
- HTTP returns 200 rather than 301/308.
- No HSTS or CSP detected.
- TRACE and PUT are rejected with 405.
- Cross-origin POST is rejected with physical HTTP 403.
- A same-origin request with an invalid Turnstile token is rejected logically with `Captcha verification failed`.

## Content, intent and E-E-A-T

The page contains roughly 28 words of core prose. This is appropriate for its utility purpose; a conventional 500-word homepage floor should not be applied.

### Strengths

- The purpose is understandable immediately.
- Direct email is available as a fallback.
- Visitors can choose a reply channel or request no reply.
- Image limits are stated before upload.
- Copy is readable and avoids keyword stuffing.
- The primary portfolio links to the contact site.

### Weaknesses

- No visible role, location, portfolio backlink, or professional-profile link.
- Multiple unrelated people named Nick Esselman appear in public search results.
- No explanation of data use, retention, deletion, or prohibited sensitive information.
- The contact page does not reference the Person entity already defined on the main portfolio.

### E-E-A-T score: 64/100

| Factor | Score | Evidence |
|---|---:|---|
| Experience | 14/20 | Real functional contact utility, project and bug-report paths |
| Expertise | 16/25 | Identity is present but role/skills are not stated here |
| Authoritativeness | 13/25 | Main portfolio and LinkedIn exist; no explicit connection back |
| Trustworthiness | 21/30 | HTTPS canonical and clear contact route; privacy and transport gaps |

## Structured data

No structured data is present.

Recommended graph:

- `ContactPage` for the current URL.
- `WebSite` for the contact subdomain.
- Reuse the existing Person identifier: `https://nickesselman.nl/#person`.
- Link the page with `mainEntity`/`about`; link the site with `publisher`.

Do not add LocalBusiness, Organization, FAQPage or HowTo markup: those types are unsupported by the visible purpose and facts.

## Performance and Core Web Vitals

Measured network/source evidence:

- Median homepage TTFB across five checks: approximately 100ms.
- Initial HTML: approximately 5.7KB.
- First-party compressed JavaScript: approximately 25.3KB.
- Compressed CSS: approximately 2.1KB.
- Hashed assets use long immutable caching.
- Turnstile and Google Fonts are the primary third-party costs.
- Reserved Turnstile space reduces CLS risk.

No verified LCP, INP or CLS is reported. PageSpeed/CrUX credentials were unavailable, and the public PageSpeed request was quota-limited.

## Mobile and visual experience

Strengths:

- Clear first-screen hierarchy.
- No horizontal overflow in captured mobile, tablet, laptop and desktop layouts.
- Form labels are explicit and contrast is strong.
- Reduced-motion support exists.

Issues:

- The full form plus always-visible Turnstile naturally scrolls on phones.
- At 375×812, only about 11px of the 42px submit button is visible without scrolling; the document is only about 55px taller than the viewport.
- The smallest controls are 42px high.
- Small supporting copy reaches roughly 12px.
- Placeholder contrast measured about 2.41:1 and the “Optional” label about 2.20:1, below 4.5:1 for normal text.
- The disabled send button is visually muted while Turnstile waits, but the security-check status now explains why.

Screenshots are stored in `screenshots/`.

## AI-search/GEO

**GEO readiness: 44/100.**

- Googlebot, OAI-SearchBot, ChatGPT-User, PerplexityBot and Bingbot are allowed through wildcard rules.
- GPTBot, ClaudeBot, Google-Extended, CCBot and other training crawlers are explicitly blocked by Cloudflare-managed robots rules.
- The page is SSR and technically readable.
- Email protection obscures the email address for non-JavaScript crawlers.
- No `llms.txt`, RSL policy, JSON-LD, or substantial citable passage exists.

This is not a page that should be inflated for AI citations. Its GEO goal should be correct entity resolution and branded contact discovery.

## Search and entity observations

- The main portfolio and Netherlands LinkedIn profile appear for the correct Nick Esselman.
- Search results also contain a US executive with the same name.
- The main portfolio already defines `https://nickesselman.nl/#person` with role, country, skills and social profiles.
- The contact page should reuse that identifier instead of creating a competing Person entity.
- The portfolio and blog both link to the contact subdomain.
- No independent external backlink to the contact subdomain was confirmed in free sampled evidence, and exact public searches did not surface it.
- Backlink health is **insufficient data**: Common Crawl graph retrieval stalled and Moz/Bing data was unavailable, so no numeric backlink score is claimed.

## Security review

### Existing strengths

- Cross-origin POST protection is active.
- Turnstile invalid tokens are rejected.
- File count and byte limits exist.
- Filename and header text are normalized.
- Emails are sent as plain text.
- Recipient/from addresses are fixed server configuration.
- SMTP and Turnstile have bounded timeouts.
- `.env` is excluded from Git and Docker build context.
- Logs avoid raw message/contact contents.

### Material risks

- No HTTPS redirect/HSTS.
- No rate limit before parsing multipart bodies.
- Turnstile configuration can fail open.
- Untrusted MIME/type and unvalidated single-mailbox `Reply-To`.
- Vulnerable Nodemailer version.
- Root/EOL container with broad networking.
- No explicit text-field limits.
- No privacy and retention policy.
- No queue/idempotency; retry after an ambiguous SMTP timeout can duplicate mail.

## Limitations

- No Google Search Console, GA4, Bing Webmaster, CrUX, PageSpeed API, Moz, or DataForSEO credentials were available.
- No measured field CWV is claimed.
- Search-result observations are sampled, not exhaustive.
- Cloudflare WAF/rate-limit rules and server firewall policy were not available to the audit.
- The skill’s safe-fetch helper could not run because its public-URL validation helper was unavailable; direct read-only HTTPS retrieval was used.

## Primary sources

- [Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google AI features and crawler controls](https://developers.google.com/search/docs/appearance/ai-features)
- [Cloudflare Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Cloudflare Turnstile client rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)
- [Nodemailer advisory](https://github.com/advisories/GHSA-mm7p-fcc7-pg87)
- [Node.js releases](https://nodejs.org/en/about/previous-releases)
