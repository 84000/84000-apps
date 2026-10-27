import { getSchema } from '@tiptap/core';
import type { Extensions } from '@tiptap/core';
import {
  annotationsFromDTO,
  annotationsToDTO,
  type AnnotationDTO,
  type Passage,
} from '@eightyfourthousand/data-access';
import {
  blockFromPassage,
  PassageDoc,
  passageFromNode,
} from '@eightyfourthousand/lib-doc-model';

import { buildStackSchemaExtensions } from '../stack/stack-extensions';
import { stackSeedFromPassage } from '../stack/types';
import { renderTranslationHTML } from '../reader/translation-html';
import { useTranslationExtensions } from './hooks/useTranslationExtensions';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

/**
 * Inline titles in every language load, render, and export unchanged. Titles
 * in languages not set in italics (zh, ja) used to be dropped on load, so a
 * save deleted them.
 */

const stackSchema = getSchema(buildStackSchemaExtensions());
const tabSchema = getSchema(
  // Hook-shaped by name only — it calls no hooks and just assembles the list.
  useTranslationExtensions().extensions as Extensions,
);

const IDENTITY = { type: 'translation', sort: 1, label: '1' } as const;
const UUID = 'passage-1';
const CONTENT = 'See 金剛經 and 般若心経 and the Heart Sūtra.';

const dtos: AnnotationDTO[] = [
  {
    uuid: 'title-zh',
    type: 'inline-title',
    start: 4,
    end: 7,
    content: [{ lang: 'zh' }],
    toh: 'toh16',
    passage_uuid: UUID,
  },
  {
    uuid: 'title-ja',
    type: 'inline-title',
    start: 12,
    end: 16,
    content: [{ lang: 'ja' }],
    passage_uuid: UUID,
  },
  {
    uuid: 'title-en',
    type: 'inline-title',
    start: 25,
    end: 36,
    content: [{ lang: 'en' }],
    passage_uuid: UUID,
  },
];

const row: Passage = {
  ...IDENTITY,
  uuid: UUID,
  workUuid: 'work-1',
  content: CONTENT,
  annotations: annotationsFromDTO(dtos, CONTENT.length),
};

const stackDoc = () => {
  const doc = new PassageDoc({
    uuid: UUID,
    workUuid: 'work-1',
    schema: stackSchema,
  });
  doc.seed(stackSeedFromPassage(row).content);
  return doc.toNode();
};

const tabDoc = () =>
  tabSchema.nodeFromJSON({
    type: 'translation',
    content: [blockFromPassage(row)],
  });

/** The saved rows, compared on the fields a save writes. */
const saved = (passage: Passage) =>
  annotationsToDTO(passage.annotations ?? [])
    .map(({ uuid, type, start, end, content, toh }) => ({
      uuid,
      type,
      start,
      end,
      content,
      toh,
    }))
    .sort((a, b) => a.uuid.localeCompare(b.uuid));

const expected = dtos
  .map(({ uuid, type, start, end, content, toh }) => ({
    uuid,
    type,
    start,
    end,
    content,
    toh,
  }))
  .sort((a, b) => a.uuid.localeCompare(b.uuid));

describe('inline titles round-trip', () => {
  it('stack: every language loads and exports unchanged', () => {
    const node = stackDoc();
    const out = passageFromNode(node, 'work-1', { ...IDENTITY, uuid: UUID });
    expect(saved(out)).toEqual(expected);
  });

  it('paginated editor: every language loads and exports unchanged', () => {
    const node = tabDoc();
    const out = passageFromNode(node.child(0), 'work-1', {
      ...IDENTITY,
      uuid: UUID,
    });
    expect(saved(out)).toEqual(expected);
  });

  it('carries zh and ja titles on the upright mark, en on italic', () => {
    const marks: Record<string, string> = {};
    stackDoc().descendants((node) => {
      node.marks.forEach((mark) => {
        if (mark.attrs.type === 'inlineTitle') {
          marks[mark.attrs.uuid] = mark.type.name;
        }
      });
    });
    expect(marks).toEqual({
      'title-zh': 'inlineTitle',
      'title-ja': 'inlineTitle',
      'title-en': 'italic',
    });
  });

  it('reader renders zh and ja titles with their lang, not in <em>', () => {
    const html = renderTranslationHTML({ content: blockFromPassage(row) });
    expect(html).toContain('lang="zh"');
    expect(html).toContain('lang="ja"');
    expect(html).toMatch(/<span[^>]*lang="zh"[^>]*>金剛經<\/span>/);
    expect(html).not.toMatch(/<em[^>]*>金剛經/);
    expect(html).toMatch(/<em[^>]*>the Heart<\/em>|<em[^>]*>Heart Sūtra/);
  });
});
