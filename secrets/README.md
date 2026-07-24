# Runtime secrets

Create two extensionless files in this directory before running Docker:

- `smtp_password`
- `turnstile_secret`

Use one secret per file with no surrounding quotes. These files are ignored by Git and mounted
read-only at runtime.
