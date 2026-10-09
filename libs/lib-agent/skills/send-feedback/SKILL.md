---
name: send-feedback
description: Send a feature request, bug report or general feedback about the 84000 tools to the 84000 team — "this should be able to…", "that tool is broken", "report a bug", "I have feedback", "tell the team…". Drafts the report from the conversation, shows it to the user, and files it only once they confirm. Use it whenever the user wants something passed on to the people who build the 84000 plugins and studio, including when they invoke /send-feedback directly.
---

# Sending feedback to the 84000 team

The studio MCP has three tools that file what the user says as an issue in the
84000 team's tracker, recorded under the user's own 84000 account:

| The user wants to…                             | Tool                     |
| ---------------------------------------------- | ------------------------ |
| ask for something the tools cannot do yet      | `submit-feature-request` |
| report something that did not work as expected | `submit-bug-report`      |
| say anything else about using the tools        | `submit-feedback`        |

If it is unclear which one fits, ask. A complaint about a result can be either
a bug (the tool misbehaved) or a feature request (it behaved as designed, but
the design does not serve them).

## 1. Gather the fields from the conversation

Fill in what the conversation already shows, then ask only for what is
missing. Keep the user's own wording where you can.

- **Every pathway:** a short `title`, written as an issue title. Optional
  context: `activity` (what the user was doing), `plugin` (the 84000 plugin in
  use), and `skillOrTool` (the skill, agent or tool involved).
- **Feature request:** `problem` (what they are trying to do and what gets in
  the way) and `desiredOutcome` (what they would like to be able to do).
- **Bug report:** `whatHappened`, `expected`, and `stepsToReproduce` as
  numbered steps, reconstructed from the conversation: which skill or tool ran,
  with what input, and what came back. Optional `chatExcerpts` holds verbatim
  snippets, such as an error message or a tool result.
- **Feedback:** `feedback`, in the user's words.

## 2. Keep private material out unless the user agrees

The report is read by the development team, outside this conversation.
Translation drafts, unpublished text, policy content, personal details and
anything the user has not chosen to share stay out by default. Describe them
instead ("a Stage 1 draft of toh123, passage 4"). Put a verbatim excerpt in
`chatExcerpts` only when the user agrees to that specific excerpt. Never copy
credentials, tokens or keys, even if they appear in the chat.

## 3. Show the draft and get a clear yes

Show the user exactly what will be sent: the pathway, the title and every
field. Submit only after they confirm, and apply any change they ask for first.
Their account and email are attached to the report automatically, so do not
add them yourself.

## 4. Submit and report back

Call the tool once. On success, tell the user the issue identifier it returns;
`alreadyFiled` means the same report was filed earlier and that issue is the
one returned. On a `forbidden` result, the user's account lacks the
`harness.read` permission: say so and suggest they contact the 84000 team.

The other errors say whether anything was filed. If nothing was, pass the
message on, keep the draft, and offer to try again later. If the tracker did
not confirm, tell the user the report may have gone through; resubmitting the
identical draft is safe because a report already filed is found rather than
filed twice. Change the draft only if the user wants a separate report. Do not
retry in a loop.
