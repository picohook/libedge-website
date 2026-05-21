#!/usr/bin/env bash
# Execution Monitor — LibEdge Three Man Team (WSL/Linux)
# Run from project root: bash scripts/execution-monitor.sh [step-number]
# Writes results to handoff/EXECUTION-REPORT.md

set -euo pipefail

STEP="${1:-}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT="$PROJECT_ROOT/handoff/EXECUTION-REPORT.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

echo "[Monitor] Starting execution check..."

# --- Changed files ---
CHANGED=$(git -C "$PROJECT_ROOT" diff --name-only HEAD 2>/dev/null || git -C "$PROJECT_ROOT" diff --name-only HEAD~1 2>/dev/null || true)
echo "[Monitor] Changed files:"
echo "$CHANGED" | sed 's/^/  /'

# --- Determine what to test ---
HAS_JS=$(echo "$CHANGED" | grep -E '\.(js|ts|mjs)$' | grep -v node_modules | wc -l)
HAS_PROXY=$(echo "$CHANGED" | grep -c 'workers/proxy' || true)
HAS_RA=$(echo "$CHANGED" | grep -cE 'ra-egress|ra-browser|test/ra' || true)
HAS_WORKER=$(echo "$CHANGED" | grep -cE 'backend/src|workers/proxy' || true)
HAS_MIGR=$(echo "$CHANGED" | grep -c 'migrations/' || true)

# --- JS tests ---
JS_STATUS="SKIPPED"
JS_OUTPUT=""
if [ "$HAS_JS" -gt 0 ] || [ "${FORCE:-0}" = "1" ]; then
    echo "[Monitor] Running npm test..."
    JS_OUTPUT=$(cd "$PROJECT_ROOT" && npm test 2>&1) && JS_STATUS="PASS" || JS_STATUS="FAIL"
    echo "[Monitor] JS tests: $JS_STATUS"
fi

# --- RA tests ---
RA_STATUS="SKIPPED"
RA_OUTPUT=""
if [ "$HAS_PROXY" -gt 0 ] || [ "$HAS_RA" -gt 0 ]; then
    echo "[Monitor] Running RA proxy tests..."
    RA_OUTPUT=$(cd "$PROJECT_ROOT" && npm test -- "test/ra/upstream.test.js" "test/ra/proxy-token-accept.test.js" 2>&1) && RA_STATUS="PASS" || RA_STATUS="FAIL"
    echo "[Monitor] RA tests: $RA_STATUS"
fi

# --- Deploy gate ---
DEPLOY_GATE=$([ "$HAS_WORKER" -gt 0 ] && echo "PENDING — manual wrangler deploy required" || echo "SKIPPED")
MIGR_GATE=$([ "$HAS_MIGR" -gt 0 ] && echo "PENDING — apply migration file manually" || echo "SKIPPED")
MANUAL=$([ "$HAS_WORKER" -gt 0 ] || [ "$HAS_MIGR" -gt 0 ] && echo "YES" || echo "NO")

STEP_LINE="${STEP:-<!-- fill in step number -->}"

# --- Write report ---
cat > "$REPORT" << EOF
# Execution Report
*Written by Execution Monitor. Read by Bob (to confirm) and Richard (before review).*

---

## Step
$STEP_LINE

## Run Date
$TIMESTAMP

## Changed Files
\`\`\`
$CHANGED
\`\`\`

---

## Test Results

### JS / Vitest (\`npm test\`)
\`\`\`
Status: $JS_STATUS
$JS_OUTPUT
\`\`\`

### RA / Proxy Tests
\`\`\`
Status: $RA_STATUS
$RA_OUTPUT
\`\`\`

### Go Tests (if ra-egress changed)
\`\`\`
Status: SKIPPED — run manually: cd ra-egress && go test ./...
\`\`\`

---

## Deploy Gate

| Gate | Status |
|------|--------|
| Worker staging deploy | $DEPLOY_GATE |
| D1 migration applied | $MIGR_GATE |
| Manual approval required | $MANUAL |

---

## Dead Hypotheses
<!-- Bob: fill in what was tried and failed -->

---

## Monitor Notes
EOF

[ "$JS_STATUS" = "FAIL" ] && echo "⚠️  JS tests FAILED — do not hand off until resolved." >> "$REPORT"
[ "$RA_STATUS" = "FAIL" ] && echo "⚠️  RA tests FAILED — check proxy Worker changes." >> "$REPORT"
[ "$HAS_MIGR" -gt 0 ] && echo "ℹ️  Migration file changed — record checkpoint in ROLLBACK-GUARDIAN.md before applying." >> "$REPORT"

echo ""
echo "=== MONITOR SUMMARY ==="
echo "JS:     $JS_STATUS"
echo "RA:     $RA_STATUS"
echo "Deploy: $DEPLOY_GATE"
OVERALL=$([ "$JS_STATUS" = "FAIL" ] || [ "$RA_STATUS" = "FAIL" ] && echo "FAIL" || echo "PASS")
echo "Overall: $OVERALL"
echo ""
echo "[Monitor] Report written to handoff/EXECUTION-REPORT.md"
