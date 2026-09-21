import { render } from '@testing-library/react';
import {
  PassageLoader,
  type PassageSource,
} from '@eightyfourthousand/lib-doc-model';

import { PassageStackController } from './PassageStackController';
import { StaticPassageRow } from './StaticPassageRow';
import { createStackWorkDocument } from './stack-work';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const source = (): PassageSource => ({
  name: 'test',
  loadPassages: async (_workUuid, uuids) =>
    uuids.map((uuid) => ({
      uuid,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'some text' }] },
      ],
    })),
});

const build = (readOnly = false) => {
  const work = createStackWorkDocument({
    workUuid: 'work-1',
    loader: new PassageLoader({ sources: [source()], buffer: 0 }),
  });
  work.seedSpine([{ uuid: 'p0', label: '1', type: 'translation' }]);
  return new PassageStackController({ work, readOnly });
};

const meta = {
  uuid: 'p0',
  label: '1',
  type: 'translation',
  panel: 'main',
  tab: 'translation',
} as const;

const bookmark = (uuid: string) =>
  localStorage.setItem(
    'library',
    JSON.stringify([{ type: 'passage', tab: '', uuid, label: '1', body: '' }]),
  );

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('StaticPassageRow', () => {
  it('shows a placeholder while the passage has no document', () => {
    const controller = build();
    const { container } = render(
      <StaticPassageRow
        controller={controller}
        meta={{
          uuid: 'p0',
          label: '1',
          type: 'translation',
          panel: 'main',
          tab: 'translation',
        }}
      />,
    );

    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(container.querySelector('.tiptap')).toBeNull();
  });

  // Regression guard. Focusing a passage makes it and both neighbours live, so
  // three rows swap from this tier to a mounted editor at once. A mounted
  // editor's content element carries `.ProseMirror`, which brings
  // `white-space: break-spaces` and disabled ligatures; without a matching
  // rule here the text re-wraps on the swap and every line below it jumps.
  //
  // jsdom computes no layout, so this cannot assert the heights match — only
  // that the static tier still opts into the shared metrics. The height parity
  // itself was verified in a browser against toh145.
  it('opts into ProseMirror text metrics so the editor swap does not re-wrap', async () => {
    const controller = build();
    controller.setVisibleRange({ start: 0, end: 1 });
    await flush();

    const { container } = render(
      <StaticPassageRow
        controller={controller}
        meta={{
          uuid: 'p0',
          label: '1',
          type: 'translation',
          panel: 'main',
          tab: 'translation',
        }}
      />,
    );

    const content = container.querySelector('.tiptap');
    expect(content).not.toBeNull();
    expect(content?.classList.contains('pm-text-metrics')).toBe(true);
  });

  // The label menu finds its trigger by these attributes; deep links resolve a
  // passage by id, then the content class inside it.
  it('carries the passage chrome the label menu and deep links key off', () => {
    const controller = build();
    const { container } = render(
      <StaticPassageRow
        controller={controller}
        meta={{
          uuid: 'p0',
          label: '1',
          type: 'translation',
          panel: 'main',
          tab: 'translation',
        }}
      />,
    );

    expect(container.querySelector('#p0')).not.toBeNull();

    const label = container.querySelector('[data-passage-label]');
    expect(label?.getAttribute('data-uuid')).toBe('p0');
    expect(label?.textContent).toBe('1');
    expect(label?.classList.contains('labeled')).toBe(true);

    expect(container.querySelector('.passage.is-editable')).not.toBeNull();
  });

  // Reader chrome: production paints it from `syncPassageChrome`, which shows
  // it only when the editor is not editable.
  describe('the bookmark indicator', () => {
    afterEach(() => localStorage.clear());

    it('marks a bookmarked passage in a read-only stack', () => {
      bookmark('p0');
      const { container } = render(
        <StaticPassageRow controller={build(true)} meta={meta} />,
      );
      expect(container.querySelector('.lucide-bookmark')).not.toBeNull();
    });

    it('stays hidden in an editable stack', () => {
      bookmark('p0');
      const { container } = render(
        <StaticPassageRow controller={build()} meta={meta} />,
      );
      expect(container.querySelector('.lucide-bookmark')).toBeNull();
    });

    it('stays hidden for a passage nobody bookmarked', () => {
      bookmark('somewhere-else');
      const { container } = render(
        <StaticPassageRow controller={build(true)} meta={meta} />,
      );
      expect(container.querySelector('.lucide-bookmark')).toBeNull();
    });
  });
});

/**
 * The passage-selection highlight.
 *
 * Drawn by the stack, because a passage selection is not a DOM selection and
 * nothing paints it otherwise — and drawn as its own layer, because the
 * content box's padding sets the text column and changing it to make room
 * would re-wrap every row.
 */
describe('StaticPassageRow selection highlight', () => {
  const highlight = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[aria-hidden].absolute.rounded-sm');

  it('draws nothing when the passage is not selected', async () => {
    const controller = build();
    controller.setVisibleRange({ start: 0, end: 1 });
    await flush();

    const { container } = render(
      <StaticPassageRow controller={controller} meta={meta} />,
    );

    expect(highlight(container)).toBeNull();
    expect(
      container
        .querySelector('[data-stack-passage]')
        ?.getAttribute('data-stack-selected'),
    ).toBeNull();
  });

  it('draws the highlight behind the content when selected', async () => {
    const controller = build();
    controller.setVisibleRange({ start: 0, end: 1 });
    await flush();

    const { container } = render(
      <StaticPassageRow controller={controller} meta={meta} selected />,
    );

    const layer = highlight(container);
    const content = container.querySelector('.tiptap');
    expect(layer).not.toBeNull();
    expect(content).not.toBeNull();

    // Before the content in document order, so the text paints over it.
    const relation = (layer as HTMLElement).compareDocumentPosition(
      content as Node,
    );
    expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the highlight off the content box, so the text column is unmoved', async () => {
    const controller = build();
    controller.setVisibleRange({ start: 0, end: 1 });
    await flush();

    const plain = render(
      <StaticPassageRow controller={controller} meta={meta} />,
    );
    const chosen = render(
      <StaticPassageRow controller={controller} meta={meta} selected />,
    );

    const contentClasses = (container: HTMLElement) =>
      [...(container.querySelector('.tiptap')?.parentElement?.classList ?? [])]
        // `relative` only stacks the content above the highlight; it moves
        // nothing.
        .filter((name) => name !== 'relative')
        .sort();

    expect(contentClasses(chosen.container)).toEqual(
      contentClasses(plain.container),
    );
  });

  it('insets the highlight from the label gutter and extends it past the text', async () => {
    const controller = build();
    controller.setVisibleRange({ start: 0, end: 1 });
    await flush();

    const { container } = render(
      <StaticPassageRow controller={controller} meta={meta} selected />,
    );

    const classes = highlight(container)?.className ?? '';
    expect(classes).toContain('left-3');
    expect(classes).toContain('-right-3');
  });
});
