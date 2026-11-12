import { render, screen } from '@testing-library/react';
import type {
  GlossaryEntry,
  GlossaryEntryName,
} from '@eightyfourthousand/data-access';

import {
  GlossaryRowNames,
  englishNameOf,
  glossaryRowChrome,
} from './glossary-row';
import type { StackController } from './StackController';

// See PassageStackController.spec.ts — the stack's barrels reach
// `data-access/ssr`, which leaks these.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const name = (
  nameUuid: string,
  language: string | null,
  content: string,
  extra: Partial<GlossaryEntryName> = {},
): GlossaryEntryName => ({
  glossaryUuid: `g-${nameUuid}`,
  nameUuid,
  nameAuthorityUuid: `a-${nameUuid}`,
  language,
  content,
  contentTransformed: null,
  termType: 'translationMain',
  attestation: null,
  ...extra,
});

const ENTRY: GlossaryEntry = {
  uuid: 'e1',
  workUuid: 'w1',
  authorityUuid: 'a1',
  definition: '<p>A god.</p>',
  definitionRend: null,
  glossMode: 'match',
  names: [
    name('n1', 'en', 'Indra'),
    name('n2', 'Bo-Ltn', 'brgya byin', { contentTransformed: 'བརྒྱ་བྱིན།' }),
    name('n3', 'Sa-Ltn', 'indra'),
    name('n4', 'en', 'Śakra', { termType: 'translationAlternative' }),
    name('n5', null, 'unlabelled'),
  ],
};

describe('englishNameOf', () => {
  it('is the main English name, not an alternative listed first', () => {
    const names = [ENTRY.names[3], ...ENTRY.names.slice(0, 3)];
    expect(englishNameOf({ ...ENTRY, names })?.content).toBe('Indra');
  });

  it('falls back to any English name, then to none', () => {
    expect(englishNameOf({ ...ENTRY, names: [ENTRY.names[3]] })?.content).toBe(
      'Śakra',
    );
    expect(
      englishNameOf({ ...ENTRY, names: [ENTRY.names[2]] }),
    ).toBeUndefined();
  });
});

describe('GlossaryRowNames', () => {
  it('shows the English name and the others with their languages', () => {
    render(<GlossaryRowNames entry={ENTRY} />);
    expect(screen.getByText('Indra').className).toContain('font-bold');
    expect(screen.getByText('Tibetan')).toBeTruthy();
    expect(screen.getByText('བརྒྱ་བྱིན།')).toBeTruthy();
    expect(screen.getByText('brgya byin')).toBeTruthy();
    expect(screen.getByText('Sanskrit')).toBeTruthy();
    expect(screen.getByText('indra')).toBeTruthy();
    expect(screen.getByText('Alternative')).toBeTruthy();
    expect(screen.getByText('Śakra')).toBeTruthy();
    expect(screen.getByText('Unknown language')).toBeTruthy();
  });

  it('labels each name with its language alone, not its script', () => {
    const names = [
      name('n1', 'en', 'Indra'),
      name('n6', 'zh', '帝釋'),
      name('n7', 'Zh-Ltn', 'dìshì'),
      name('n8', 'ja', 'たいしゃく'),
      name('n9', 'Mt-Ltn', 'qurmusta'),
      name('n10', 'Pi-Ltn', 'sakka'),
    ];
    render(<GlossaryRowNames entry={{ ...ENTRY, names }} />);
    const labels = [...document.querySelectorAll('li > span:first-child')].map(
      (label) => label.textContent,
    );
    expect(labels).toEqual([
      'Chinese',
      'Chinese',
      'Japanese',
      'Mongolian',
      'Pali',
    ]);
  });

  it('draws nothing an editor could type into', () => {
    const { container } = render(<GlossaryRowNames entry={ENTRY} />);
    expect(
      container.querySelector('input, textarea, [contenteditable="true"]'),
    ).toBeNull();
  });
});

describe('glossaryRowChrome', () => {
  const controller = (rows: string, entry: GlossaryEntry | null) =>
    ({
      getRows: () => rows,
      getGlossaryEntry: () => entry,
    }) as unknown as StackController;

  it('draws names above a glossary row', () => {
    const chrome = glossaryRowChrome(controller('glossary', ENTRY), 'e1');
    expect(chrome.header).toBeDefined();
  });

  it('draws nothing around other rows, or an entry not read yet', () => {
    expect(glossaryRowChrome(controller('passages', ENTRY), 'e1')).toEqual({});
    expect(glossaryRowChrome(controller('glossary', null), 'e1')).toEqual({});
  });
});
