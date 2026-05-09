# CodeGuard Pro - Architecture Guide

**Version**: 1.0  
**Last Updated**: May 9, 2026

---

## 📐 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          GITHUB                                  │
│  • PR Events (opened, synchronize, reopened)                    │
│  • Webhook Delivery                                             │
│  • API Access                                                   │
└────────────────┬─────────────────────────────────────────────────┘
                 │ HTTPS Webhooks
                 │ Signature Verification (HMAC-SHA256)
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                 CODEGUARD PRO (Next.js Server)                  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                  Frontend (React)                          │ │
│  │  • Dashboard                                              │ │
│  │  • Projects Management                                   │ │
│  │  • Rules Configuration                                   │ │
│  │  • Analysis History                                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              API Layer (Next.js Routes)                   │ │
│  │  • POST /api/github/webhook                              │ │
│  │  • GET/POST /api/projects                               │ │
│  │  • GET/POST/PUT/DELETE /api/rules                       │ │
│  │  • GET/POST /api/analyses                               │ │
│  │  • ... (30+ endpoints total)                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │           Analysis Engine & Core Logic                    │ │
│  │                                                            │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │  Webhook Handler                                    │ │ │
│  │  │  • Verify signature                                │ │ │
│  │  │  • Extract PR metadata                             │ │ │
│  │  │  • Create analysis record                          │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                         │                                 │ │
│  │                         ▼                                 │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │  PR File Fetcher                                   │ │ │
│  │  │  • Get changed files from PR                       │ │ │
│  │  │  • Filter by language                             │ │ │
│  │  │  • Fetch file contents                            │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                         │                                 │ │
│  │                         ▼                                 │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │  Analysis Engine (Tree-Sitter)                     │ │ │
│  │  │  • Parse code to AST                              │ │ │
│  │  │  • Execute rule queries                           │ │ │
│  │  │  • Detect violations                              │ │ │
│  │  │  • Generate snippets                              │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                         │                                 │ │
│  │                         ▼                                 │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │  AI Integration                                    │ │ │
│  │  │  • Generate explanations                          │ │ │
│  │  │  • Suggest fixes                                  │ │ │
│  │  │  • Create rules from descriptions                │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                         │                                 │ │
│  │                         ▼                                 │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │  Results Handler                                   │ │ │
│  │  │  • Store violations in database                   │ │ │
│  │  │  • Post PR comments                               │ │ │
│  │  │  • Update commit status                           │ │ │
│  │  │  • Create JIRA tickets (critical)                │ │ │
│  │  │  • Send Slack notifications                       │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │          Authentication & Authorization                   │ │
│  │  • NextAuth.js Integration                              │ │
│  │  • GitHub OAuth                                         │ │
│  │  • Session Management                                   │ │
│  │  • Role-Based Access Control                           │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data Storage Layer                            │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │           PostgreSQL (via Prisma ORM)                     │ │
│  │  Tables: Users, Teams, Projects, Rules,                 │ │
│  │          ProjectRules, AnalysisLogs, Violations         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Redis (optional)                             │ │
│  │  • Session storage                                       │ │
│  │  • Job queue                                            │ │
│  │  • Caching                                              │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Component Architecture

### 1. Frontend Layer

#### Structure
```
web/app/
├── (auth)/                 # Authentication pages
│   └── login/page.js      # GitHub OAuth login
├── (dashboard)/           # Protected dashboard routes
│   ├── dashboard/page.js  # Main dashboard
│   ├── projects/page.js   # Project management
│   ├── rules/page.js      # Rule configuration
│   ├── history/page.js    # Analysis history
│   ├── integrations/      # External integrations
│   ├── repo-heal/page.js  # Repository healing
│   └── settings/page.js   # User settings
├── api/                   # API Routes
├── components/            # Reusable React components
└── layout.js             # Root layout
```

#### Key Components
- **Sidebar**: Navigation with user menu
- **Dashboard Grid**: Project overview cards
- **Rule Editor**: Form-based rule creation
- **Analysis Viewer**: Violation detail display
- **Project Manager**: CRUD interface for projects

#### Styling
- **Framework**: Tailwind CSS
- **Responsiveness**: Mobile-first design
- **Icons**: SVG-based icon system
- **Theme**: Light/dark mode support (CSS variables)

---

### 2. API Layer

#### Route Organization
```
/api/
├── auth/[...nextauth]/    # NextAuth handler
├── github/
│   ├── webhook/           # Webhook receiver
│   ├── sync/              # Repository sync
│   └── installations/     # Installation mgmt
├── projects/              # Project CRUD
├── rules/                 # Rule management
│   ├── templates/         # Rule templates
│   └── generate/          # AI generation
├── analyses/              # Analysis CRUD
├── dashboard/stats/       # Statistics
├── repo-heal/             # Healing API
├── notifications/         # Notifications
└── health/                # Health check
```

#### Endpoint Pattern
```javascript
// Each endpoint follows:
export async function GET(request) {
    // 1. Verify authentication
    const session = await getServerSession(authOptions);
    if (!session) return unauthorized();
    
    // 2. Validate input
    const params = await request.json();
    validate(params);
    
    // 3. Query database
    const data = await prisma.model.findMany();
    
    // 4. Return response
    return NextResponse.json(data);
}
```

---

### 3. Analysis Engine

#### Architecture
```
Analysis Engine
├── Grammar Loader
│   └── Loads Tree-Sitter grammars for each language
├── Rule Executor
│   ├── Compiles Tree-Sitter queries
│   ├── Executes queries against AST
│   └── Returns matches
├── Violation Processor
│   ├── Formats violations
│   ├── Extracts code snippets
│   └── Assigns severity
└── Result Aggregator
    ├── Combines all violations
    ├── Deduplicates results
    └── Sorts by severity
```

#### Processing Flow
```
1. Source Code
   ↓
2. Grammar Loader (get language parser)
   ↓
3. Tree-Sitter Parser (build AST)
   ↓
4. Rule Executor (query AST)
   ↓
5. Violation Detector (filter matches)
   ↓
6. Result Processor (format results)
   ↓
7. Violations Array
```

#### Key Files
- `web/lib/ast-analyzer.js` - Main analysis orchestrator
- `worker/src/analysis/engine.js` - Analysis engine wrapper
- `worker/src/analysis/ast/ast-engine.js` - Core AST engine
- `worker/src/analysis/ast/grammar-loader.js` - Grammar management

---

### 4. Database Schema

#### Core Models

**User**
```
- id (String, primary key)
- email (String, unique)
- githubId (String, unique)
- name (String)
- role (ADMIN | DEVELOPER)
- teams (TeamMember[])
- projects (Project[])
- createdAt (DateTime)
```

**Team**
- id, name, description
- members (TeamMember[])
- projects (Project[])
- rules (Rule[])

**Project**
- id, name, repositoryUrl, githubRepoId
- owner (User)
- team (Team)
- rules (ProjectRule[])
- analyses (AnalysisLog[])

**Rule**
- id, name, description
- language (javascript, python, java, etc.)
- treeSitterQuery (Tree-Sitter query)
- severity (WARNING | CRITICAL)
- aiExplanation, aiFixTemplate
- team (Team)
- projectRules (ProjectRule[])

**AnalysisLog**
- id, projectId, prNumber, commitHash
- status (PASS | FAIL)
- violationsJson (JSON)
- createdAt (DateTime)

#### Relationships
```
User 1→∞ Project
User ∞↔∞ Team (via TeamMember)
Team 1→∞ Rule
Team 1→∞ Project
Project 1→∞ AnalysisLog
Project ∞↔∞ Rule (via ProjectRule)
```

---

### 5. Authentication Flow

#### GitHub OAuth Flow
```
1. User clicks "Login with GitHub"
   ↓
2. Redirect to GitHub OAuth endpoint
   ↓
3. User authorizes CodeGuard Pro
   ↓
4. GitHub redirects to /api/auth/callback/github
   ↓
5. NextAuth exchanges code for access token
   ↓
6. NextAuth creates session
   ↓
7. Redirect to /dashboard
   ↓
8. Session stored in JWT cookie
```

#### Session Management
- **Method**: NextAuth.js with JWT
- **Storage**: Secure HTTP-only cookies
- **Duration**: 30 days (configurable)
- **Refresh**: Automatic on each request

---

### 6. Webhook Processing

#### GitHub Webhook Flow
```
1. PR Event occurs (opened, synchronize, reopened)
   ↓
2. GitHub sends POST to /api/github/webhook
   ↓
3. Verify X-Hub-Signature header
   ↓
4. Extract PR metadata
   ↓
5. Create AnalysisLog record
   ↓
6. Fetch changed files
   ↓
7. Run analysis engine
   ↓
8. Store violations
   ↓
9. Post PR comments
   ↓
10. Update commit status
```

#### Webhook Verification
```javascript
const signature = req.headers['x-hub-signature-256'];
const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
const digest = 'sha256=' + hmac.update(body).digest('hex');
const verified = timingSafeEqual(signature, digest);
```

---

### 7. Rule Processing

#### Rule Execution
```
Rule Definition
├── name: "Hardcoded API Key"
├── language: "javascript"
├── treeSitterQuery: "(string) @secret"
├── severity: "CRITICAL"
└── aiExplanation: "..."

↓ (during analysis)

1. Get applicable rules for language
2. For each rule:
   a. Compile Tree-Sitter query
   b. Execute against AST
   c. Capture matching nodes
   d. Extract violation details
   e. Format as violation object
```

#### Violation Object
```javascript
{
    ruleId: "rule-123",
    message: "Hardcoded API key detected",
    line: 42,
    column: 10,
    snippet: "const API_KEY = 'sk-1234567890'",
    severity: "CRITICAL",
    explanation: "This API key could be used by attackers to...",
    suggestedFix: "Use environment variables instead..."
}
```

---

### 8. AI Integration

#### LangGraph Orchestrator
```
Orchestrator
├── Fix Agent
│   └── Generates code fixes for violations
├── CI Agent
│   └── Manages GitHub Actions and test runs
└── Analysis Agent
    └── Provides context and recommendations
```

#### AI Flow
```
Violation
  ↓
AI Bridge (analyze violation)
  ↓
LLM: Generate explanation
LLM: Generate fix suggestion
  ↓
Enhanced Violation
  ├── explanation
  ├── suggestedFix
  └── confidence
```

---

## 🔐 Security Architecture

### Authentication
- **Method**: GitHub OAuth 2.0
- **Implementation**: NextAuth.js
- **Token Storage**: Secure HTTP-only cookies
- **Session Duration**: 30 days

### Authorization
- **Model**: Role-Based Access Control (RBAC)
- **Roles**: ADMIN, DEVELOPER
- **Scope**: User, Team, Project levels
- **Enforcement**: Middleware on all protected routes

### Webhook Security
- **Signature**: HMAC-SHA256
- **Header**: X-Hub-Signature-256
- **Verification**: Timing-safe comparison
- **Replay Protection**: Timestamp validation

### Data Protection
- **Transport**: HTTPS only
- **Database**: Credentials in environment variables
- **API Keys**: Encrypted storage
- **Secrets**: Never logged, validated before use

---

## 🚀 Deployment Architecture

### Development
```
Local Machine
├── Next.js dev server (port 3000)
├── PostgreSQL (local or Supabase)
├── Smee.io webhook forwarding
└── Redis (optional)
```

### Staging
```
VPS/Container
├── Next.js (PM2 or Docker)
├── PostgreSQL
├── Redis
└── Nginx reverse proxy
```

### Production (Target)
```
Cloud (Vercel/AWS/GCP)
├── Next.js (Serverless/Container)
├── PostgreSQL (Managed)
├── Redis (Managed)
├── CDN (Images, assets)
└── Monitoring (DataDog/New Relic)
```

---

## 📊 Data Flow Examples

### Example 1: PR Analysis Workflow
```
1. Developer pushes to PR branch
2. GitHub detects PR open/update
3. GitHub sends webhook to CodeGuard
4. CodeGuard validates webhook
5. CodeGuard fetches changed files
6. CodeGuard analyzes each file
7. CodeGuard stores violations
8. CodeGuard posts PR comments
9. Developer sees feedback
10. Developer makes fixes
11. Developer pushes updates
12. Repeat from step 2
```

### Example 2: Rule Creation Workflow
```
1. User navigates to /dashboard/rules
2. Clicks "Create New Rule"
3. Fills rule form:
   - Name, description
   - Language
   - Tree-Sitter query
   - Severity level
4. Submits form (POST /api/rules)
5. API validates input
6. API tests query syntax
7. API stores rule in database
8. API returns success
9. User sees rule in list
10. Rule available for new analyses
```

### Example 3: Dashboard Update Workflow
```
1. User loads /dashboard
2. Dashboard requests /api/dashboard/stats
3. Server queries database:
   - Count projects
   - Count recent analyses
   - Count violations
   - Calculate averages
4. Server returns statistics
5. Dashboard renders charts
6. User sees real-time data
```

---

## 🔄 Data Consistency

### Transactional Operations
- Rule creation: Atomic (single transaction)
- Project creation: Atomic (single transaction)
- Analysis logging: Event-based (eventual consistency)

### Error Recovery
- Webhook processing: Retry on failure
- Database operations: Transaction rollback
- Analysis failures: Store error state

---

## 📈 Scalability Considerations

### Current Limitations
- Single server (no horizontal scaling)
- No caching layer
- Sequential analysis processing
- No queue system yet

### Future Scalability
- Load balancing (multiple servers)
- Redis caching layer
- BullMQ job queue
- Horizontal scaling of workers
- Database read replicas

---

## 🧪 Testing Architecture

### Test Layers
1. **Unit Tests**: Individual functions
2. **Integration Tests**: API endpoints
3. **E2E Tests**: Full workflows
4. **Performance Tests**: Speed and load

### Test Tools
- **Framework**: Jest/Vitest
- **Test Utilities**: Supertest (HTTP), node-pg (Database)
- **Mocking**: Jest mocks, API mocks
- **Coverage**: Nyc/c8

---

## 📝 Development Guidelines

### Code Organization
- Routes: `/api/[feature]/route.js`
- Components: `/components/[Component].js`
- Utilities: `/lib/[utility].js`
- Database: Prisma schema (`schema.prisma`)

### Naming Conventions
- Files: camelCase (`myFile.js`)
- Components: PascalCase (`MyComponent.js`)
- Routes: lowercase (`/api/endpoint/`)
- Variables: camelCase (`myVariable`)
- Constants: UPPER_CASE (`API_KEY`)

### Error Handling
- Always catch database errors
- Validate user input
- Return meaningful error messages
- Log errors for debugging

---

## 🔗 Integration Points

### External Services
1. **GitHub API** - Repository and PR management
2. **LLM Service** - AI-powered explanations and fixes
3. **JIRA API** - Ticket creation
4. **Slack API** - Notifications
5. **Supabase/PostgreSQL** - Data storage

### Recommended Integrations
- **Error Tracking**: Sentry
- **Monitoring**: DataDog or New Relic
- **Logging**: ELK Stack or Splunk
- **CI/CD**: GitHub Actions
- **Deployment**: Vercel or Heroku

---

## 🎯 Architecture Decisions

### Why Next.js?
- Unified frontend/backend
- Built-in API routes
- Server-side rendering
- Great for rapid development

### Why Prisma?
- Type-safe ORM
- Migrations built-in
- Excellent developer experience
- Works with multiple databases

### Why Tree-Sitter?
- Fast and accurate parsing
- Multiple language support
- Small binary size
- Well-maintained

### Why NextAuth.js?
- Handles OAuth complexity
- Session management built-in
- Secure by default
- Easy integration with GitHub

---

**Last Updated**: May 9, 2026  
**Next Review**: August 1, 2026
