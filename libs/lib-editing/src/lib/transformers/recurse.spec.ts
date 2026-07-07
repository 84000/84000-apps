import { Annotation } from '@eightyfourthousand/data-access';
import { markUnplaceable, recurse } from './recurse';
import type { TranslationEditorContentItem } from '../components/editor';

const textNode = (
  start: number,
  end: number,
  text: string,
): TranslationEditorContentItem => ({
  type: 'text',
  text,
  attrs: { start, end },
});

const paragraph = (
  start: number,
  end: number,
  content: TranslationEditorContentItem[],
): TranslationEditorContentItem => ({
  type: 'paragraph',
  attrs: { start, end, uuid: 'para-1' },
  content,
});

const spanAnnotation = (start: number, end: number): Annotation =>
  ({
    uuid: 'ann-1',
    passageUuid: 'passage-1',
    type: 'span',
    start,
    end,
    validated: true,
  }) as Annotation;

describe('recurse', () => {
  it('fires the transform on a single node containing the range', () => {
    const block = paragraph(0, 20, [textNode(0, 20, 'a'.repeat(20))]);
    const transform = jest.fn();

    const matched = recurse({
      block,
      annotation: spanAnnotation(5, 10),
      until: ['text'],
      transform,
    });

    expect(matched).toBe(true);
    expect(transform).toHaveBeenCalledTimes(1);
    expect(transform.mock.calls[0][0].block.type).toBe('text');
  });

  it('falls back to sibling coverage when the range straddles a split boundary', () => {
    const first = textNode(0, 10, 'a'.repeat(10));
    const second = textNode(10, 20, 'b'.repeat(10));
    const block = paragraph(0, 20, [first, second]);
    const transform = jest.fn();

    const matched = recurse({
      block,
      annotation: spanAnnotation(5, 15),
      until: ['text'],
      transform,
    });

    expect(matched).toBe(true);
    expect(transform).toHaveBeenCalledTimes(1);
    // The fallback hands the first covering sibling to the transform with the
    // containing block as parent, so splitContent can split every sibling.
    expect(transform.mock.calls[0][0].block).toBe(first);
    expect(transform.mock.calls[0][0].parent).toBe(block);
  });

  it('does not fall back for block-level until types', () => {
    const lines = [
      {
        type: 'line',
        attrs: { start: 0, end: 10 },
        content: [textNode(0, 10, 'a'.repeat(10))],
      },
      {
        type: 'line',
        attrs: { start: 10, end: 20 },
        content: [textNode(10, 20, 'b'.repeat(10))],
      },
    ];
    const block = {
      type: 'lineGroup',
      attrs: { start: 0, end: 20 },
      content: lines,
    };
    const transform = jest.fn();

    const matched = recurse({
      block,
      annotation: spanAnnotation(5, 15),
      until: ['line'],
      transform,
    });

    expect(matched).toBe(false);
    expect(transform).not.toHaveBeenCalled();
  });

  it('does not fall back when the siblings do not cover the range boundaries', () => {
    // A gap: the covered children end at 10 but the annotation runs to 15.
    const block = paragraph(0, 20, [
      textNode(0, 10, 'a'.repeat(10)),
      { type: 'mention', attrs: { start: 10, end: 20 } },
    ]);
    const transform = jest.fn();

    const matched = recurse({
      block,
      annotation: spanAnnotation(5, 15),
      until: ['text'],
      transform,
    });

    expect(matched).toBe(false);
    expect(transform).not.toHaveBeenCalled();
  });

  it('fires the fallback at the deepest block containing the range', () => {
    const inner = paragraph(0, 20, [
      textNode(0, 10, 'a'.repeat(10)),
      textNode(10, 20, 'b'.repeat(10)),
    ]);
    const outer: TranslationEditorContentItem = {
      type: 'blockquote',
      attrs: { start: 0, end: 20 },
      content: [inner],
    };
    const transform = jest.fn();

    const matched = recurse({
      block: outer,
      annotation: spanAnnotation(5, 15),
      until: ['text'],
      transform,
    });

    expect(matched).toBe(true);
    expect(transform.mock.calls[0][0].parent).toBe(inner);
  });
});

describe('markUnplaceable', () => {
  it('warns and invalidates the annotation', () => {
    const consoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const annotation = spanAnnotation(5, 15);

    markUnplaceable(annotation);

    expect(annotation.validated).toBe(false);
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });
});
