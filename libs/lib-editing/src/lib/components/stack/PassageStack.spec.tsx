import { act, render } from '@testing-library/react';
import { PassageLoader } from '@eightyfourthousand/lib-doc-model';

import { PassageStack } from './PassageStack';
import { PassageStackController } from './PassageStackController';
import { createStackWorkDocument } from './stack-work';
import { flush, seeds, source } from './stack-controller.fixture';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));
// The footer's image needs Next's loader.
jest.mock('@eightyfourthousand/design-system', () => ({
  ...jest.requireActual('@eightyfourthousand/design-system'),
  LotusPond: () => null,
}));

// jsdom has no ResizeObserver; nothing here depends on sizes.
beforeAll(() => {
  global.ResizeObserver = class {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  } as unknown as typeof ResizeObserver;
});

const controllerFor = (readOnly: boolean) => {
  const all = seeds(2);
  const work = createStackWorkDocument({
    workUuid: 'work-1',
    loader: new PassageLoader({ sources: [source(all)], buffer: 0 }),
  });
  work.seedSpine(all.map((entry) => entry.meta));
  return new PassageStackController({ work, readOnly });
};

// The paginated editor keeps browser translation out while editable: a
// translated text node is a change ProseMirror reads back as the user's edit.
describe('PassageStack translation', () => {
  it('opts out of page translation in an editable stack', async () => {
    const { container } = render(
      <PassageStack controller={controllerFor(false)} />,
    );
    await act(flush);
    expect(container.firstElementChild?.getAttribute('translate')).toBe('no');
  });

  it('allows it in a read-only stack', async () => {
    const { container } = render(
      <PassageStack controller={controllerFor(true)} />,
    );
    await act(flush);
    expect(container.firstElementChild?.getAttribute('translate')).toBe('yes');
  });
});
