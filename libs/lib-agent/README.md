# lib-agent

The studio MCP server (`src/`) and the content of the Claude Code plugins:
skills, agents, commands, hooks and shared reference. How the plugins are
assembled and released is under "Claude Code Plugins" in the root `CLAUDE.md`.

Before adding a tool, an `eft` command or a skill that reads or writes studio
data, read [`docs/agent-tooling.md`](../../docs/agent-tooling.md). It says what
belongs in the MCP, what belongs in a skill or `eft`, how bulk edits are
written back, and why nothing local holds database credentials.
