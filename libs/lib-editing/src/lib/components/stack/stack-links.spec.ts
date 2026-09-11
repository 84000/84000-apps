import { resolveStackLink } from './stack-links';

/** Build an element from the attributes an `*.ssr` renderer emits. */
const anchor = (tag: string, attrs: Record<string, string>, html = 'x') => {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('resolveStackLink', () => {
  it('ignores anything that is not a content link', () => {
    expect(resolveStackLink(anchor('span', { class: 'plain' }))).toBeNull();
  });

  it('sends a glossary instance to the glossary panel', () => {
    const el = anchor('span', {
      class: 'glossary-instance',
      type: 'glossaryInstance',
      glossary: 'g-1',
    });

    expect(resolveStackLink(el)).toEqual({
      kind: 'panel',
      panel: 'right',
      tab: 'glossary',
      hash: 'g-1',
    });
  });

  it('sends an endnote marker to the endnotes panel', () => {
    const el = anchor('sup', { type: 'endNoteLink', endNote: 'n-1' });

    expect(resolveStackLink(el)).toEqual({
      kind: 'panel',
      panel: 'right',
      tab: 'endnotes',
      hash: 'n-1',
    });
  });

  it('resolves from a node inside the link, not just the link itself', () => {
    const el = anchor(
      'sup',
      { type: 'endNoteLink', endNote: 'n-1' },
      '<b>1</b>',
    );

    expect(resolveStackLink(el.querySelector('b'))).toMatchObject({
      hash: 'n-1',
    });
  });

  it('routes a same-work passage link to the panel for its section', () => {
    const el = anchor('a', {
      type: 'internalLink',
      'data-same-work': 'true',
      entity: 'p-9',
      'entity-type': 'passage',
      'data-subtype': 'endnotesHeader',
    });

    // `endnotesHeader` names the endnotes section, as it does in a live editor.
    expect(resolveStackLink(el)).toMatchObject({
      panel: 'right',
      tab: 'endnotes',
      hash: 'p-9',
    });
  });

  it('falls back to the body for a passage link with no subtype', () => {
    const el = anchor('a', {
      type: 'internalLink',
      'data-same-work': 'true',
      entity: 'p-9',
      'entity-type': 'passage',
    });

    expect(resolveStackLink(el)).toMatchObject({
      panel: 'main',
      tab: 'translation',
      hash: 'p-9',
    });
  });

  it('carries the toh scope a link names', () => {
    const el = anchor('a', {
      type: 'internalLink',
      'data-same-work': 'true',
      entity: 'g-2',
      'entity-type': 'glossary',
      'data-link-toh': 'toh847',
    });

    expect(resolveStackLink(el)).toMatchObject({
      tab: 'glossary',
      hash: 'g-2',
      toh: 'toh847',
    });
  });

  it('carries a mention highlight range', () => {
    const el = anchor('a', {
      class: 'mention-link',
      'data-same-work': 'true',
      entity: 'p-3',
      'entity-type': 'passage',
      'data-subtype': 'translation',
      'data-highlight-start': '12',
      'data-highlight-end': '20',
    });

    expect(resolveStackLink(el)).toMatchObject({
      hash: 'p-3',
      highlight: { start: '12', end: '20' },
    });
  });

  it('reports no range when a link carries only one end of it', () => {
    const el = anchor('a', {
      class: 'mention-link',
      'data-same-work': 'true',
      entity: 'p-3',
      'entity-type': 'passage',
      'data-subtype': 'translation',
      'data-highlight-start': '12',
    });

    expect(resolveStackLink(el)?.kind === 'panel').toBe(true);
    expect(
      (resolveStackLink(el) as { highlight?: unknown }).highlight,
    ).toBeUndefined();
  });

  it('sends a cross-work link to a new tab', () => {
    const el = anchor('a', {
      type: 'internalLink',
      entity: 'w-1',
      'entity-type': 'passage',
      href: '/entity/passage/w-1',
    });

    expect(resolveStackLink(el)).toEqual({
      kind: 'external',
      href: '/entity/passage/w-1',
    });
  });

  it('asks a cross-work link to open for editing outside the reader', () => {
    const el = anchor('a', {
      type: 'internalLink',
      entity: 'w-1',
      'entity-type': 'passage',
      href: '/entity/passage/w-1',
    });

    expect(resolveStackLink(el, { editable: true })).toEqual({
      kind: 'external',
      href: '/entity/passage/w-1?edit=true',
    });
  });

  it('leaves a link alone rather than routing an entity type it does not know', () => {
    const el = anchor('a', {
      type: 'internalLink',
      'data-same-work': 'true',
      entity: 'x-1',
      'entity-type': 'somethingNew',
    });

    expect(resolveStackLink(el)).toBeNull();
  });

  it('does not claim a cross-work mention, which navigates on its own href', () => {
    const el = anchor('a', {
      class: 'mention-link',
      entity: 'w-2',
      'entity-type': 'work',
      href: '/entity/work/w-2',
      target: '_blank',
    });

    expect(resolveStackLink(el)).toBeNull();
  });
});
