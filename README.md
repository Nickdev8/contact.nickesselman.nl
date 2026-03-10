# contact.nickesselman.nl

Standalone contact form for `contact.nickesselman.nl`.

## Local development

```bash
npm install
npm run dev
```

## Mail setup

This app already reads its mail configuration from a local `.env` file through SvelteKit.

Use this:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=nick.esselman@gmail.com
SMTP_PASSWORD=your-gmail-app-password

EMAIL_FROM=Nick Contact <nick.esselman@gmail.com>
EMAIL_TO=info@nickesselman.nl
BODY_SIZE_LIMIT=12M
```

Notes:

- `SMTP_PASSWORD` should be a Gmail App Password, not the normal Gmail login password.
- `EMAIL_FROM` should usually match the Gmail account you authenticate with, unless that Gmail account is configured to send as another verified address.
- If you want to send from `info@nickesselman.nl`, add that address as a verified Gmail alias first and then change `EMAIL_FROM`.
- `BODY_SIZE_LIMIT` is required for image uploads in production because the SvelteKit Node server defaults to `512K`, which is lower than the form's 9.5 MB total attachment budget.

## Start

```bash
npm run dev
```

Then submit the form once to confirm delivery.

## Docker

The Docker setup now runs this app on port `3021`.

```bash
docker compose up --build
```

Then open `http://localhost:3021`.
