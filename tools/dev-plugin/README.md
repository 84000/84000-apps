# 84000-dev

Developer tools for working on this repo with Claude Code. **Unpublished**: it
is not in `libs/lib-agent/plugins.json` and not in any marketplace, and it
must stay that way. The plugins in `libs/lib-agent` are for translators and
editors; this one is for people working on the code.

## Install

```sh
tools/dev-plugin/install.sh
```

This links `~/.claude/skills/84000-dev` to this directory, so Claude Code
loads it in your next session as `84000-dev@skills-dir`, and it follows
whatever this checkout has checked out. `install.sh --remove` takes the link
away. Set `CLAUDE_SKILLS_DIR` to install somewhere other than
`~/.claude/skills`. Install from your main checkout rather than an issue
worktree: the link breaks when the worktree is removed.

## Skills

### editor-eval

Checks the studio editor against its spec in
[`docs/editor-spec`](../../docs/editor-spec/README.md) on the local stack:
runs the Playwright suite in `apps/web-main-e2e` for the deterministic items,
drives Chromium through the judged items, and writes `editor-eval-report.json`
with DOM or SQL evidence for every verdict. Ask for it with, for example,
"run the editor eval for ED-STR" or "check the judged editor items".

It needs what the e2e suite needs (see its
[README](../../apps/web-main-e2e/README.md)): the local Supabase stack from
`infra` with the test work seeded, and `infra`'s `restore-test-work` script
(added by infra#59).
It only works against localhost and never resets the database.

## Evals

TODO: an eval suite for `editor-eval` (`claude plugin eval`, run locally and
by hand, never in CI) is planned: one case per known editor bug, injected as a
patch, plus a clean control case. How its runs reach the browser and the
local stack (Bash in the eval sandbox, or a Playwright MCP server) is not
decided yet, so the cases, graders and runner are not here.
