/**
 * Acceptance tests for DEV-907, glossary instances in the editor save path,
 * written from TASK.md alone. Each test names the criterion it covers:
 *
 *  AC1  an instance added in the editor is saved with the glossary uuid and
 *       no `authority` key
 *  AC3  an old instance that is saved again is written without `authority`
 *  AC4  an instance with no `authority` loads in the editor, survives a save
 *       and an edit to its passage, and carries the same mark as one that has
 *       it
 *  AC5  an old instance that still carries `authority` loads and saves, its
 *       stored value ignored
 *
 * The save path here is the one `round-trip.spec.ts` uses: a passage is
 * loaded into a block (`blockFromPassage`), exported from the node
 * (`passageFromNode`) and turned into the row (`passageToDTO`).
 */
import {
  annotationsFromDTO,
  passageFromDTO,
  passageToDTO,
  type AnnotationDTO,
  type PassageDTO,
  type TranslationEditorContentItem,
} from '@eightyfourthousand/data-access';
import { blockFromPassage } from './block';
import { passageFromNode } from './passage';
import { toFakeNode } from './fake-node.fixture';
import { glossaryInstance as exportGlossaryInstance } from './exporters/glossary-instance';
import type { Mark, Node } from '@tiptap/pm/model';

const GLOSSARY = 'a1a1a1a1-0000-4000-8000-000000000001';
const AUTHORITY = 'b2b2b2b2-0000-4000-8000-000000000002';
const CONTENT = 'The Buddha taught the Dharma.';
// 'Buddha' is [4, 10).
const START = 4;
const END = 10;

const passageDto = (content: Record<string, unknown>[]): PassageDTO => ({
  sort: 1,
  type: 'translation',
  uuid: 'passage-uuid-1',
  label: '1.1',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: CONTENT,
  work_uuid: 'work-uuid-1',
  annotations: [
    {
      uuid: 'gi-1',
      passage_uuid: 'passage-uuid-1',
      type: 'glossary-instance',
      start: START,
      end: END,
      content,
    },
  ],
});

const blockOf = (dto: PassageDTO) =>
  JSON.parse(
    JSON.stringify(
      blockFromPassage(
        passageFromDTO(
          dto,
          annotationsFromDTO(dto.annotations, CONTENT.length),
        ),
      ),
    ),
  ) as TranslationEditorContentItem;

/** The glossary-instance marks on the text segments of a block. */
const instanceMarks = (
  item: TranslationEditorContentItem,
): { attrs: Record<string, unknown> }[] => {
  const own = (item.marks ?? []).filter((m) => m.type === 'glossaryInstance');
  return [...own, ...(item.content ?? []).flatMap(instanceMarks)];
};

/** Export a block the way the editor save does, and return the stored rows. */
const saveBlock = (block: TranslationEditorContentItem): AnnotationDTO[] => {
  const node = toFakeNode(block) as Node;
  const passage = passageFromNode(node, 'work-uuid-1', {
    uuid: 'passage-uuid-1',
    type: 'translation',
    sort: 1,
    label: '1.1',
  });
  const dto = JSON.parse(JSON.stringify(passageToDTO(passage))) as PassageDTO;
  return (dto.annotations ?? []).filter((a) => a.type === 'glossary-instance');
};

const keysOf = (row: AnnotationDTO) =>
  row.content.flatMap((part) => Object.keys(part as object));

const expectStoredWithoutAuthority = (rows: AnnotationDTO[]) => {
  expect(rows).toHaveLength(1);
  const [row] = rows;
  expect(row.uuid).toBe('gi-1');
  expect([row.start, row.end]).toEqual([START, END]);
  expect(row.content.some((part) => part.uuid === GLOSSARY)).toBe(true);
  expect(keysOf(row)).not.toContain('authority');
  expect(JSON.stringify(row)).not.toContain(AUTHORITY);
};

/** Insert `text` at the start of the first text segment, as typing would. */
const typeAtStart = (
  item: TranslationEditorContentItem,
  text: string,
): boolean => {
  if (item.type === 'text') {
    item.text = text + item.text;
    return true;
  }
  return (item.content ?? []).some((child) => typeAtStart(child, text));
};

describe('glossary instances in the editor save path (DEV-907)', () => {
  describe('an instance with no authority', () => {
    const dto = passageDto([{ uuid: GLOSSARY }]);

    it('[AC4] loads into the editor as a glossaryInstance mark on its text', () => {
      const marks = instanceMarks(blockOf(dto));

      expect(marks.length).toBeGreaterThan(0);
      for (const mark of marks) {
        expect(mark.attrs.glossary).toBe(GLOSSARY);
        expect(mark.attrs.uuid).toBe('gi-1');
      }
    });

    it('[AC4] survives a save, keeping its range, glossary uuid and identity', () => {
      expectStoredWithoutAuthority(saveBlock(blockOf(dto)));
    });

    it('[AC4] survives an edit to its passage: still saved, moved with the text', () => {
      const block = blockOf(dto);
      expect(typeAtStart(block, 'So ')).toBe(true);

      const rows = saveBlock(block);
      expect(rows).toHaveLength(1);
      expect([rows[0].start, rows[0].end]).toEqual([START + 3, END + 3]);
      expect(rows[0].content.some((part) => part.uuid === GLOSSARY)).toBe(true);
      expect(keysOf(rows[0])).not.toContain('authority');
    });

    it('[AC1] a mark with only uuid and glossary (as added in the editor) is saved as the glossary uuid with no authority key', () => {
      // Same as the loaded mark, built by hand so no authority attr exists.
      const block = blockOf(dto);
      for (const mark of instanceMarks(block)) {
        mark.attrs = { uuid: mark.attrs.uuid, glossary: GLOSSARY };
      }
      expectStoredWithoutAuthority(saveBlock(block));
    });
  });

  describe('an old instance that still carries authority', () => {
    it.each([
      ['in the same element', [{ uuid: GLOSSARY, authority: AUTHORITY }]],
      ['in a separate element', [{ uuid: GLOSSARY }, { authority: AUTHORITY }]],
    ])(
      '[AC5] loads (%s) as a glossaryInstance mark for the entry',
      (_, content) => {
        const marks = instanceMarks(blockOf(passageDto(content)));

        expect(marks.length).toBeGreaterThan(0);
        for (const mark of marks) {
          expect(mark.attrs.glossary).toBe(GLOSSARY);
          expect(mark.attrs.uuid).toBe('gi-1');
        }
      },
    );

    it.each([
      ['in the same element', [{ uuid: GLOSSARY, authority: AUTHORITY }]],
      ['in a separate element', [{ uuid: GLOSSARY }, { authority: AUTHORITY }]],
    ])(
      '[AC3][AC5] saved again (%s) it is written without authority',
      (_, content) => {
        expectStoredWithoutAuthority(saveBlock(blockOf(passageDto(content))));
      },
    );

    it('[AC5] saved after an edit to its passage it is kept, moved with the text, without authority', () => {
      const block = blockOf(
        passageDto([{ uuid: GLOSSARY }, { authority: AUTHORITY }]),
      );
      typeAtStart(block, 'So ');

      const rows = saveBlock(block);
      expect(rows).toHaveLength(1);
      expect([rows[0].start, rows[0].end]).toEqual([START + 3, END + 3]);
      expect(keysOf(rows[0])).not.toContain('authority');
      expect(JSON.stringify(rows[0])).not.toContain(AUTHORITY);
    });

    it('[AC1][AC3] a mark still holding a stale authority attr is saved without it', () => {
      // An editor session that set the attr, or a mark loaded with it.
      const block = blockOf(passageDto([{ uuid: GLOSSARY }]));
      for (const mark of instanceMarks(block)) {
        mark.attrs = { ...mark.attrs, authority: AUTHORITY };
      }
      expectStoredWithoutAuthority(saveBlock(block));
    });
  });

  describe('the glossary-instance exporter', () => {
    const exportMark = (attrs: Record<string, unknown>) => {
      const node = { textContent: 'Buddha' } as unknown as Node;
      const mark = { attrs } as unknown as Mark;
      return exportGlossaryInstance({
        node,
        mark,
        parent: node,
        root: node,
        start: 5,
        passageUuid: 'passage-uuid-1',
      });
    };

    it('[AC4] exports a mark that has a uuid and a glossary but no authority', () => {
      const result = exportMark({ uuid: 'gi-1', glossary: GLOSSARY });

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        uuid: 'gi-1',
        type: 'glossaryInstance',
        passageUuid: 'passage-uuid-1',
        start: 5,
        end: 11,
        glossary: GLOSSARY,
      });
    });

    it('[AC1][AC3] does not carry an authority attr through to the annotation', () => {
      const result = exportMark({
        uuid: 'gi-1',
        glossary: GLOSSARY,
        authority: AUTHORITY,
      });

      expect(result).toBeDefined();
      expect(JSON.stringify(result)).not.toContain(AUTHORITY);
    });

    it('[AC4] still drops a mark with no glossary uuid', () => {
      const warn = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      expect(
        exportMark({ uuid: 'gi-1', authority: AUTHORITY }),
      ).toBeUndefined();
      warn.mockRestore();
    });
  });
});
