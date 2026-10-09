import {
  MCP_INSTRUCTIONS_MAX_LENGTH,
  joinInstructions,
  publicInstructions,
  readToolInstructions,
  studioInstructions,
} from './instructions';
import { createFeedbackTools } from './tools/feedback';
import type { LinearFeedbackConfig } from './tools/feedback';
import {
  createHarnessTools,
  createOpenPolicyEditorTool,
} from './tools/harness';
import { createReadTools } from './tools/read';
import { createSessionTools } from './tools/sessions';
import { createWriteTools } from './tools/write';
import type { DataClient } from '@eightyfourthousand/data-access';

// The tool factories only read these at module scope, to build zod enums;
// nothing here calls a handler. Mocking the data layer keeps the registry
// importable without dragging `next/server` in through lib-search.
jest.mock('@eightyfourthousand/data-access', () => ({
  FOLIO_SIDES: ['a', 'b'],
  CONTENT_SOURCES: ['draft', 'published'],
  SESSION_STAGES: ['stage0', 'stage1'],
}));
jest.mock('@eightyfourthousand/data-access/ssr', () => ({}));
jest.mock('@eightyfourthousand/lib-search', () => ({}));

const client = {} as DataClient;
const instructions = readToolInstructions({ translations: 'a corpus' });

// Tool names in the prose are written as `backticked-kebab-case`.
const mentionedTools = (text: string) =>
  [...text.matchAll(/`([a-z-]+)`/g)]
    .map((match) => match[1])
    .filter((name) => name.includes('-'));

describe('readToolInstructions', () => {
  it('places the deployment’s corpus scope in the content summary', () => {
    expect(
      readToolInstructions({ translations: 'published translations only' }),
    ).toContain('Translations (published translations only)');
  });

  it('names every tool a client needs to escalate a glossary lookup', () => {
    for (const tool of [
      'search-canon-sections',
      'search-canon-section-glossary',
      'resolve-toh',
      'get-translation',
      'search-translation',
    ]) {
      expect(instructions).toContain(tool);
    }
  });

  it('only names tools the server actually registers', () => {
    const registered = new Set(createReadTools(client).map((t) => t.name));
    expect(
      mentionedTools(instructions).filter((name) => !registered.has(name)),
    ).toEqual([]);
  });

  it('does not claim a library-wide glossary search exists', () => {
    // The instructions on both servers once asserted "find terms across the
    // entire library" while the tool required a workUuid, so a client believed
    // it had checked the house glossary when it had checked one work.
    expect(instructions).toContain('There is no library-wide glossary search');
    expect(instructions).not.toMatch(/across the entire library/);
  });
});

describe('server instructions', () => {
  it.each([
    ['studio', studioInstructions],
    ['public', publicInstructions],
  ])('%s instructions fit before clients truncate them', (_, text) => {
    expect(text.length).toBeLessThanOrEqual(MCP_INSTRUCTIONS_MAX_LENGTH);
  });

  it('studio instructions only name tools the studio registers', () => {
    const registered = new Set(
      [
        ...createReadTools(client),
        ...createHarnessTools(client),
        createOpenPolicyEditorTool(client),
        ...createSessionTools(client, 'user'),
        ...createFeedbackTools({
          client,
          submitter: { userId: 'user', email: 'user@84000.co' },
          linear: {} as LinearFeedbackConfig,
        }),
        ...createWriteTools(client),
      ].map((t) => t.name),
    );
    expect(
      mentionedTools(studioInstructions).filter((n) => !registered.has(n)),
    ).toEqual([]);
  });

  it('studio instructions lead with live policies', () => {
    expect(studioInstructions.indexOf('`read-policies`')).toBeLessThan(
      studioInstructions.indexOf('## Content'),
    );
  });
});

describe('joinInstructions', () => {
  it('separates sections by a blank line, in order', () => {
    expect(joinInstructions(['## One', '## Two'])).toBe('## One\n\n## Two');
  });

  it('drops empty sections so an absent one leaves no gap', () => {
    expect(joinInstructions(['## One', '', '## Two'])).toBe('## One\n\n## Two');
  });
});
