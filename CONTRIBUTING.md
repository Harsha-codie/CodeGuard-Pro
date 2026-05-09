# Contributing to CodeGuard Pro

Thank you for your interest in contributing to CodeGuard Pro! This document provides guidelines and instructions for contributing.

---

## 🤝 Ways to Contribute

### 1. Report Bugs
- Check if the bug is already reported in [Issues](https://github.com/Harsha-codie/CodeGuard-Pro/issues)
- Create a new issue with:
  - Clear title describing the bug
  - Step-by-step reproduction steps
  - Expected vs. actual behavior
  - Screenshots if applicable
  - Your environment (OS, Node version, browser)

### 2. Suggest Features
- Check [Discussions](https://github.com/Harsha-codie/CodeGuard-Pro/discussions) for similar ideas
- Open a discussion or issue with:
  - Clear feature description
  - Use case and benefits
  - Any implementation suggestions
  - Mockups or examples if applicable

### 3. Submit Code
- Fork the repository
- Create a feature branch
- Make your changes
- Submit a pull request

### 4. Improve Documentation
- Fix typos or unclear explanations
- Add examples or tutorials
- Create guides for specific tasks
- Improve API documentation

### 5. Create Rule Templates
- Develop new security rules
- Test thoroughly
- Document the rule
- Submit with examples

---

## 🚀 Setting Up Development Environment

### Prerequisites
- Node.js 18+
- PostgreSQL 12+ (or Supabase account)
- Git
- GitHub account

### 1. Fork and Clone
```bash
# Fork the repository on GitHub

# Clone your fork
git clone https://github.com/YOUR_USERNAME/CodeGuard-Pro.git
cd CodeGuard-Pro
```

### 2. Install Dependencies
```bash
# Install web dependencies
cd web
npm install

# Install worker dependencies (optional)
cd ../worker
npm install

# Install database tools
cd ../database
npm install
```

### 3. Configure Environment
```bash
# Copy example env file
cp web/.env.example web/.env

# Edit with your values
nano web/.env

# Required variables:
# - DATABASE_URL (PostgreSQL connection string)
# - GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET
# - GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY
# - NEXTAUTH_URL
# - NEXTAUTH_SECRET
```

### 4. Setup Database
```bash
cd database

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# (Optional) Seed with sample data
npx prisma db seed
```

### 5. Start Development Server
```bash
cd ../web
npm run dev

# Open http://localhost:3000
```

---

## 📋 Development Workflow

### Creating a Feature Branch
```bash
# Update main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Commit Guidelines
```bash
# Write clear, descriptive commits
git commit -m "feat: add new security rule for API key detection"

# Commit format:
# feat:  new feature
# fix:   bug fix
# docs:  documentation
# style: formatting
# test:  test changes
# refactor: code restructuring
```

### Pushing Changes
```bash
# Push to your fork
git push origin feature/your-feature-name

# Go to GitHub and create a Pull Request
```

---

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests for specific file
npm test -- engine.test.js

# Run tests with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Writing Tests
```javascript
// Example: engine.test.js
describe('Analysis Engine', () => {
    it('should detect hardcoded API keys', async () => {
        const code = "const KEY = 'sk-1234567890'";
        const rules = [{
            id: '1',
            treeSitterQuery: '(string) @secret',
            message: 'Hardcoded secret'
        }];
        
        const violations = await engine.analyze(code, 'javascript', rules);
        
        expect(violations).toHaveLength(1);
        expect(violations[0].message).toBe('Hardcoded secret');
    });
});
```

### Test Coverage
- Aim for 80%+ coverage on new code
- Test happy paths and error cases
- Use meaningful test descriptions
- Mock external services

---

## 💻 Code Style

### Format with Prettier
```bash
npm run format

# Or check without fixing
npm run format:check
```

### Lint with ESLint
```bash
npm run lint

# Fix issues automatically
npm run lint:fix
```

### JavaScript Style Guidelines
```javascript
// ✅ Good: Clear, descriptive names
async function fetchAndAnalyzePullRequest(owner, repo, prNumber) {
    const files = await github.getPRFiles(owner, repo, prNumber);
    return analyzeFiles(files);
}

// ❌ Bad: Vague names
async function doThing(a, b, c) {
    const x = await api.get(a, b, c);
    return process(x);
}

// ✅ Good: Proper error handling
try {
    const data = await database.query();
} catch (error) {
    logger.error('Database query failed:', error);
    throw new Error('Failed to fetch data');
}

// ✅ Good: Use async/await
async function processData() {
    const result = await fetchData();
    return result;
}

// ❌ Bad: Callback hell
function processData(callback) {
    fetchData((err, data) => {
        if (err) callback(err);
        else processMore(data, (err2, data2) => {
            callback(null, data2);
        });
    });
}
```

### Documentation Style
```javascript
/**
 * Analyzes code for security violations
 * @param {string} sourceCode - The code to analyze
 * @param {string} language - Programming language (javascript, python, java)
 * @param {Array<Rule>} rules - Security rules to apply
 * @returns {Promise<Array<Violation>>} Found violations
 * @throws {AnalysisError} If analysis fails
 * 
 * @example
 * const violations = await engine.analyze(code, 'javascript', rules);
 */
async function analyze(sourceCode, language, rules) {
    // Implementation
}
```

---

## 🔧 Common Tasks

### Adding a New API Endpoint

1. **Create route file**
```bash
mkdir -p web/app/api/myfeature
touch web/app/api/myfeature/route.js
```

2. **Implement endpoint**
```javascript
// web/app/api/myfeature/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET(request) {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    // Implementation
    const data = await fetchData();
    
    return NextResponse.json(data);
}

export async function POST(request) {
    // Implementation
}
```

3. **Add tests**
```bash
touch web/app/api/myfeature/__tests__/route.test.js
```

### Adding a New Security Rule

1. **Define rule in database**
```javascript
// database/add-rules.js
const newRule = {
    name: 'My New Rule',
    description: 'Detects potential issues',
    language: 'javascript',
    treeSitterQuery: '(your_query) @capture',
    severity: 'WARNING',
};
```

2. **Test the query**
```bash
cd database
node query-generator.js "your_query" "test_code.js"
```

3. **Add to templates**
```javascript
// web/lib/rule-templates.js
export const ruleTemplates = [
    // ... existing rules
    newRule,
];
```

### Creating a New Database Migration

1. **Update schema.prisma**
```prisma
model NewModel {
    id String @id @default(cuid())
    name String
    // ... fields
}
```

2. **Create migration**
```bash
npx prisma migrate dev --name add_new_model
```

3. **Generate client**
```bash
npx prisma generate
```

---

## 📦 Dependency Management

### Adding Dependencies
```bash
# Development dependency
npm install --save-dev package-name

# Production dependency
npm install package-name

# Specific version
npm install package-name@1.2.3
```

### Updating Dependencies
```bash
# Check for updates
npm outdated

# Update specific package
npm update package-name

# Update all packages
npm update
```

### Security Audit
```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

---

## 🐛 Debugging

### Enable Debug Logging
```javascript
// Add debug flag
const debug = process.env.DEBUG === 'true';
if (debug) console.log('[DEBUG]', message);
```

### VS Code Debugging
1. Add launch configuration to `.vscode/launch.json`
2. Set breakpoints in code
3. Press F5 to start debugging

### Database Debugging
```bash
# Connect to database directly
psql DATABASE_URL

# List tables
\dt

# Query data
SELECT * FROM "Project";
```

---

## 📊 Performance Testing

### Measure Response Time
```bash
curl -w '\nTotal: %{time_total}s\n' http://localhost:3000/api/projects
```

### Load Testing
```bash
# Install Apache Bench
ab -n 1000 -c 10 http://localhost:3000/api/health
```

### Profiling
```javascript
console.time('operation');
// Code to measure
console.timeEnd('operation');
```

---

## 🔍 Code Review Checklist

Before submitting a PR, ensure:

- [ ] Code follows style guidelines
- [ ] Tests pass (`npm test`)
- [ ] No console errors
- [ ] Comments explain complex logic
- [ ] No hardcoded values
- [ ] Environment variables used correctly
- [ ] Database migrations included
- [ ] Documentation updated
- [ ] Commit messages are clear
- [ ] PR description explains changes

---

## 📝 PR Description Template

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Performance improvement

## Related Issues
Closes #issue_number

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing Done
- Test 1
- Test 2

## Screenshots (if applicable)
[Attach screenshots]

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No breaking changes
```

---

## 🚫 Things NOT to Do

- Don't commit secrets or API keys
- Don't make breaking changes without discussion
- Don't add large dependencies without justification
- Don't commit node_modules or build artifacts
- Don't modify another person's commits
- Don't force push to main branch

---

## 🎯 Priority Areas for Contribution

### High Priority
1. **Test Coverage** - Add unit and integration tests
2. **Error Handling** - Improve edge case handling
3. **Documentation** - API docs and guides
4. **Performance** - Optimize slow operations
5. **Security** - Security audit and hardening

### Medium Priority
1. **UI/UX** - Improve dashboard design
2. **New Rules** - Create more security rule templates
3. **Integrations** - Add third-party integrations
4. **Features** - Minor feature additions

### Lower Priority
1. **Polish** - Code cleanup and refactoring
2. **Examples** - Additional examples and tutorials

---

## 💬 Getting Help

### Resources
- [Architecture Guide](ARCHITECTURE.md) - System design
- [API Documentation](web/app/api/README.md) - API details
- [SETUP.md](SETUP.md) - Installation guide
- [GitHub Issues](https://github.com/Harsha-codie/CodeGuard-Pro/issues) - Bug reports
- [Discussions](https://github.com/Harsha-codie/CodeGuard-Pro/discussions) - Questions

### Communication
- **Issues**: Bug reports and feature requests
- **Discussions**: Questions and ideas
- **PRs**: Code contributions
- **Email**: For security issues

---

## ✅ Contributor Recognition

All contributors will be:
- Listed in [CONTRIBUTORS.md](CONTRIBUTORS.md)
- Mentioned in release notes
- Credited in PR comments

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## 🙏 Thank You

Thank you for contributing to CodeGuard Pro! Your efforts help make code security better for everyone.

---

**Last Updated**: May 9, 2026  
**Version**: 1.0
