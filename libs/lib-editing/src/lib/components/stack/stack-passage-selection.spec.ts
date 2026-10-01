import {
  passageFromNode,
  PassageLoader,
} from '@eightyfourthousand/lib-doc-model';

import { PassageStackController } from './PassageStackController';
import { flush, source } from './stack-controller.fixture';
import { createStackWorkDocument } from './stack-work';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

describe('PassageStackController passage selection', () => {
  /** A passage whose text carries an annotation, so loss is visible. */
  const annotated = (uuid: string, label: string, text: string) => ({
    meta: { uuid, label, type: 'translation' },
    content: [
      {
        type: 'paragraph',
        attrs: { uuid: `${uuid}-p`, type: 'paragraph', invalid: false },
        content: [
          {
            type: 'text',
            text,
            marks: [
              { type: 'bold', attrs: { uuid: `${uuid}-m`, invalid: false } },
            ],
          },
        ],
      },
    ],
    charCount: text.length,
  });

  const withMarks = async () => {
    const all = [
      annotated('p0', '1', 'alpha'),
      annotated('p1', '2', 'bravo'),
      annotated('p2', '3', 'charlie'),
      annotated('p3', '4', 'delta'),
    ];
    const work = createStackWorkDocument({
      workUuid: 'work-1',
      loader: new PassageLoader({ sources: [source(all)], buffer: 0 }),
    });
    work.seedSpine(all.map((entry) => entry.meta));
    const controller = new PassageStackController({ work });
    controller.setVisibleRange({ start: 0, end: all.length });
    await flush();
    return { work, controller };
  };

  it('selects the whole run between the two ends', async () => {
    const { controller } = await withMarks();
    controller.setPassageSelection('p1', 'p2');

    expect(controller.selectedUuids()).toEqual(['p1', 'p2']);
    expect(controller.isSelected('p0')).toBe(false);
    expect(controller.isSelected('p1')).toBe(true);
  });

  it('selects the same run when dragged backwards', async () => {
    const { controller } = await withMarks();
    controller.setPassageSelection('p2', 'p1');

    expect(controller.selectedUuids()).toEqual(['p1', 'p2']);
  });

  it('serializes the selected passages as rich content', async () => {
    const { controller } = await withMarks();
    controller.setPassageSelection('p1', 'p2');

    const copied = controller.serializePassageSelection();

    expect(copied?.text).toBe('bravo\n\ncharlie');
    expect(copied?.html).toContain('<strong');
  });

  it('deletes the selected passages in one command', async () => {
    const { work, controller } = await withMarks();
    controller.setPassageSelection('p1', 'p2');

    expect(controller.deletePassageSelection()).toBe(true);

    expect(work.spine.uuids()).toEqual(['p0', 'p3']);
    expect(work.log.depth).toBe(1);
    expect(controller.hasPassageSelection()).toBe(false);
  });

  it('undoes a delete of the selection in one step', async () => {
    const { work, controller } = await withMarks();
    controller.setPassageSelection('p1', 'p2');
    controller.deletePassageSelection();

    work.undo();

    expect(work.spine.uuids()).toEqual(['p0', 'p1', 'p2', 'p3']);
  });

  it('pastes the copied passages back as passages, annotations intact', async () => {
    const { work, controller } = await withMarks();
    controller.setPassageSelection('p1', 'p2');
    const copied = controller.serializePassageSelection();

    controller.setPassageSelection('p1', 'p2');
    expect(
      controller.pastePassageSelection({
        html: copied?.html ?? '',
        text: copied?.text ?? '',
      }),
    ).toBe(true);

    // Two passages in, two passages out, each still holding its own text.
    expect(work.spine.uuids().length).toBe(4);
    const texts = work.spine
      .uuids()
      .map((uuid) => work.store.ensure(uuid).toNode().textContent);
    expect(texts).toEqual(['alpha', 'bravo', 'charlie', 'delta']);

    const pasted = work.spine.uuids()[1];
    const bold = passageFromNode(work.store.ensure(pasted).toNode(), 'work-1', {
      uuid: pasted,
      type: 'translation',
      sort: 0,
      label: '2',
    }).annotations.filter(
      (annotation) =>
        annotation.type === 'span' && annotation.textStyle === 'text-bold',
    );
    expect(bold.map(({ start, end }) => [start, end])).toEqual([[0, 5]]);
  });

  it('renumbers the labels of what replaced the selection', async () => {
    const { work, controller } = await withMarks();
    controller.setPassageSelection('p1', 'p2');
    const copied = controller.serializePassageSelection();
    controller.setPassageSelection('p1', 'p2');
    controller.pastePassageSelection({
      html: copied?.html ?? '',
      text: copied?.text ?? '',
    });

    expect(work.spine.entries().map((entry) => entry.label)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
  });

  it('takes plain text as a single passage', async () => {
    const { work, controller } = await withMarks();
    controller.setPassageSelection('p1', 'p2');

    expect(
      controller.pastePassageSelection({ html: '', text: 'one\n\ntwo' }),
    ).toBe(true);

    expect(work.spine.uuids().length).toBe(3);
    expect(work.store.ensure(work.spine.uuids()[1]).toNode().textContent).toBe(
      'onetwo',
    );
  });

  it('lets go of the browser selection, so only one highlight is drawn', async () => {
    const { controller } = await withMarks();
    document.body.innerHTML = '<p id="t">some text</p>';
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('#t') as Node);
    const native = window.getSelection();
    native?.removeAllRanges();
    native?.addRange(range);
    expect(native?.isCollapsed).toBe(false);

    controller.setPassageSelection('p1', 'p2');

    expect(window.getSelection()?.rangeCount ?? 0).toBe(0);
  });

  it('clears the selection without touching the work', async () => {
    const { work, controller } = await withMarks();
    controller.setPassageSelection('p1', 'p2');

    controller.clearPassageSelection();

    expect(controller.hasPassageSelection()).toBe(false);
    expect(work.spine.uuids().length).toBe(4);
  });
});
