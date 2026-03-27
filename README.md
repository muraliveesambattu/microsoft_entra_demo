# Microsoft Entra ID Demo — Express Authentication

A Node.js / Express app demonstrating **dual authentication**: local email + password login **and** Microsoft Entra ID (Azure AD) login via OAuth 2.0 / OpenID Connect.

## Features

- Local registration & login with bcrypt-hashed passwords
- Microsoft Entra ID login using the Authorization Code Flow (`@azure/msal-node`)
- Session-based authentication with `express-session`
- Protected `/dashboard` route
- First-time Microsoft users automatically get a local user record
- Pre-seeded demo user for quick testing

## Project Structure

```
├── server.js                  # App entry point
├── config.js                  # MSAL configuration
├── routes/auth.js             # All authentication routes
├── middleware/authMiddleware.js# Route protection middleware
├── store/users.js             # In-memory user store
├── views/
│   ├── login.ejs              # Login page
│   ├── register.ejs           # Registration page
│   └── dashboard.ejs          # Protected dashboard
├── .env.example               # Environment variable template
└── package.json
```

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your Microsoft Entra credentials:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `CLIENT_ID` | Application (client) ID from Azure App Registration |
| `CLIENT_SECRET` | Client secret value |
| `TENANT_ID` | Directory (tenant) ID |
| `REDIRECT_URI_OIDC` | Must match the redirect URI in Azure (default: `http://localhost:3000/auth/microsoft/callback`) |
| `SESSION_SECRET` | Random string for signing session cookies |

### 3. Run the app

```bash
npm start
# or with auto-reload:
npm run dev
```

Visit **http://localhost:3000** in your browser.

### 4. Test local login

A demo account is seeded on startup:

| Field | Value |
|---|---|
| Email | `demo@example.com` |
| Password | `password123` |

## Setting Up Microsoft Entra ID

1. Go to the [Azure Portal](https://portal.azure.com) > **Microsoft Entra ID** > **App registrations** > **New registration**
2. Set the **Redirect URI** to `http://localhost:3000/auth/microsoft/callback` (Web platform)
3. Under **Certificates & secrets**, create a new **Client secret** and copy its value
4. Copy the **Application (client) ID** and **Directory (tenant) ID** from the Overview page
5. Paste all values into your `.env` file

## Routes

| Method | Path | Description |
|---|---|---|
| GET | `/login` | Login page |
| GET | `/register` | Registration page |
| POST | `/auth/local/login` | Handle email + password login |
| POST | `/auth/local/register` | Handle registration |
| GET | `/auth/microsoft` | Start Microsoft OAuth flow |
| GET | `/auth/microsoft/callback` | Handle Microsoft redirect |
| GET | `/dashboard` | Protected dashboard (requires auth) |
| GET | `/logout` | Destroy session and redirect |

## Tech Stack

- **Express** — Web framework
- **EJS** — Templating
- **@azure/msal-node** — Microsoft identity platform SDK
- **bcrypt** — Password hashing
- **express-session** — Session management
- **dotenv** — Environment variable loading
