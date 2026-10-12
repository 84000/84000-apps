#!/bin/sh
# PostToolUse on get-my-profile. Its input is empty and an error result never
# names the tag, so the completed tag in the hook input means the profile
# carries it. Leave the marker that silences onboarding-session-start.sh.
# add-profile-tag is not matched: its input names the tag even when the call
# fails, and the skill's next get-my-profile sets the marker anyway.
# Never fails the tool call.

[ -n "${CLAUDE_PLUGIN_DATA:-}" ] || exit 0

if grep -q 'harness\.onboarding\.completed' 2>/dev/null; then
  mkdir -p "${CLAUDE_PLUGIN_DATA}" 2>/dev/null &&
    : > "${CLAUDE_PLUGIN_DATA}/onboarding-completed" 2>/dev/null
fi
exit 0
