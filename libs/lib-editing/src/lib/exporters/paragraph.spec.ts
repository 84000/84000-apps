import type { Node } from '@tiptap/pm/model';
import { paragraph } from './paragraph';
import { annotationExportsFromNode } from './annotation';

describe('paragraph exporter', () => {
  it('should export paragraph annotation correctly', () => {
    const parent = {
      attrs: {
        uuid: 'parent-uuid-5678',
      },
    } as unknown as Node;

    const node = {
      attrs: {
        uuid: 'paragraph-uuid-1234',
      },
      textContent: 'This is a paragraph of text.',
    } as unknown as Node;

    const result = paragraph({
      node,
      parent,
      root: parent,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'paragraph-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'paragraph',
      start: 0,
      end: 28,
    });
  });

  it('should return undefined when paragraph uuid matches parent uuid', () => {
    const parent = {
      attrs: {
        uuid: 'same-uuid-1234',
      },
    } as unknown as Node;

    const node = {
      attrs: {
        uuid: 'same-uuid-1234',
      },
      textContent: 'This is a paragraph.',
    } as unknown as Node;

    const result = paragraph({
      node,
      parent,
      root: parent,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });

  it('should return undefined when textContent is empty', () => {
    const parent = {
      attrs: {
        uuid: 'parent-uuid-5678',
      },
    } as unknown as Node;

    const node = {
      attrs: {
        uuid: 'paragraph-uuid-empty',
      },
      textContent: '',
    } as unknown as Node;

    const result = paragraph({
      node,
      parent,
      root: parent,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});

describe('annotationExportsFromNode — null UUID guard', () => {
  it('should produce no annotation and emit a warning when a paragraph node has no uuid', () => {
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const parent = {
      attrs: { uuid: 'passage-uuid-1234' },
      marks: [],
      type: { name: 'passage' },
      content: { size: 0, childCount: 0, forEach: () => undefined },
    } as unknown as Node;

    // Simulate a freshly-split paragraph whose UUID has not yet been assigned
    // by the NodeView mount cycle (uuid: null, as set by TranslationMetadata default).
    const nullUuidParagraph = {
      attrs: { uuid: null },
      marks: [],
      type: { name: 'paragraph' },
      textContent: 'Hello world',
      content: { size: 0, childCount: 0, forEach: () => undefined },
    } as unknown as Node;

    const annotations = annotationExportsFromNode({
      passageUuid: 'passage-uuid-1234',
      node: nullUuidParagraph,
      parent,
      root: parent,
      start: 0,
    });

    // The paragraph annotation must be absent — no annotation for a uuid-less node.
    expect(annotations.filter((a) => a.type === 'paragraph')).toHaveLength(0);

    // A warning must be emitted so the issue is visible in development.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('missing a uuid'),
    );

    warnSpy.mockRestore();
  });

  it('should produce a paragraph annotation when the paragraph node has a valid uuid', () => {
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const parent = {
      attrs: { uuid: 'passage-uuid-1234' },
      marks: [],
      type: { name: 'passage' },
      content: { size: 0, childCount: 0, forEach: () => undefined },
    } as unknown as Node;

    const paragraphNode = {
      attrs: { uuid: 'paragraph-uuid-abcd' },
      marks: [],
      type: { name: 'paragraph' },
      textContent: 'Hello world',
      content: { size: 0, childCount: 0, forEach: () => undefined },
    } as unknown as Node;

    const annotations = annotationExportsFromNode({
      passageUuid: 'passage-uuid-1234',
      node: paragraphNode,
      parent,
      root: parent,
      start: 0,
    });

    const paragraphAnnotations = annotations.filter(
      (a) => a.type === 'paragraph',
    );
    expect(paragraphAnnotations).toHaveLength(1);
    expect(paragraphAnnotations[0]).toMatchObject({
      uuid: 'paragraph-uuid-abcd',
      type: 'paragraph',
      passageUuid: 'passage-uuid-1234',
      start: 0,
      end: 11,
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
