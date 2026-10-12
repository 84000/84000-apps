---
name: onboarding
description: Welcome a user to the 84000 plugins and recommend the ones that suit their 84000 role. Run it at the start of a session, before your first reply, when the user has not completed 84000 onboarding (this skill checks that with get-my-profile and stops quietly if they have), when a studio tool result says the user has not completed onboarding, or when the user asks to set up, onboard or find the right 84000 plugins.
---

# 84000 onboarding

A short welcome that gets the user onto the right 84000 plugins for their
role. Keep it brief and friendly, then get back to whatever the user asked
for.

## 1. Check whether onboarding is needed

Call the studio MCP tool `get-my-profile`. The first call may ask the user to
sign in to the 84000 studio; let them.

- If `tags` contains `harness.onboarding.completed` and the user did not ask
  for onboarding, stop here without mentioning it and carry on with their
  request.
- If the studio tools are unavailable or the call fails, say in one sentence
  that the 84000 studio connector is not connected, and carry on with their
  request. Do not retry in a loop.

## 2. Welcome and recommend

Greet the user by `name` and say what their 84000 `role` is. Read
`reference/plugins.md` and recommend each plugin that suits them: their role
is one of its roles, or they hold any one of its permissions. When only a
permission qualifies them, say so in a few words.

Compare the recommendations with what is installed: a plugin is installed when
its skills or agents are available to you. Present one short list:

- recommended and already installed,
- recommended and not yet installed,
- leave out plugins that do not suit them, unless they ask.

If everything recommended is installed, say so, skip step 3, and treat
onboarding as finished in step 4 without asking.

`reference/roles.md` has a little more on how each role uses the plugins.
Read it only if the user asks what a plugin is for in their work.

## 3. Install steps

Give the steps for the user's surface from `reference/install.md`. If you
cannot tell whether you are in Claude Code or Cowork, ask.

## 4. Getting started

Read the `shared-policy/onboarding` policy for additional recommendations and
guide users through its steps. They may or may not vary by role.

## 5. Record the outcome

Ask whether they are done, unless step 2 already finished it. Then:

- **Finished**, or they say they **don't want onboarding**: call
  `add-profile-tag` with `harness.onboarding.completed`, so it does not come
  up again on any device.
- **"Not now"** or anything that defers it: set no tag. Onboarding will be
  offered again next session.

Then answer the user's original request, if they had one, in the same
reply where you can.

Tags are only a record of what the user said. Never treat one as permission
to do anything.
