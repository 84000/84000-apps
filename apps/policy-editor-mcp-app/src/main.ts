/**
 * Read-only shell of the policy editor MCP App: lists the policies and shows
 * one. The full editor replaces it.
 */
import {
  App,
  applyDocumentTheme,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps';
import { createMcpPolicySource } from './mcp-policy-source';
import { createOpenState } from './open-state';
import type { PolicyPermissions, PolicySource } from './policy-source.contract';

const element = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const status = element('status');
const badge = element('badge');
const list = element<HTMLUListElement>('list');
const detail = element('detail');

/** Host colours the stylesheet maps onto its own tokens. */
const HOST_COLORS = [
  '--color-background-primary',
  '--color-background-secondary',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-danger',
  '--color-border-primary',
] as const;

const applyHostContext = (context: McpUiHostContext | undefined) => {
  if (context?.theme) applyDocumentTheme(context.theme);
  const variables = context?.styles?.variables;
  for (const name of HOST_COLORS) {
    const value = variables?.[name];
    if (value) document.documentElement.style.setProperty(name, value);
  }
};

const setStatus = (text: string, tone: 'info' | 'error' = 'info') => {
  status.textContent = text;
  status.hidden = !text;
  status.classList.toggle('text-danger', tone === 'error');
  status.classList.toggle('text-muted', tone !== 'error');
};

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const badgeLabel = ({ read, edit, admin }: PolicyPermissions) => {
  if (!read) return 'No access';
  if (admin) return 'Admin';
  return edit ? 'Can edit' : 'Read-only';
};

let shown = 0;

async function showPolicy(source: PolicySource, name: string) {
  const request = ++shown;
  for (const item of list.querySelectorAll('button')) {
    item.toggleAttribute('aria-current', item.dataset.name === name);
  }
  setStatus(`Loading ${name}…`);
  try {
    const policy = await source.read(name);
    if (request !== shown) return;
    if (!policy) {
      detail.classList.replace('flex', 'hidden');
      setStatus(`${name} was not found.`, 'error');
      return;
    }
    element('title').textContent = policy.name;
    element('version').textContent = `version ${policy.version.slice(0, 12)}`;
    element('content').textContent = policy.content;
    detail.classList.replace('hidden', 'flex');
    setStatus('');
  } catch (error) {
    if (request === shown) setStatus(errorText(error), 'error');
  }
}

async function showList(source: PolicySource) {
  const names = await source.list();
  list.replaceChildren(
    ...names.map((name) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.name = name;
      button.textContent = name;
      button.className =
        'w-full truncate rounded px-2 py-1 text-left hover:bg-panel aria-[current]:bg-panel aria-[current]:font-semibold';
      button.addEventListener('click', () => void showPolicy(source, name));
      const item = document.createElement('li');
      item.append(button);
      return item;
    }),
  );
  return names;
}

async function main() {
  applyDocumentTheme(
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  const app = new App({ name: 'policy-editor', version: '0.1.0' });
  const open = createOpenState(app);
  app.ontoolinput = (params) => open.toolInput(params.arguments);
  app.ontoolresult = (result) => open.toolResult(result);
  app.onhostcontextchanged = applyHostContext;

  try {
    await app.connect();
  } catch (error) {
    setStatus(`Could not connect to the host: ${errorText(error)}`, 'error');
    return;
  }
  applyHostContext(app.getHostContext());

  setStatus('Loading…');
  const { name, permissions } = await open.resolve();
  badge.textContent = badgeLabel(permissions);
  if (!permissions.read) {
    setStatus('This account cannot read the policies.', 'error');
    return;
  }

  const source = createMcpPolicySource(app);
  try {
    const names = await showList(source);
    if (name) await showPolicy(source, name);
    else setStatus(names.length ? 'Select a policy.' : 'No policies yet.');
  } catch (error) {
    setStatus(errorText(error), 'error');
  }
}

void main();
