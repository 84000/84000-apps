import { joinInstructions, readToolInstructions } from './instructions';
import { createReadTools } from './tools/read';
import type { DataClient } from '@eightyfourthousand/data-access';

// The tool factories only read these two at module scope, to build zod enums;
// nothing here calls a handler. Mocking the data layer keeps the registry
// importable without dragging `next/server` in through lib-search.
jest.mock('@eightyfourthousand/data-access', () => ({
  FOLIO_SIDES: ['a', 'b'],
  CONTENT_SOURCES: ['draft', 'published'],
}));
jest.mock('@eightyfourthousand/data-access/ssr', () => ({}));
jest.mock('@eightyfourthousand/lib-search', () => ({}));

const instructions = readToolInstructions({ translations: 'a corpus' });

describe('readToolInstructions', () => {
  it('places the deployment’s corpus scope in the Translations bullet', () => {
    expect(
      readToolInstructions({ translations: 'published translations only' }),
    ).toContain('- **Translations** — published translations only');
  });

  it('names every tool a client needs to escalate a glossary lookup', () => {
    for (const tool of [
      'search-canon-sections',
      'search-canon-section-glossary',
      'resolve-toh',
      'get-translation-folios',
      'get-translation',
      'search-translation',
    ]) {
      expect(instructions).toContain(tool);
    }
  });

  it('only names tools the server actually registers', () => {
    const registered = new Set(
      createReadTools({} as DataClient).map((tool) => tool.name),
    );

    // Tool names in the prose are written as `backticked-kebab-case`.
    const mentioned = [...instructions.matchAll(/`([a-z-]+)`/g)].map(
      (match) => match[1],
    );
    const unknown = mentioned.filter(
      (name) => name.includes('-') && !registered.has(name),
    );

    expect(unknown).toEqual([]);
  });

  it('does not claim a library-wide glossary search exists', () => {
    // The instructions on both servers asserted "find terms across the entire
    // library" while the tool required a workUuid, so a client believed it had
    // checked the house glossary when it had checked one work. The escalation is
    // the canonical section, and this text is the only place that says so.
    expect(instructions).toContain('There is no library-wide glossary search');
    expect(instructions).not.toMatch(/across the entire library/);
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
