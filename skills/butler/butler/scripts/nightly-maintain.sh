#!/bin/bash
# Butler: Nightly Knowledge Maintenance
# Checks project git status and session activity
# Output: maintenance suggestions for AI to act on

TODAY=$(date +%Y-%m-%d)
echo "=== Butler Nightly Maintenance ==="
echo "Date: $TODAY"
echo "---"

# Projects to check
PROJECTS=(
  "/Users/weijian/Projects/personal/hwj/custom-skills"
  "/Users/weijian/Projects/company/easycode-work/doc-collector"
  "/Users/weijian/Projects/third-party/gin"
  "/Users/weijian/Projects/archive/whiteboard-studio-v2"
  "/Users/weijian/Projects/personal/hwj/WePilot"
)

echo "## 1. Git Changes Today"
echo ""

for PROJ in "${PROJECTS[@]}"; do
  [ ! -d "$PROJ/.git" ] && continue
  NAME=$(basename "$PROJ")

  cd "$PROJ" || continue

  # Check for uncommitted changes
  UNCOMMITTED=$(git status --short 2>/dev/null | wc -l | tr -d ' ')
  # Check for commits today
  COMMITS=$(git log --oneline --since="$TODAY 00:00" --until="$TODAY 23:59" 2>/dev/null | wc -l | tr -d ' ')

  if [ "$UNCOMMITTED" -gt 0 ] || [ "$COMMITS" -gt 0 ]; then
    echo "▶ $NAME"
    [ "$COMMITS" -gt 0 ] && echo "  commits today: $COMMITS"
    [ "$UNCOMMITTED" -gt 0 ] && echo "  uncommitted changes: $UNCOMMITTED"
    echo "---"
  fi
done

echo ""
echo "## 2. Session Activity Today"
echo ""

# Scan session data for today
BASE_DIR="$HOME/.easycode-user/tmp"
SESSION_COUNT=0
TOTAL_TOKENS=0

if [ -d "$BASE_DIR" ]; then
  for WORKSPACE in "$BASE_DIR"/*/; do
    SESSION_DIR="$WORKSPACE/sessions"
    [ ! -d "$SESSION_DIR" ] && continue

    for SESSION in "$SESSION_DIR"/feishu-oc_*/; do
      META="$SESSION/metadata.json"
      [ ! -f "$META" ] && continue

      LAST=$(python3 -c "import json; d=json.load(open('$META')); print(d.get('lastActiveAt',''))" 2>/dev/null)

      if [[ "$LAST" == "$TODAY"* ]]; then
        SESSION_COUNT=$((SESSION_COUNT + 1))
        TOKENS=$(python3 -c "import json; d=json.load(open('$META')); print(d.get('totalTokens',0))" 2>/dev/null)
        TOTAL_TOKENS=$((TOTAL_TOKENS + TOKENS))
        MODEL=$(python3 -c "import json; d=json.load(open('$META')); print(d.get('model',''))" 2>/dev/null)
        MSG=$(python3 -c "import json; d=json.load(open('$META')); print(d.get('firstUserMessage','')[:60])" 2>/dev/null)
        echo "  session: $(basename "$SESSION")"
        echo "  model: $MODEL | tokens: $TOKENS | msgs: $MSG"
      fi
    done
  done
fi

echo "  total sessions today: $SESSION_COUNT"
echo "  total tokens today: $TOTAL_TOKENS"

echo ""
echo "## 3. Wiki Maintenance Suggestions"
echo ""

# Check if project docs need attention
DOCS_DIR="$(cd "$(dirname "$0")/../../../.." && pwd)/docs"
if [ -d "$DOCS_DIR" ]; then
  echo "  Docs at: $DOCS_DIR"
  echo "  Consider updating docs/ after consolidating new knowledge"
else
  echo "  No docs/ found — consider initializing"
fi

echo ""
echo "=== End of Nightly Report ==="
