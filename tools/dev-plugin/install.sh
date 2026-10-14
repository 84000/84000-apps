#!/usr/bin/env bash
# Installs the 84000-dev plugin into your own Claude Code by linking
# ~/.claude/skills/84000-dev to this directory. Claude Code loads it in the
# next session as 84000-dev@skills-dir. The plugin is never published: it is
# not in libs/lib-agent/plugins.json or any marketplace.
#
#   tools/dev-plugin/install.sh            install (or repoint) the link
#   tools/dev-plugin/install.sh --remove   remove the link
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
skills_dir="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
link="$skills_dir/84000-dev"

if [[ "${1:-}" == "--remove" ]]; then
  if [[ -L "$link" ]]; then
    rm "$link"
    echo "Removed $link"
  elif [[ -e "$link" ]]; then
    echo "$link is not a link this script made; leaving it alone." >&2
    exit 1
  else
    echo "Nothing to remove at $link"
  fi
  exit 0
fi

if [[ -e "$link" && ! -L "$link" ]]; then
  echo "$link exists and is not a link; move it away first." >&2
  exit 1
fi

mkdir -p "$skills_dir"
ln -sfn "$here" "$link"
echo "Linked $link -> $here"
echo "Start a new Claude Code session; the plugin loads as 84000-dev@skills-dir."
