/**
 * Acceptance test for DEV-883 rows criterion 2: each row shows its English
 * name and its other names with their languages, and the names can't be
 * edited in the row (that is the entry panel, DEV-884).
 *
 * Written from the spec (TASK.md, CONTRACT.md), not the implementation.
 */
import { render, screen } from '@testing-library/react';

import { GlossaryRowNames } from './glossary-row';
import { entryOf, nameOf } from './glossary-work.fixture';

// See PassageStackController.spec.ts: building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => ({}),
}));

const ENTRY = entryOf({
  uuid: 'g1',
  termNumber: 1,
  definition: '<p>A great one.</p>',
  names: [
    nameOf('g1', 'en', 'great being', { termType: 'translationMain' }),
    nameOf('g1', 'en', 'great hero', { termType: 'translationAlternative' }),
    nameOf('g1', 'Sa-Ltn', 'mahāsattva'),
    nameOf('g1', 'Bo-Ltn', 'sems dpa’ chen po', {
      contentTransformed: 'སེམས་དཔའ་ཆེན་པོ།',
    }),
  ],
});

describe('criterion 2: names are read-only in the row', () => {
  it('criterion 2: shows the English name', () => {
    render(<GlossaryRowNames entry={ENTRY} />);

    expect(screen.getByText(/great being/)).toBeTruthy();
  });

  it('criterion 2: shows the other names, with the language of each', () => {
    const { container } = render(<GlossaryRowNames entry={ENTRY} />);
    const shown = container.textContent ?? '';

    expect(shown).toContain('great hero');
    expect(shown).toContain('mahāsattva');
    // Tibetan shows as Wylie, as the script, or both.
    expect(shown).toMatch(/sems dpa’ chen po|སེམས་དཔའ་ཆེན་པོ།/);
    expect(shown).toMatch(/sanskrit|sa-ltn/i);
    expect(shown).toMatch(/tibetan|bo-ltn/i);
  });

  it('criterion 2: offers nothing to type into', () => {
    const { container } = render(<GlossaryRowNames entry={ENTRY} />);

    expect(
      container.querySelector(
        'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]',
      ),
    ).toBeNull();
  });

  it('criterion 2: shows an entry with only an English name', () => {
    const entry = entryOf({
      uuid: 'g2',
      termNumber: 2,
      definition: null,
      english: 'ceremony',
    });
    const { container } = render(<GlossaryRowNames entry={entry} />);

    expect(container.textContent).toContain('ceremony');
  });
});
