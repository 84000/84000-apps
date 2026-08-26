import {
  annotationsFromDTO,
  annotationsToDTO,
  PassageDTO,
  passageFromDTO,
} from '@eightyfourthousand/data-access';
import { blockFromPassage } from './block';
import { annotationExportsFromNode } from './exporters/annotation';
import { stampNodeUuids, toFakeNode } from './fake-node.fixture';
import type { TranslationEditorContentItem } from '@eightyfourthousand/data-access';

/**
 * `passage_annotations.toh` scopes an annotation to a subset of a work's
 * Tohoku texts, and it is declared on `AnnotationBase` — *any* annotation may
 * carry one. Production carries a scope on 18 distinct annotation types.
 *
 * The scope reaches the document through four different mechanisms, and this
 * exercises one annotation of each:
 *
 *   - a block node's own attribute (`heading`),
 *   - a mark's attribute (`glossary-instance`, the type holding 229k of the
 *     ~235k scoped rows in production),
 *   - a per-item entry on a node that batches several annotations (`mention`),
 *   - a per-note entry on a mark that batches several (`end-note-link`),
 *   - a parameter annotation stored as an object attribute on its host block
 *     (`leading-space`).
 *
 * Before this was fixed no exporter read `toh` back at all, so every one of
 * these lost its scope on the first save of its passage and `savePassagesWithDeletions`
 * — which diffs on `toh` — wrote the column to null.
 */

const TOH = 'toh417,toh418';

const dto: PassageDTO = {
  sort: 1,
  type: 'translation',
  uuid: 'passage-uuid-1',
  label: '1',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'The quick brown fox jumps over the lazy dog',
  work_uuid: 'work-uuid-1',
  annotations: [
    {
      uuid: 'heading-1',
      passage_uuid: 'passage-uuid-1',
      type: 'heading',
      start: 0,
      end: 43,
      toh: TOH,
      content: [{ 'heading-level': 'h3' }],
    },
    {
      uuid: 'glossary-1',
      passage_uuid: 'passage-uuid-1',
      type: 'glossary-instance',
      start: 20,
      end: 25,
      toh: TOH,
      content: [
        { uuid: 'glossary-entry-uuid-1' },
        { authority: 'authority-uuid-1' },
      ],
    },
    {
      uuid: 'mention-1',
      passage_uuid: 'passage-uuid-1',
      type: 'mention',
      start: 10,
      end: 10,
      toh: TOH,
      content: [{ uuid: 'entity-uuid-1' }, { type: 'folio' }],
    },
    {
      uuid: 'endnote-1',
      passage_uuid: 'passage-uuid-1',
      type: 'end-note-link',
      start: 30,
      end: 30,
      toh: TOH,
      content: [{ uuid: 'endnote-passage-uuid-1' }],
    },
    {
      uuid: 'leading-space-1',
      passage_uuid: 'passage-uuid-1',
      type: 'leading-space',
      start: 0,
      end: 0,
      toh: TOH,
      content: [],
    },
  ],
};

describe('toh round-trip', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations ?? [], dto.content.length),
  );
  const block = stampNodeUuids(
    JSON.parse(
      JSON.stringify(blockFromPassage(passage)),
    ) as TranslationEditorContentItem,
  );
  const root = toFakeNode(block);

  const exported = annotationExportsFromNode({
    passageUuid: dto.uuid,
    node: root,
    parent: root,
    root,
    start: 0,
  });

  const exportedDtos = annotationsToDTO(exported);
  const byUuid = new Map(exportedDtos.map((a) => [a.uuid, a]));

  it.each(
    (dto.annotations ?? []).map((a) => [a.type, a.uuid] as [string, string]),
  )('preserves the toh scope of a %s annotation', (_type, uuid) => {
    const roundTripped = byUuid.get(uuid);

    // A dropped annotation would also "not lose" its toh, so assert it came
    // back before asserting what it came back with.
    expect(roundTripped).toBeDefined();
    expect(roundTripped?.toh).toBe(TOH);
  });

  it('leaves an unscoped annotation unscoped', () => {
    const unscoped: PassageDTO = {
      ...dto,
      annotations: [
        {
          uuid: 'glossary-2',
          passage_uuid: 'passage-uuid-1',
          type: 'glossary-instance',
          start: 20,
          end: 25,
          content: [
            { uuid: 'glossary-entry-uuid-1' },
            { authority: 'authority-uuid-1' },
          ],
        },
      ],
    };

    const plain = passageFromDTO(
      unscoped,
      annotationsFromDTO(unscoped.annotations ?? [], unscoped.content.length),
    );
    const plainRoot = toFakeNode(
      stampNodeUuids(
        JSON.parse(
          JSON.stringify(blockFromPassage(plain)),
        ) as TranslationEditorContentItem,
      ),
    );

    const [exportedPlain] = annotationsToDTO(
      annotationExportsFromNode({
        passageUuid: unscoped.uuid,
        node: plainRoot,
        parent: plainRoot,
        root: plainRoot,
        start: 0,
      }),
    );

    expect(exportedPlain?.uuid).toBe('glossary-2');
    expect(exportedPlain?.toh).toBeUndefined();
  });
});
