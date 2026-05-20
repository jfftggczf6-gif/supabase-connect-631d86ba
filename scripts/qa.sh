#!/usr/bin/env bash
# scripts/qa.sh — Quality Gate P8 ESONO
#
# Enchaîne 8 checks. Si UN check échoue → exit 1 (deploy bloqué).
# Brief : Philippe ne teste plus manuellement.

set -u
shopt -s extglob

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS_COUNT=0
FAIL_COUNT=0
declare -a FAILED_STEPS

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

print_header() {
  echo ""
  echo -e "${BLUE}${BOLD}═══ $1 ═══${RESET}"
}

run_step() {
  local label="$1"
  local cmd="$2"
  print_header "$label"
  if eval "$cmd"; then
    echo -e "${GREEN}✅ $label${RESET}"
    PASS_COUNT=$((PASS_COUNT + 1))
    return 0
  else
    echo -e "${RED}❌ $label${RESET}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILED_STEPS+=("$label")
    return 1
  fi
}

echo -e "${BOLD}🚦 QUALITY GATE P8 — ESONO${RESET}"
echo -e "${YELLOW}Branche : $(git rev-parse --abbrev-ref HEAD 2>/dev/null) · Commit : $(git rev-parse --short HEAD 2>/dev/null)${RESET}"
echo ""

# 1. TypeScript
run_step "1/8 TypeScript (tsc --noEmit)" "npm run test:types" || true

# 2. Build
run_step "2/8 Build (vite build)" "npm run build" || true

# 3. E2E flows
run_step "3/8 E2E flows (Playwright tests/e2e/)" "npx playwright test tests/e2e/ --reporter=list" || true

# 4. Visual regression
run_step "4/8 Visual regression (tests/visual/)" "npx playwright test tests/visual/ --reporter=list" || true

# 5. Content assertions
run_step "5/8 Content & design assertions (tests/content/)" "npx playwright test tests/content/ --reporter=list" || true

# 6. Edge functions health
run_step "6/8 Edge Functions (CORS + auth)" "node scripts/test-edge-functions.js" || true

# 7. RLS security
run_step "7/8 RLS isolation (cross-org)" "node scripts/test-rls-security.js" || true

# 8. Data integrity
run_step "8/8 Data integrity" "node scripts/test-data-integrity.js" || true

echo ""
echo -e "${BOLD}═══ RÉSUMÉ ═══${RESET}"
echo -e "${GREEN}✅ ${PASS_COUNT}/8 checks pass${RESET}"
if [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "${RED}❌ ${FAIL_COUNT}/8 checks fail${RESET}"
  for s in "${FAILED_STEPS[@]}"; do
    echo -e "${RED}   • $s${RESET}"
  done
  echo ""
  echo -e "${RED}${BOLD}🚫 DEPLOY BLOQUÉ${RESET}"
  exit 1
fi

echo ""
echo -e "${GREEN}${BOLD}→ PRÊT POUR PRODUCTION${RESET}"
exit 0
