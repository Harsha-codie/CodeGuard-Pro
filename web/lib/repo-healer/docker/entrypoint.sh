#!/bin/bash
# ============================================================
# CodeGuard Pro — Sandbox Entrypoint
# 
# Detects project type, installs deps, runs tests.
# All output goes to stdout/stderr for capture.
# ============================================================

set -e

cd /workspace

echo "=== SANDBOX START ==="
echo "Project path: $(pwd)"
echo "Files: $(ls -la 2>/dev/null | head -20)"

# ---- Detect project type ----
PROJECT_TYPE="unknown"

if [ -f "package.json" ]; then
    PROJECT_TYPE="node"
elif [ -f "requirements.txt" ] || [ -f "setup.py" ] || [ -f "pyproject.toml" ]; then
    PROJECT_TYPE="python"
elif [ -f "pom.xml" ] || [ -f "build.gradle" ]; then
    PROJECT_TYPE="java"
elif [ -f "go.mod" ]; then
    PROJECT_TYPE="go"
fi

echo "=== PROJECT_TYPE: $PROJECT_TYPE ==="

# ---- Install dependencies ----
echo "=== INSTALLING DEPENDENCIES ==="

case $PROJECT_TYPE in
    node)
        npm install --no-audit --no-fund 2>&1 || echo "WARN: npm install had issues"
        ;;
    python)
        if [ -f "requirements.txt" ]; then
            python3 -m pip install --user -r requirements.txt 2>&1 || echo "WARN: pip install had issues"
        fi
        ;;
    *)
        echo "No dependency installation for $PROJECT_TYPE"
        ;;
esac

# ---- Run tests ----
echo "=== RUNNING TESTS ==="

case $PROJECT_TYPE in
    node)
        # Check for test script
        if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.test && p.scripts.test !== 'echo \"Error: no test specified\" && exit 1' ? 0 : 1)" 2>/dev/null; then
            npm test 2>&1 || true
        elif [ -d "node_modules/.bin" ] && [ -f "node_modules/.bin/jest" ]; then
            npx jest --forceExit --no-coverage 2>&1 || true
        elif [ -d "node_modules/.bin" ] && [ -f "node_modules/.bin/mocha" ]; then
            npx mocha --recursive 2>&1 || true
        else
            npm test 2>&1 || true
        fi
        ;;
    python)
        python3 -m pytest -v --tb=short 2>&1 || python3 -m unittest discover -v 2>&1 || true
        ;;
    java)
        if [ -f "pom.xml" ]; then
            mvn test -q 2>&1 || true
        elif [ -f "build.gradle" ]; then
            ./gradlew test 2>&1 || true
        fi
        ;;
    go)
        go test ./... -v 2>&1 || true
        ;;
    *)
        echo "No test runner available for project type: $PROJECT_TYPE"
        ;;
esac

echo "=== SANDBOX END ==="
