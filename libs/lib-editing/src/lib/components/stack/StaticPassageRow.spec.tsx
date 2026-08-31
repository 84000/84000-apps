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

const build = () => {
  const work = createStackWorkDocument({
    workUuid: 'work-1',
    loader: new PassageLoader({ sources: [source()], buffer: 0 }),
  });
  work.seedSpine([{ uuid: 'p0', label: '1', type: 'translation' }]);
  return new PassageStackController({ work });
};

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
});
