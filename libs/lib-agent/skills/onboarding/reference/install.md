# Installing the 84000 plugins

The 84000 plugins are distributed to the 84000 organization through the
Claude app's organization settings, not from a public marketplace. A plugin
installed in the Claude app is saved to the user's account and also loads in
Claude Code, so the Claude app is the one place to install them.

## Cowork (Claude desktop app)

1. Open the **Cowork** tab.
2. Open **Customize** in the sidebar, then **Plugins**.
3. Under **Discover**, select the 84000 plugin.
4. Click **Install** (some versions label it **Add**).

The plugin is available from the next task. Plugins the organization has
made required are already installed and cannot be removed.

## Claude Code

Install from the Claude app as above. Claude Code loads the plugins the user
has on for their claude.ai account at the start of each session, shown as
`<plugin>@synced`.

- In a session that is already running, Claude Code shows "Plugins changed.
  Run /reload-plugins to activate." Run `/reload-plugins`, or start a new
  session.
- If a plugin still does not appear, run `/plugin` and check the **Installed**
  and **Errors** tabs.
- Syncing needs Claude Code to be signed in with the user's claude.ai account.
  It does not happen with an API key, a cloud provider (Bedrock, Vertex) or
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`. If that is the case, point the
  user to whoever set up their Claude Code.

## If a plugin is not listed

The organization chooses which plugins each member can install. If a
recommended plugin is not under **Discover**, the user should ask the 84000
team for access; the `send-feedback` skill can file the request.
