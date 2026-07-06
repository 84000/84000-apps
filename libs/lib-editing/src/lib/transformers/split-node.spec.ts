import { splitNode } from './split-node';
import type { TranslationEditorContentItem } from '../components/editor';

const textNode = (
  start: number,
  text: string,
): TranslationEditorContentItem => ({
  type: 'text',
  text,
  attrs: { start, end: start + text.length },
});

const mentionNode = (start: number, end: number) => ({
  type: 'mention',
  attrs: { start, end, items: [{ uuid: 'item-1' }] },
});

describe('splitNode', () => {
  it('splits a text node into prefix, middle, and suffix with correct offsets', () => {
    const { prefix, middle, suffix } = splitNode(
      textNode(0, '0123456789'),
      3,
      7,
    );

    expect(prefix).toEqual([
      expect.objectContaining({ text: '012', attrs: { start: 0, end: 3 } }),
    ]);
    expect(middle).toEqual([
      expect.objectContaining({ text: '3456', attrs: { start: 3, end: 7 } }),
    ]);
    expect(suffix).toEqual([
      expect.objectContaining({ text: '789', attrs: { start: 7, end: 10 } }),
    ]);
  });

  it('returns the whole node as prefix when it ends before the range', () => {
    const node = textNode(0, '01234');
    const { prefix, middle, suffix } = splitNode(node, 10, 20);

    expect(prefix).toEqual([node]);
    expect(middle).toEqual([]);
    expect(suffix).toEqual([]);
  });

  it('returns the whole node as suffix when it starts after the range', () => {
    const node = textNode(20, '01234');
    const { prefix, middle, suffix } = splitNode(node, 0, 10);

    expect(prefix).toEqual([]);
    expect(middle).toEqual([]);
    expect(suffix).toEqual([node]);
  });

  it('keeps an atomic textless node overlapping the range whole in the middle', () => {
    const node = mentionNode(10, 10);
    const { prefix, middle, suffix } = splitNode(node, 5, 15);

    expect(prefix).toEqual([]);
    expect(middle).toEqual([node]);
    expect(suffix).toEqual([]);
  });

  it('routes a textless node outside the range to prefix or suffix', () => {
    const before = mentionNode(3, 3);
    const after = mentionNode(20, 20);

    expect(splitNode(before, 5, 15).prefix).toEqual([before]);
    expect(splitNode(after, 5, 15).suffix).toEqual([after]);
  });
});
