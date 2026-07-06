import {
  AnnotationDTO,
  Annotations,
  annotationsFromDTO,
  PassageDTO,
  passageFromDTO,
} from '@eightyfourthousand/data-access';
import { blockFromPassage, blocksFromTranslationBody } from './block';
import type { TranslationEditorContentItem } from './components/editor';

const passageDTO = (overrides: Partial<PassageDTO> = {}): PassageDTO => ({
  sort: 1,
  type: 'translation',
  uuid: 'passage-uuid-1',
  label: '1',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'The quick brown fox jumps over the lazy dog',
  work_uuid: 'work-uuid-1',
  annotations: [],
  ...overrides,
});

const buildPassage = (dto: PassageDTO) =>
  passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content?.length ?? 0),
  );

const collectText = (item: TranslationEditorContentItem): string => {
  if (item.type === 'text') {
    return item.text ?? '';
  }
  return (item.content ?? []).map(collectText).join('');
};

const collectTextNodes = (
  item: TranslationEditorContentItem,
): TranslationEditorContentItem[] => {
  if (item.type === 'text') {
    return [item];
  }
  return (item.content ?? []).flatMap(collectTextNodes);
};

const assertNoInvertedRanges = (item: TranslationEditorContentItem) => {
  const start = item.attrs?.start;
  const end = item.attrs?.end;
  if (typeof start === 'number' && typeof end === 'number') {
    expect(start).toBeLessThanOrEqual(end);
  }
  for (const mark of item.marks ?? []) {
    const markStart = mark.attrs?.start;
    const markEnd = mark.attrs?.end;
    if (typeof markStart === 'number' && typeof markEnd === 'number') {
      expect(markStart).toBeLessThanOrEqual(markEnd);
    }
  }
  (item.content ?? []).forEach(assertNoInvertedRanges);
};

describe('blockFromPassage', () => {
  it('renders an empty passage as a passage with an empty paragraph', () => {
    const block = blockFromPassage(buildPassage(passageDTO({ content: '' })));

    expect(block.type).toBe('passage');
    expect(block.content).toHaveLength(1);
    expect(block.content?.[0].type).toBe('paragraph');
    expect(block.content?.[0].content).toEqual([]);
  });

  it('renders an empty heading passage as an empty heading block', () => {
    const block = blockFromPassage(
      buildPassage(passageDTO({ content: '', type: 'translationHeader' })),
    );

    expect(block.content?.[0].type).toBe('heading');
    expect(block.content?.[0].content).toEqual([]);
  });

  it('does not mutate the order of the input annotations array', () => {
    const annotations: AnnotationDTO[] = [
      {
        uuid: 'ann-2',
        passage_uuid: 'passage-uuid-1',
        type: 'span',
        start: 10,
        end: 19,
        content: [{ 'text-style': 'emphasis' }],
      },
      {
        uuid: 'ann-1',
        passage_uuid: 'passage-uuid-1',
        type: 'span',
        start: 0,
        end: 3,
        content: [{ 'text-style': 'emphasis' }],
      },
    ];
    const dto = passageDTO({ annotations });
    const passage = buildPassage(dto);
    const inputOrder = (passage.annotations as Annotations).map((a) => a.uuid);

    blockFromPassage(passage);

    expect((passage.annotations as Annotations).map((a) => a.uuid)).toEqual(
      inputOrder,
    );
  });

  it('preserves the full text content when annotations overlap', () => {
    const dto = passageDTO({
      annotations: [
        {
          uuid: 'link-1',
          passage_uuid: 'passage-uuid-1',
          type: 'link',
          start: 0,
          end: 15,
          content: [{ href: 'https://example.com' }],
        },
        {
          uuid: 'span-1',
          passage_uuid: 'passage-uuid-1',
          type: 'span',
          start: 4,
          end: 19,
          content: [{ 'text-style': 'emphasis' }],
        },
      ],
    });

    const block = blockFromPassage(buildPassage(dto));

    expect(collectText(block)).toBe(dto.content);
    assertNoInvertedRanges(block);
  });

  it('applies both marks to the intersection of overlapping annotations', () => {
    const dto = passageDTO({
      annotations: [
        {
          uuid: 'span-long',
          passage_uuid: 'passage-uuid-1',
          type: 'span',
          start: 0,
          end: 15,
          content: [{ 'text-style': 'emphasis' }],
        },
        {
          uuid: 'span-short',
          passage_uuid: 'passage-uuid-1',
          type: 'span',
          start: 4,
          end: 9,
          content: [{ 'text-style': 'underline' }],
        },
      ],
    });

    const block = blockFromPassage(buildPassage(dto));
    const textNodes = collectTextNodes(block);
    const doubleMarked = textNodes.filter((node) => node.marks?.length === 2);

    expect(doubleMarked.map((node) => node.text).join('')).toBe('quick');
    assertNoInvertedRanges(block);
  });
});

describe('blockFromPassage with invalid annotations', () => {
  it('skips out-of-range annotations and flags the passage', () => {
    const consoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const dto = passageDTO({
      annotations: [
        {
          uuid: 'span-invalid',
          passage_uuid: 'passage-uuid-1',
          type: 'span',
          start: 0,
          end: 999,
          content: [{ 'text-style': 'emphasis' }],
        },
        {
          uuid: 'span-valid',
          passage_uuid: 'passage-uuid-1',
          type: 'span',
          start: 4,
          end: 9,
          content: [{ 'text-style': 'underline' }],
        },
      ],
    });

    const block = blockFromPassage(buildPassage(dto));
    const textNodes = collectTextNodes(block);
    const markTypes = textNodes.flatMap(
      (node) => node.marks?.map((mark) => mark.type) ?? [],
    );

    expect(block.attrs?.invalid).toBe(true);
    // The invalid emphasis span must not render anywhere; the valid
    // underline span still applies.
    expect(markTypes).toEqual(['underline']);
    expect(collectText(block)).toBe(dto.content);
    consoleWarn.mockRestore();
  });
});

describe('blocksFromTranslationBody', () => {
  it('keeps empty passages and drops only passages with missing content', () => {
    const consoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const empty = buildPassage(passageDTO({ content: '', uuid: 'p-empty' }));
    const missing = buildPassage(passageDTO({ uuid: 'p-missing' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (missing as any).content = undefined;
    const normal = buildPassage(passageDTO({ uuid: 'p-normal' }));

    const blocks = blocksFromTranslationBody([empty, missing, normal]);

    expect(blocks.map((block) => block.attrs?.uuid)).toEqual([
      'p-empty',
      'p-normal',
    ]);
    consoleWarn.mockRestore();
  });
});
