## Environment Configuration

This service follows 12-factor configuration: all runtime configuration is provided via environment variables.
`.env` files are only loaded in development/test. Production must supply variables externally.

### Required In Production

- `AUTH_TOKEN_SECRET`
  - Minimum 32 characters.
  - Used to sign JWTs.
- Database configuration (choose one):
  - `DATABASE_URL` (preferred), or
  - `PGHOST` + `PGUSER` + `PGDATABASE` (+ `PGPASSWORD` if required)

### Recommended In Production

- `CORS_ORIGINS`
  - Comma-separated allowlist of frontend origins.
- `FIREBASE_CREDENTIALS_PATH` or `FIREBASE_CREDENTIALS_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
  - Enables Firebase Admin token verification.

### Server

- `PORT` (default: `3000`)
- `NODE_ENV` (default: `development`)
  - `development`, `test`, or `production`.
- `ENVIRONMENT`
  - Optional explicit environment label (e.g. `staging`).
- `STAGING`
  - Optional staging flag (`true` or `1`).
- `HOSTNAME`
  - Used for environment detection.

### Database

- `DATABASE_URL`
  - Full connection string. Overrides individual PG\* settings.
- `PGHOST` (default: `localhost`)
- `PGUSER`
- `PGDATABASE`
- `PGPASSWORD`
- `PGSSLMODE` (`require` or `disable`, default: `disable`)
- `PGSSL_REJECT_UNAUTHORIZED` (default: `true` in non-production, forced `true` in production)
- `PGPOOL_MAX` (default: `20`)
- `PGPOOL_MIN` (default: `5`)

### Auth

- `AUTH_TOKEN_SECRET` (required in production)
- `REQUIRE_AUTH`
  - In production, auth is always required regardless of this value.
- `AUTH_TOKEN_EXPIRY_MS` (default: `86400000` / 24h)

### Rate Limiting

- `RATE_LIMIT_MAX` (default: `1000`)
- `RATE_LIMIT_WINDOW_MS` (default: `900000` / 15 minutes)

### CORS

- `CORS_ENABLED` (default: `true`)
- `CORS_ORIGINS` (comma-separated list)

### Firebase

- `FIREBASE_CREDENTIALS_PATH`
- `FIREBASE_CREDENTIALS_JSON`
- `GOOGLE_APPLICATION_CREDENTIALS`

### Features

- `ENABLE_SWAGGER_UI`
  - Default: enabled in non-production.

### URLs (Open Graph / Link Preview)

- `PRODUCTION_API_URL`
- `STAGING_API_URL`
- `PRODUCTION_FRONTEND_URL`
- `PRODUCTION_FRONTEND_ALT_URL`
- `STAGING_FRONTEND_URL`
- `LINK_PREVIEW_API_URL`
- `SITE_NAME`
