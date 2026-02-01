# CodeGuard Pro

🛡️ **Automated Code Compliance & Security Analysis for GitHub Pull Requests**

CodeGuard Pro is a GitHub App that automatically analyzes your pull requests for security vulnerabilities and code compliance issues, posting detailed feedback directly on your PRs.

## ✨ Features

### Currently Working
- **GitHub App Integration** - Receives webhooks on PR events
- **Multi-Language Support** - JavaScript, TypeScript, Python, Java
- **Security Violation Detection** - Detects common security issues
- **PR Comments** - Posts inline review comments on violations
- **Web Dashboard** - View projects, rules, and analysis history

### Security Patterns Detected
| Severity | Pattern |
|----------|---------|
| 🔴 CRITICAL | Hardcoded API keys, passwords, tokens, secrets |
| 🔴 CRITICAL | eval()/exec() dangerous code execution |
| 🔴 CRITICAL | document.write() XSS vulnerability |
| 🔴 CRITICAL | SSL certificate verification disabled |
| 🔴 CRITICAL | Pickle deserialization (Python) |
| 🟡 WARNING | Weak cryptography (MD5, SHA1) |
| 🟡 WARNING | Hardcoded URLs |
| 🟡 WARNING | Insecure random number generation |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (or Supabase)
- GitHub App credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/codeguard-pro.git
   cd codeguard-pro
   ```

2. **Install dependencies**
   ```bash
   cd web && npm install
   cd ../database && npm install
   ```

3. **Configure environment**
   ```bash
   cp web/.env.example web/.env
   # Edit .env with your credentials
   ```

4. **Setup database**
   ```bash
   cd database
   npx prisma generate
   npx prisma db push
   ```

5. **Run the server**
   ```bash
   cd web && npm run dev
   ```

6. **Setup webhook forwarding** (for local development)
   ```bash
   npx smee -u YOUR_SMEE_URL -t http://localhost:3000/api/github/webhook
   ```

## 📁 Project Structure

```
codeguard-pro/
├── web/                    # Next.js web application
│   ├── app/
│   │   ├── api/           # API routes
│   │   │   ├── github/    # GitHub webhook handler
│   │   │   ├── projects/  # Project management
│   │   │   ├── rules/     # Rule management
│   │   │   └── analyses/  # Analysis history
│   │   └── (dashboard)/   # Dashboard pages
│   └── components/        # React components
├── database/              # Database scripts & schema
│   └── schema.prisma      # Prisma schema
├── worker/                # Background job worker (optional)
└── practicee/             # Test repository
```

## 🔧 Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_PRIVATE_KEY` | GitHub App private key |
| `GITHUB_WEBHOOK_SECRET` | Webhook signature secret |
| `GITHUB_TOKEN` | Personal access token (for API calls) |
| `NEXTAUTH_SECRET` | NextAuth.js secret |
| `NEXTAUTH_URL` | Application URL |

## 📊 Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: NextAuth.js with GitHub OAuth
- **GitHub Integration**: Octokit

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📝 License

MIT License - see LICENSE file for details.

---

Built with ❤️ for secure code
