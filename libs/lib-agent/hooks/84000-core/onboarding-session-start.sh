#!/bin/sh
# SessionStart: ask the model to run the onboarding skill before its first
# reply. The hook has no studio token, so it cannot read the user's profile;
# the skill checks it and stops quietly if onboarding is already done. Once a
# profile read shows the completed tag, onboarding-mark-completed.sh leaves a
# marker here and this hook goes silent on this device.

if [ -n "${CLAUDE_PLUGIN_DATA:-}" ] && [ -f "${CLAUDE_PLUGIN_DATA}/onboarding-completed" ]; then
  exit 0
fi

printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"84000 onboarding has not been confirmed complete on this device. Before your first reply, run the 84000-core onboarding skill. It checks the user'"'"'s 84000 profile and stops quietly if they have already completed onboarding."}}'
