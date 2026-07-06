import {
  annotationsFromDTO,
  PassageDTO,
  passageFromDTO,
} from '@eightyfourthousand/data-access';
import { blockFromPassage } from '../block';
import { findTextNodeWithMarks, recurseForType } from './recurse';
import { TranslationEditorContentItem } from '../components/editor';

const countMentions = (
  node: TranslationEditorContentItem,
): TranslationEditorContentItem[] => {
  const found: TranslationEditorContentItem[] = [];
  if (node.type === 'mention') {
    found.push(node);
  }
  for (const child of node.content || []) {
    found.push(...countMentions(child));
  }
  return found;
};

describe('mention transformer', () => {
  it('batches multiple mentions at the same location into a single node', () => {
    const dto: PassageDTO = {
      sort: 1,
      type: 'root',
      uuid: 'passage-uuid-1234',
      label: '',
      xmlId: 'test-passage',
      parent: 'test-parent',
      content: 'Some text',
      work_uuid: 'work-uuid-5678',
      annotations: [
        {
          start: 4,
          end: 4,
          type: 'mention',
          uuid: 'mention-uuid-1',
          content: [{ uuid: 'entity-1' }, { type: 'glossary' }],
          passage_uuid: 'passage-uuid-1234',
        },
        {
          start: 4,
          end: 4,
          type: 'mention',
          uuid: 'mention-uuid-2',
          content: [{ uuid: 'entity-2' }, { type: 'bibliography' }],
          passage_uuid: 'passage-uuid-1234',
        },
      ],
    };

    const passage = passageFromDTO(
      dto,
      annotationsFromDTO(dto.annotations || [], dto.content.length),
    );
    const block = blockFromPassage(passage);
    if (!block?.content) {
      throw new Error('Block conversion failed');
    }

    const mentions = countMentions(block);
    // Both annotations collapse into one mention node — no phantom empty node.
    expect(mentions.length).toBe(1);
    expect(mentions[0].attrs?.items?.length).toBe(2);
    expect(mentions[0].marks).toEqual([]);
  });

  it('carries the lang attribute from annotation content onto the mention item', () => {
    const dto: PassageDTO = {
      sort: 1,
      type: 'root',
      uuid: 'passage-uuid-1234',
      label: '',
      xmlId: 'test-passage',
      parent: 'test-parent',
      content: 'Some text',
      work_uuid: 'work-uuid-5678',
      annotations: [
        {
          start: 4,
          end: 4,
          type: 'mention',
          uuid: 'mention-uuid-1',
          content: [
            { uuid: 'entity-1' },
            { type: 'work' },
            { lang: 'Sa-Ltn' },
          ],
          passage_uuid: 'passage-uuid-1234',
        },
      ],
    };

    const passage = passageFromDTO(
      dto,
      annotationsFromDTO(dto.annotations || [], dto.content.length),
    );
    const block = blockFromPassage(passage);
    if (!block?.content) {
      throw new Error('Block conversion failed');
    }

    const mentions = countMentions(block);
    expect(mentions.length).toBe(1);
    expect(mentions[0].attrs?.items?.[0]?.lang).toBe('Sa-Ltn');
  });

  it('keeps the endNoteLink mark on adjacent text, not the mention, at a shared location', () => {
    const dto: PassageDTO = {
      sort: 1,
      type: 'root',
      uuid: 'passage-uuid-1234',
      label: '',
      xmlId: 'test-passage',
      parent: 'test-parent',
      content: 'Some text',
      work_uuid: 'work-uuid-5678',
      annotations: [
        {
          start: 4,
          end: 4,
          type: 'mention',
          uuid: 'mention-uuid-1',
          content: [{ uuid: 'entity-1' }, { type: 'glossary' }],
          passage_uuid: 'passage-uuid-1234',
        },
        {
          start: 4,
          end: 4,
          type: 'end-note-link',
          uuid: 'endnote-link-uuid-1',
          content: [{ uuid: 'endnote-uuid-1' }],
          passage_uuid: 'passage-uuid-1234',
        },
      ],
    };

    const passage = passageFromDTO(
      dto,
      annotationsFromDTO(dto.annotations || [], dto.content.length),
    );
    const block = blockFromPassage(passage);
    if (!block?.content) {
      throw new Error('Block conversion failed');
    }

    const mention = recurseForType({ block, until: 'mention' });
    expect(mention).toBeDefined();
    // The mention never carries marks.
    expect(mention?.marks).toEqual([]);

    // The endNoteLink mark lives on a text node, not on the mention.
    const textNode = findTextNodeWithMarks(block);
    expect(textNode?.type).toBe('text');
    const endnoteMark = textNode?.marks?.find(
      (m: { type: string }) => m.type === 'endNoteLink',
    );
    expect(endnoteMark).toBeDefined();
  });
});
