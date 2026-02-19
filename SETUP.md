# CodeGuard Pro - Setup Guide

This guide explains how to set up CodeGuard Pro on a new system.

---

## Prerequisites

1. **Node.js** v18+ (recommend v20 LTS)
   - Download: https://nodejs.org/

2. **PostgreSQL Database** (choose one):
   - **Supabase** (free, recommended): https://supabase.com/
   - **Local PostgreSQL**: https://www.postgresql.org/download/
   - **Neon**: https://neon.tech/

3. **GitHub Account** with access to create GitHub Apps

---

## Step 1: Extract and Install Dependencies

```bash
# Extract the zip file
# Navigate to the project folder

# Install web dependencies
cd web
npm install

# Install worker dependencies (optional - needs Redis 5.0+)
cd ../worker
npm install

# Go back to web
cd ../web
```

---

## Step 2: Set Up Database

### Option A: Supabase (Recommended)
1. Go to https://supabase.com/ and create account
2. Create a new project
3. Go to **Settings → Database → Connection string**
4. Copy the **Session Pooler** connection string (URI format)
5. It looks like: `postgresql://postgres.[project-id]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`

### Option B: Local PostgreSQL
```bash
# Create a database
createdb codeguard

# Connection string:
# postgresql://username:password@localhost:5432/codeguard
```

---

## Step 3: Create GitHub OAuth App (for login)

1. Go to: https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name**: `CodeGuard Pro (Dev)`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** and copy it

---

## Step 4: Create GitHub App (for webhooks)

1. Go to: https://github.com/settings/apps
2. Click **"New GitHub App"**
3. Fill in:
   - **GitHub App name**: `codeguard-yourname` (must be unique)
   - **Homepage URL**: `http://localhost:3000`
   - **Webhook URL**: (See Step 5 for Smee URL)
   - **Webhook secret**: Create one like `your-webhook-secret-123`
   
4. **Permissions** (Repository):
   - Contents: **Read-only**
   - Pull requests: **Read & Write**
   - Commit statuses: **Read & Write**
   - Metadata: **Read-only**

5. **Subscribe to events**:
   - ✅ Pull request
   - ✅ Push

6. Click **Create GitHub App**
7. Note the **App ID** (shown on next page)
8. Scroll down and **Generate a private key** (downloads .pem file)
9. Open the .pem file and copy content (you'll need it for env)

---

## Step 5: Set Up Smee (Webhook Forwarding)

Smee forwards GitHub webhooks to your localhost during development.

1. Go to: https://smee.io/
2. Click **"Start a new channel"**
3. Copy the URL (looks like: `https://smee.io/AbCdEfGhIjKlMnOp`)
4. Install Smee client globally:
   ```bash
   npm install -g smee-client
   ```
5. **Update your GitHub App**:
   - Go back to GitHub App settings
   - Set **Webhook URL** to your Smee URL

---

## Step 6: Create .env File

Create `web/.env` with your values:

```env
# Database (from Step 2)
DATABASE_URL="postgresql://your-connection-string"

# GitHub OAuth (from Step 3)
GITHUB_CLIENT_ID="your-oauth-client-id"
GITHUB_CLIENT_SECRET="your-oauth-client-secret"

# GitHub App (from Step 4)
GITHUB_APP_ID="123456"
GITHUB_WEBHOOK_SECRET="your-webhook-secret-123"

# GitHub App Private Key (from Step 4 - paste entire .pem content)
# Replace newlines with \n or use the format below
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"

# GitHub Personal Access Token (optional - for fallback API calls)
# Create at: https://github.com/settings/tokens (needs 'repo' scope)
GITHUB_TOKEN="ghp_xxxxxxxxxxxx"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-32-char-string-here"

# Environment
NODE_ENV="development"

# Optional: Gemini AI (for AI rule generation)
# Get key at: https://makersuite.google.com/app/apikey
GEMINI_API_KEY="your-gemini-api-key"

# Optional: Slack Notifications
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/xxx/xxx/xxx"

# Optional: JIRA Integration
JIRA_HOST="https://yourcompany.atlassian.net"
JIRA_EMAIL="your-email@company.com"
JIRA_API_TOKEN="your-jira-api-token"
JIRA_PROJECT_KEY="COMP"
```

---

## Step 7: Initialize Database

```bash
cd web

# Generate Prisma client
npx prisma generate

# Push schema to database (creates tables)
npx prisma db push

# (Optional) Seed with sample data
# npx prisma db seed
```

---

## Step 8: Start the Application

### Terminal 1: Start Smee (webhook forwarding)
```bash
smee -u https://smee.io/YOUR-SMEE-URL -t http://localhost:3000/api/github/webhook
```

### Terminal 2: Start Web Server
```bash
cd web
npm run dev
```

The app will be available at: **http://localhost:3000**

---

## Step 9: Install GitHub App on Repository

1. Open http://localhost:3000
2. Login with GitHub
3. Go to **Integrations** page
4. Click **"Install GitHub App"**
5. Select the repository you want to monitor
6. The app will automatically create a project

---

## Step 10: Test It!

1. Create a new branch in your monitored repo
2. Add a file with a security violation:
   ```javascript
   // test.js
   const password = "hardcoded_secret_123";
   eval(userInput);
   const hash = crypto.createHash('md5');
   ```
3. Create a Pull Request
4. Watch the Smee terminal for incoming webhooks
5. Check the PR for CodeGuard comments!

---

## Troubleshooting

### "No analyses showing in History"
- Make sure you're logged in
- Check that projects exist in the Projects page
- Verify webhook is receiving events (check Smee terminal)

### "Webhook not receiving events"
1. Check Smee is running
2. Verify GitHub App webhook URL matches Smee URL
3. Check webhook secret matches .env file

### "Database connection error"
- Verify DATABASE_URL is correct
- If using Supabase, use the **Session Pooler** connection string
- Run `npx prisma db push` again

### "GitHub login not working"
- Verify callback URL in OAuth App is exactly: `http://localhost:3000/api/auth/callback/github`
- Check GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        User's Browser                         │
│                    http://localhost:3000                      │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                     Next.js Web Server                        │
│                        (web folder)                           │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ Dashboard │ Projects │ Rules │ History │ Settings  │    │
│   └─────────────────────────────────────────────────────┘    │
│   ┌─────────────────────────────────────────────────────┐    │
│   │              API Routes                              │    │
│   │  /api/github/webhook  ← Receives PR events          │    │
│   │  /api/analyses        ← Analysis history            │    │
│   │  /api/projects        ← Project CRUD                │    │
│   │  /api/rules           ← Rules CRUD                  │    │
│   └─────────────────────────────────────────────────────┘    │
└────────────────────────────┬─────────────────────────────────┘
                             │
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│   PostgreSQL     │ │   GitHub     │ │    Smee.io       │
│   (Supabase)     │ │   API        │ │ (webhook proxy)  │
└──────────────────┘ └──────────────┘ └──────────────────┘
```

---

## File Structure

```
compliance-system/
├── web/                    # Next.js frontend + API
│   ├── app/                # Pages and API routes
│   │   ├── api/            # Backend API
│   │   │   └── github/webhook/  # PR analysis endpoint
│   │   └── (dashboard)/    # Dashboard pages
│   ├── lib/                # Utilities
│   │   ├── ast-analyzer.js # Tree-sitter AST analysis
│   │   └── github-app.js   # GitHub App auth
│   └── prisma/             # Database schema
│
├── worker/                 # Background worker (needs Redis)
│   └── src/
│       └── analysis/
│           └── ast/        # AST queries for 6 languages
│               └── queries/
│
└── database/               # Shared schema reference
```

---

## Quick Reference: Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `GITHUB_CLIENT_ID` | ✅ Yes | OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | ✅ Yes | OAuth App Client Secret |
| `GITHUB_APP_ID` | ✅ Yes | GitHub App ID |
| `GITHUB_WEBHOOK_SECRET` | ✅ Yes | Webhook signature secret |
| `GITHUB_APP_PRIVATE_KEY` | ⚠️ Recommended | For GitHub App auth |
| `GITHUB_TOKEN` | ⚠️ Fallback | Personal Access Token |
| `NEXTAUTH_URL` | ✅ Yes | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | ✅ Yes | Random 32+ char string |
| `GEMINI_API_KEY` | ❌ Optional | For AI rule generation |
| `SLACK_WEBHOOK_URL` | ❌ Optional | Slack notifications |

---

## Support

If you have issues, check:
1. Smee terminal for incoming webhooks
2. Browser console for frontend errors
3. Next.js terminal for API errors
4. Database tables in Prisma Studio (`npx prisma studio`)

Good luck! 🚀
