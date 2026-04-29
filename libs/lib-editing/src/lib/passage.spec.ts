import { ensureUuids } from './passage';

type FakeNode = {
  attrs: Record<string, unknown>;
  content?: FakeNode[];
  marks?: unknown[];
  type: { name: string };
};

const createFakeEditor = (nodes: FakeNode[]) => {
  const setNodeMarkup = jest.fn();
  const dispatch = jest.fn();
  let pos = 0;
  const walk = (
    node: FakeNode,
    callback: (node: FakeNode, pos: number) => boolean,
  ) => {
    const currentPos = pos;
    pos += 1;
    const shouldDescend = callback(node, currentPos);
    if (shouldDescend) {
      node.content?.forEach((child) => walk(child, callback));
    }
  };
  const doc = {
    descendants: (callback: (node: FakeNode, pos: number) => boolean) => {
      pos = 0;
      nodes.forEach((node) => walk(node, callback));
    },
    resolve: () => ({ depth: 0, node: () => nodes[0] }),
  };

  return {
    editor: {
      state: {
        doc,
        tr: {
          setNodeMarkup,
          removeMark: jest.fn(),
          addMark: jest.fn(),
        },
      },
      view: { dispatch },
    },
    dispatch,
    setNodeMarkup,
  };
};

describe('ensureUuids', () => {
  it('normalizes a dirty passage child whose uuid duplicates the passage uuid', () => {
    const passageNode: FakeNode = {
      attrs: { uuid: 'passage-1' },
      content: [
        {
          attrs: { uuid: 'passage-1' },
          marks: [],
          type: { name: 'paragraph' },
        },
      ],
      marks: [],
      type: { name: 'passage' },
    };
    const otherPassageNode: FakeNode = {
      attrs: { uuid: 'passage-2' },
      content: [
        {
          attrs: { uuid: 'passage-2' },
          marks: [],
          type: { name: 'paragraph' },
        },
      ],
      marks: [],
      type: { name: 'passage' },
    };

    const { editor, dispatch, setNodeMarkup } = createFakeEditor([
      passageNode,
      otherPassageNode,
    ]);

    ensureUuids(editor as never, { passageUuids: new Set(['passage-1']) });

    expect(setNodeMarkup).toHaveBeenCalledTimes(1);
    expect(setNodeMarkup).toHaveBeenCalledWith(
      1,
      undefined,
      expect.objectContaining({
        uuid: expect.not.stringMatching(/^passage-[12]$/),
      }),
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
