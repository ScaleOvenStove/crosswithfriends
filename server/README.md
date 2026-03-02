## Server architecture

### Main website

- Prod: hosted on Render, host = crosswithfriends.com
- Dev: localhost:3020

### HTTP server

- Prod: Render Web Service at `downforacross-com.onrender.com`, proxied via same-origin `/api/*` rewrite
- Dev: `localhost:3021` when running `pnpm devbackend`

### WebSocket server (Socket.IO)

- Prod: connects directly to backend URL
- Dev: proxied through Vite dev server at localhost:3020
- Responsibilities: pub/sub for game events, cursor sync, pings

## Client config

- Production build has `SERVER_URL = ""` (same-origin, proxied through Render's rewrite rules)
  - Built via `pnpm build`
- Development build (`pnpm start`) proxies `/api/*` to the production backend
- Development with `VITE_USE_LOCAL_SERVER=1` has `SERVER_URL = "http://localhost:3021"`
  - This is `pnpm devfrontend`

### Database

All game events are stored in PostgreSQL. Key tables:

- `game_events` — move history (cell updates, checks, reveals)
- `game_snapshots` — solved grid state
- `games` — game metadata
- `puzzles` — puzzle data
- `users` — user accounts

Schema scripts are in `server/sql/`. Run `create_fresh_db.sql` to create all tables.

### Getting Started

If you aren't making changes to the backend, you don't need to run it locally. Just run `pnpm start` — it proxies API calls to the production backend.

#### Run your local db

1. Install postgres
   (mac) `brew install postgresql`
2. Run postgres
   (mac) `brew services start postgresql`

#### Initialize your local db:

1. Create the database

```
psql -c 'create database dfac'
```

(`createdb dfac` if this fails)

2. Create the tables

```
psql dfac < server/sql/create_fresh_db.sql
```

#### Run your local backend server

`pnpm devbackend`

This expects PostgreSQL connection variables. Copy `server/.env.example` to `server/.env.local` and fill in your credentials. The server loads this automatically via dotenv.

This will run a backend server on `localhost:3021`.

#### Run your local frontend server

`pnpm devfrontend`

This will run a frontend server on localhost:3020, that talks to your server on `localhost:3021`.

#### Test manually

1. Create a game by clicking a puzzle in the homepage `localhost:3020/`
2. You should start seeing a stream of events in your backend process's logs
3. You can also introspect the database manually (e.g. using psql or pgadmin)

---

## Authentication System

The app uses a custom JWT-based auth system with email/password signup and Google OAuth.

### Environment Variables

All auth-related env vars go in `server/.env.local` (for local dev) or the equivalent for deployed environments.

**Required for auth:**

| Variable             | Description                       | Example                  |
| -------------------- | --------------------------------- | ------------------------ |
| `JWT_SECRET`         | Secret for signing access tokens  | (random 64+ char string) |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | (random 64+ char string) |

**Required for Google OAuth:**

| Variable               | Description                                   | Example                                          |
| ---------------------- | --------------------------------------------- | ------------------------------------------------ |
| `GOOGLE_CLIENT_ID`     | OAuth 2.0 Client ID from Google Cloud Console | `123...apps.googleusercontent.com`               |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret                       | `GOCSPX-...`                                     |
| `GOOGLE_REDIRECT_URI`  | Authorized redirect URI                       | `http://localhost:3021/api/auth/google/callback` |

Each environment (local, testing, production) needs its own Google OAuth credentials. See the setup guide below.

**Required for email sending (SendGrid):**

| Variable           | Description                              | Example     |
| ------------------ | ---------------------------------------- | ----------- |
| `SENDGRID_API_KEY` | SendGrid API key for transactional email | `SG.xxx...` |

**Optional (have sensible defaults):**

| Variable    | Default                        | Description                  |
| ----------- | ------------------------------ | ---------------------------- |
| `APP_URL`   | `http://localhost:3020`        | Base URL for links in emails |
| `MAIL_FROM` | `noreply@crosswithfriends.com` | Sender address for emails    |

If `SENDGRID_API_KEY` is not set, emails are logged to the console instead of sent (useful for local development). See the setup guide below for using SendGrid in dev.

### Setting Up Google OAuth (Local Dev)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use an existing one)
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client ID**
5. Set Application type to **Web application**
6. Under **Authorized redirect URIs**, add: `http://localhost:3021/api/auth/google/callback`
7. Copy the **Client ID** and **Client Secret**
8. Add them to `server/.env.local`:

```
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3021/api/auth/google/callback
```

For testing/production environments, create separate OAuth credentials with the appropriate redirect URIs (e.g., `https://crosswithfriends.com/api/auth/google/callback`).

### Setting Up SendGrid (Local Dev)

For local development, SendGrid is **optional** — emails are logged to the console when `SENDGRID_API_KEY` is not set. If you want to test actual email delivery:

1. Create a free account at [sendgrid.com](https://sendgrid.com/)
2. Go to **Settings > API Keys** and create an API key with "Mail Send" permission
3. Go to **Settings > Sender Authentication** and verify a sender identity (either Single Sender or Domain Authentication)
4. Add the key to `server/.env.local`:

```
SENDGRID_API_KEY=SG.your-api-key-here
```

**Important:** The env file must be `server/.env.local` (not the root `.env.local`), because `pnpm devbackend` loads env from that path. Restart the backend after adding/changing env vars.

### Database Tables

Auth requires these tables (all created via `create_fresh_db.sql`):

- `users` — user accounts (email, password hash, Google OAuth, display name)
- `refresh_tokens` — JWT refresh token storage
- `user_identity_map` — maps legacy Firebase UIDs to new user UUIDs
- `email_verification_tokens` — tokens for email verification and email change confirmation
- `password_reset_tokens` — tokens for password reset flow

**For existing deployments**, run this migration to add email verification support:

```bash
psql $DATABASE_URL < sql/create_email_auth_tables.sql
```

### Auth Flows

- **Signup**: Creates account, sends verification email, user clicks link to verify
- **Login**: Email/password or Google OAuth returns JWT access token (15min) + refresh token (7d)
- **Email verification gate**: Unverified users are redirected to `/verify-email` and can only access account, profile, privacy, and terms pages
- **Google OAuth users**: Auto-verified (Google already confirmed email ownership)
- **Password reset**: Forgot password flow sends a reset link (1h expiry) to set a new password
- **Email change**: Enter new email + confirm password, verification sent to new address, click link to update
- **Token cleanup**: Expired verification and reset tokens are cleaned up hourly by the server
