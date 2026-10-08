/**
 * The policy editor MCP App: connects to the host, resolves what to open and
 * the user's permissions, then mounts the editor over MCP tool calls.
 */
import { App, type McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { MutedText } from '@eightyfourthousand/design-system/core';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createMcpPolicySource } from './mcp-policy-source';
import { createOpenState } from './open-state';
import { PolicyEditorApp } from './PolicyEditorApp';

/** The editor's height when the host sets no fixed height of its own. */
const DEFAULT_HEIGHT = 640;

/** Fits the app to the host's container: a fixed height, or at most its maximum. */
const applyHostContext = (context: McpUiHostContext | undefined) => {
  const dimensions = context?.containerDimensions;
  const height =
    dimensions && 'height' in dimensions
      ? dimensions.height
      : Math.min(
          (dimensions && 'maxHeight' in dimensions && dimensions.maxHeight) ||
            DEFAULT_HEIGHT,
          DEFAULT_HEIGHT,
        );
  document.documentElement.style.setProperty('--app-height', `${height}px`);
};

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const root = createRoot(document.getElementById('root') as HTMLElement);
const render = (node: ReactNode) =>
  root.render(<StrictMode>{node}</StrictMode>);
const status = (text: string) =>
  render(
    <MutedText role="status" className="p-4">
      {text}
    </MutedText>,
  );

async function main() {
  applyHostContext(undefined);
  status('Connecting…');

  const app = new App({ name: 'policy-editor', version: '0.2.0' });
  const open = createOpenState(app);
  app.ontoolinput = (params) => open.toolInput(params.arguments);
  app.ontoolresult = (result) => open.toolResult(result);
  app.onhostcontextchanged = (changed) => {
    if (changed.containerDimensions) applyHostContext(changed);
  };

  try {
    await app.connect();
  } catch (error) {
    status(`Could not connect to the host: ${errorText(error)}`);
    return;
  }
  applyHostContext(app.getHostContext());

  status('Loading…');
  const { name, permissions } = await open.resolve();
  render(
    <PolicyEditorApp
      app={app}
      source={createMcpPolicySource(app)}
      permissions={permissions}
      initialName={name}
    />,
  );
}

void main();
