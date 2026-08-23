#!/usr/bin/env bash
set -euo pipefail

# new-skill.sh — scaffold a skill in the Anthropic-style layout.
# Usage: new-skill.sh <skill-name> [skills-dir]
#   <skill-name>  lowercase hyphen-separated, e.g. my-skill
#   [skills-dir]  defaults to .opencode/skills relative to the current directory

NAME="${1:-}"
SKILLS_DIR="${2:-.opencode/skills}"
TEMPLATE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/assets/SKILL.template.md"

if [[ -z "$NAME" ]]; then
  echo "Usage: $0 <skill-name> [skills-dir]" >&2
  exit 1
fi

if [[ ! "$NAME" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "Error: skill name must be lowercase hyphen-separated (got '$NAME')" >&2
  exit 1
fi

DEST="$SKILLS_DIR/$NAME"
if [[ -e "$DEST" ]]; then
  echo "Error: $DEST already exists" >&2
  exit 1
fi

mkdir -p "$DEST/scripts" "$DEST/references" "$DEST/assets"
sed "s/my-skill/$NAME/g" "$TEMPLATE" > "$DEST/SKILL.md"

echo "Created $DEST"
echo "Next: fill in the description in $DEST/SKILL.md, then restart opencode."
