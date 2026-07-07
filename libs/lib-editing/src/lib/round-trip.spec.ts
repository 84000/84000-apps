import type { Node } from '@tiptap/pm/model';
import {
  Annotation,
  annotationsFromDTO,
  PassageDTO,
  passageFromDTO,
} from '@eightyfourthousand/data-access';
import { blockFromPassage } from './block';
import { annotationExportsFromNode } from './exporters/annotation';
import { passageFromNode } from './passage';
import type { TranslationEditorContentItem } from './components/editor';

/**
 * Round-trip contract: every annotation that renders must survive export with
 * equivalent combined coverage. A mark that was split across segments by an
 * overlapping annotation persists back as N contiguous annotations (one per
 * segment) — the same behavior the editor produces when a user hand-applies a
 * mark across differently-marked text.
 */

const collectText = (item: TranslationEditorContentItem): string => {
  if (item.type === 'text') {
    return item.text ?? '';
  }
  return (item.content ?? []).map(collectText).join('');
};

/**
 * Mimics the uuid dedup half of ensureUuids(): the save path stamps a fresh
 * uuid on the 2nd..Nth text segments carrying the same mark uuid so each
 * segment exports as its own annotation. Returns a map from each new uuid to
 * the original annotation uuid it derives from.
 */
const dedupeMarkUuids = (
  item: TranslationEditorContentItem,
  seen = new Set<string>(),
  families = new Map<string, string>(),
  counter = { next: 1 },
): Map<string, string> => {
  for (const mark of item.marks ?? []) {
    const uuid = mark.attrs?.uuid as string | undefined;
    if (!uuid) {
      continue;
    }
    if (seen.has(uuid)) {
      const fresh = `${uuid}-segment-${counter.next++}`;
      mark.attrs = { ...mark.attrs, uuid: fresh };
      families.set(fresh, families.get(uuid) ?? uuid);
    } else {
      seen.add(uuid);
      families.set(uuid, uuid);
    }
  }
  for (const child of item.content ?? []) {
    dedupeMarkUuids(child, seen, families, counter);
  }
  return families;
};

/** Wraps the JSON block tree in just enough ProseMirror Node shape for the exporters. */
const toFakeNode = (item: TranslationEditorContentItem): Node => {
  const children = (item.content ?? []).map(toFakeNode);
  return {
    type: { name: item.type ?? 'unknown' },
    attrs: item.attrs ?? {},
    marks: (item.marks ?? []).map((mark) => ({
      type: { name: mark.type },
      attrs: mark.attrs ?? {},
    })),
    isText: item.type === 'text',
    text: item.text,
    textContent: collectText(item),
    content: {
      size: children.length,
      childCount: children.length,
      child: (i: number) => children[i],
      forEach: (cb: (child: Node) => void) => children.forEach(cb),
    },
  } as unknown as Node;
};

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
      uuid: 'link-1',
      passage_uuid: 'passage-uuid-1',
      type: 'link',
      start: 0,
      end: 15,
      content: [{ href: 'https://example.com' }],
    },
    // Straddles the link boundary at 15 — renders as two segments.
    {
      uuid: 'span-1',
      passage_uuid: 'passage-uuid-1',
      type: 'span',
      start: 4,
      end: 19,
      content: [{ 'text-style': 'underline' }],
    },
    {
      uuid: 'glossary-1',
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

describe('annotation round-trip', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  // Deep-clone first: positionless marks are shared by reference across the
  // segments they span, and the dedup below must treat each segment's mark as
  // its own object (as ProseMirror does when the doc is materialized).
  const block = JSON.parse(
    JSON.stringify(blockFromPassage(passage)),
  ) as TranslationEditorContentItem;
  const families = dedupeMarkUuids(block);
  const root = toFakeNode(block);

  const exported = annotationExportsFromNode({
    passageUuid: dto.uuid,
    node: root,
    parent: root,
    root,
    start: 0,
  });

  const coverageByOriginal = new Map<string, Annotation[]>();
  for (const annotation of exported) {
    const original = families.get(annotation.uuid);
    if (!original) {
      continue;
    }
    const family = coverageByOriginal.get(original) ?? [];
    family.push(annotation);
    coverageByOriginal.set(original, family);
  }

  it.each(dto.annotations?.map((a) => [a.uuid, a.start, a.end]) ?? [])(
    'exports contiguous coverage matching source annotation %s [%i, %i)',
    (uuid, start, end) => {
      const family = coverageByOriginal.get(uuid as string) ?? [];
      expect(family.length).toBeGreaterThan(0);

      const sorted = [...family].sort((a, b) => a.start - b.start);
      expect(sorted[0].start).toBe(start);
      expect(sorted[sorted.length - 1].end).toBe(end);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].start).toBe(sorted[i - 1].end);
      }
    },
  );

  it('exports the straddling span as multiple contiguous segments', () => {
    expect(coverageByOriginal.get('span-1')?.length).toBeGreaterThan(1);
  });

  it('does not invent annotations that were never in the source', () => {
    const knownTypes = ['link', 'span', 'glossaryInstance', 'paragraph'];
    for (const annotation of exported) {
      expect(knownTypes).toContain(annotation.type);
    }
  });
});

describe('passageFromNode annotationsIncomplete flag', () => {
  const buildBlock = (annotations: PassageDTO['annotations'] = []) => {
    const passageDto = { ...dto, annotations };
    const passage = passageFromDTO(
      passageDto,
      annotationsFromDTO(
        passageDto.annotations || [],
        passageDto.content.length,
      ),
    );
    return JSON.parse(
      JSON.stringify(blockFromPassage(passage)),
    ) as TranslationEditorContentItem;
  };

  it('leaves the flag unset when every annotation exports', () => {
    const block = buildBlock(dto.annotations);
    dedupeMarkUuids(block);
    const passage = passageFromNode(toFakeNode(block) as never, 'work-uuid-1');

    expect(passage.annotationsIncomplete).toBeUndefined();
    expect(passage.annotations.length).toBeGreaterThan(0);
  });

  it('sets the flag when a node with an exportable annotation lacks a uuid', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const block = buildBlock([]);
    // Simulate the ensureUuids timing gap: the paragraph's uuid is missing at
    // export time, so its block annotation cannot be exported.
    delete block.content?.[0]?.attrs?.uuid;
    const passage = passageFromNode(toFakeNode(block) as never, 'work-uuid-1');

    expect(passage.annotationsIncomplete).toBe(true);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('sets the flag for passages flagged invalid on load', () => {
    const consoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    // An out-of-range annotation is skipped on load and marks the passage
    // invalid; the export set is incomplete by construction.
    const block = buildBlock([
      {
        uuid: 'span-invalid',
        passage_uuid: 'passage-uuid-1',
        type: 'span',
        start: 0,
        end: 999,
        content: [{ 'text-style': 'emphasis' }],
      },
    ]);
    const passage = passageFromNode(toFakeNode(block) as never, 'work-uuid-1');

    expect(passage.annotationsIncomplete).toBe(true);
    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });
});
