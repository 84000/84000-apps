import { v4 as uuidv4 } from 'uuid';

import type {
  ImportOperation,
  ImportPreview,
  NormalizedDocxDocument,
  NormalizedParagraph,
  PassageInsertOperation,
  PreviewAnnotationOperation,
} from './types';

interface SectionConfig {
  headerLabel: string;
  headerType: string;
  bodyType: string;
  supported: boolean;
  deferred?: boolean;
}

const SECTION_CONFIG: Record<string, SectionConfig> = {
  summary: {
    headerLabel: 's.',
    headerType: 'summaryHeader',
    bodyType: 'summary',
    supported: true,
  },
  acknowledgements: {
    headerLabel: 'ac.',
    headerType: 'acknowledgementHeader',
    bodyType: 'acknowledgement',
    supported: true,
  },
  preface: {
    headerLabel: 'pr.',
    headerType: 'prefaceHeader',
    bodyType: 'preface',
    supported: true,
  },
  introduction: {
    headerLabel: 'i.',
    headerType: 'introductionHeader',
    bodyType: 'introduction',
    supported: true,
  },
  'the translation': {
    headerLabel: '',
    headerType: 'translationHeader',
    bodyType: 'translation',
    supported: true,
  },
  colophon: {
    headerLabel: 'c.',
    headerType: 'colophonHeader',
    bodyType: 'colophon',
    supported: true,
  },
  endnotes: {
    headerLabel: 'n.',
    headerType: 'endnotesHeader',
    bodyType: 'endnotes',
    supported: true,
  },
  abbreviations: {
    headerLabel: 'ab.',
    headerType: 'abbreviationsHeader',
    bodyType: 'abbreviations',
    supported: true,
  },
  appendix: {
    headerLabel: 'ap.',
    headerType: 'appendixHeader',
    bodyType: 'appendix',
    supported: true,
  },
  bibliography: {
    headerLabel: '',
    headerType: '',
    bodyType: '',
    supported: false,
    deferred: true,
  },
  glossary: {
    headerLabel: '',
    headerType: '',
    bodyType: '',
    supported: false,
    deferred: true,
  },
};

function trimText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function toSectionKey(text: string) {
  return trimText(text).toLowerCase();
}

function buildHeadingAnnotation(level: number, type = 'section-title'): PreviewAnnotationOperation {
  return {
    kind: 'heading',
    start: 0,
    end: 0,
    data: {
      level,
      type,
    },
  };
}

function buildStyleAnnotations(paragraph: NormalizedParagraph): PreviewAnnotationOperation[] {
  const style = paragraph.styleName || '';
  const annotations: PreviewAnnotationOperation[] = [];

  if (style === 'Block' || style === 'Trailer') {
    annotations.push({ kind: 'blockquote', start: 0, end: 0 });
  }

  if (style === 'Mantra-Block') {
    annotations.push({ kind: 'paragraph', start: 0, end: 0 });
    annotations.push({ kind: 'indent', start: 0, end: 0 });
  }

  if (style === 'Mantra-Block-Verse') {
    annotations.push({ kind: 'indent', start: 0, end: 0 });
  }

  if (style === 'Block-Verse') {
    annotations.push({ kind: 'blockquote', start: 0, end: 0 });
  }

  if (style === 'Verse' || style === 'Block-Verse' || style === 'Mantra-Block-Verse') {
    const text = paragraph.text;
    if (text.includes('\n')) {
      let offset = 0;
      const lines = text.split('\n');
      annotations.push({ kind: 'line-group', start: 0, end: text.length });
      for (const line of lines) {
        annotations.push({
          kind: 'line',
          start: offset,
          end: offset + line.length,
        });
        offset += line.length + 1;
      }
    }
  }

  let cursor = 0;
  for (const run of paragraph.runs) {
    const start = cursor;
    const end = cursor + run.text.length;
    if (run.bold || run.italic || run.underline || run.smallCaps) {
      const textStyles: string[] = [];
      if (run.italic) textStyles.push('emphasis');
      if (run.bold) textStyles.push('text-bold');
      if (run.underline) textStyles.push('underline');
      if (run.smallCaps) textStyles.push('small-caps');
      for (const styleName of textStyles) {
        annotations.push({
          kind: 'span',
          start,
          end,
          data: { textStyle: styleName },
        });
      }
    }

    if (run.href) {
      annotations.push({
        kind: 'link',
        start,
        end,
        data: { href: run.href },
      });
    }

    cursor = end;
  }

  return annotations;
}

class LabelTree {
  private counters = new Map<string, number>();
  private latestAtDepth = new Map<number, string>();

  reset() {
    this.counters.clear();
    this.latestAtDepth.clear();
  }

  reserveExplicit(label: string) {
    const parts = label.split('.').filter(Boolean);
    const parent = parts.slice(0, -1).join('.');
    const last = Number(parts[parts.length - 1] || 0);
    this.counters.set(parent, Math.max(this.counters.get(parent) || 0, last));
    this.latestAtDepth.set(parts.length, label);
  }

  nextRoot() {
    return this.nextChild('');
  }

  nextHeading(headingLevel: number) {
    const targetDepth = Math.max(1, headingLevel);
    let parent = '';
    for (let depth = targetDepth - 1; depth >= 1; depth -= 1) {
      const existing = this.latestAtDepth.get(depth);
      if (existing) {
        parent = existing;
        break;
      }
    }
    return this.nextChild(parent);
  }

  nextBody(currentHeadingLabel?: string) {
    return this.nextChild(currentHeadingLabel || '');
  }

  private nextChild(parent: string) {
    const next = (this.counters.get(parent) || 0) + 1;
    this.counters.set(parent, next);
    const label = parent ? `${parent}.${next}` : `${next}`;
    const depth = label.split('.').length;
    this.latestAtDepth.set(depth, label);
    for (const key of Array.from(this.latestAtDepth.keys())) {
      if (key > depth) {
        this.latestAtDepth.delete(key);
      }
    }
    return label;
  }
}

function createPassageOperation({
  workUuid,
  sort,
  label,
  type,
  content,
  annotations = [],
}: {
  workUuid: string;
  sort: number;
  label: string;
  type: string;
  content: string;
  annotations?: PreviewAnnotationOperation[];
}): PassageInsertOperation {
  return {
    kind: 'insert_passage',
    passage: {
      uuid: uuidv4(),
      workUuid,
      label,
      sort,
      type,
      content,
      xmlId: `docx-${sort}`,
    },
    annotations,
  };
}

export function buildImportPreview({
  document,
  workUuid,
}: {
  document: NormalizedDocxDocument;
  workUuid: string;
}): ImportPreview {
  const operations: ImportOperation[] = [];
  const paragraphs = document.paragraphs;

  let mode: 'cover' | 'listTitles' | 'additionalTitles' | 'canonical' | 'body' = 'cover';
  let listTitleIndex = 0;
  let canonicalIndex = 0;
  let currentSection: SectionConfig | null = null;
  let currentSectionKey = '';
  let currentHeadingLabel: string | undefined;
  let sort = 1;
  const labels = new LabelTree();

  for (let i = 0; i < paragraphs.length; i += 1) {
    const paragraph = paragraphs[i];
    const text = trimText(paragraph.text);

    if (!text) {
      continue;
    }

    if (mode !== 'body') {
      if (/^List of Titles:?$/i.test(text)) {
        mode = 'listTitles';
        continue;
      }
      if (/^Additional Titles:?$/i.test(text)) {
        mode = 'additionalTitles';
        continue;
      }
      if (/^Canonical Reference:?$/i.test(text)) {
        mode = 'canonical';
        canonicalIndex = 0;
        continue;
      }

      if (mode === 'listTitles') {
        listTitleIndex += 1;
        const titleTypeMap: Record<number, { type: string; language?: string }> = {
          1: { type: 'mainTitle', language: 'Bo-Ltn' },
          2: { type: 'mainTitle', language: 'bo' },
          3: { type: 'mainTitle', language: 'en' },
          4: { type: 'mainTitle', language: 'Sa-Ltn' },
          5: { type: 'longTitle', language: 'bo' },
          6: { type: 'longTitle', language: 'Bo-Ltn' },
          7: { type: 'longTitle', language: 'en' },
          8: { type: 'longTitle', language: 'Sa-Ltn' },
          9: { type: 'longTitle', language: 'zh' },
        };
        const titleMeta = titleTypeMap[listTitleIndex];
        if (titleMeta) {
          operations.push({
            kind: 'insert_title',
            title: {
              uuid: uuidv4(),
              workUuid,
              content: text,
              type: titleMeta.type,
              language: titleMeta.language,
            },
          });
        }
        continue;
      }

      if (mode === 'additionalTitles') {
        operations.push({
          kind: 'insert_title',
          title: {
            uuid: uuidv4(),
            workUuid,
            content: text,
            type: 'otherTitle',
          },
        });
        continue;
      }

      if (mode === 'canonical') {
        canonicalIndex += 1;
        if (canonicalIndex === 1) {
          const tohMatch = text.match(/Toh\s+(.+)$/i);
          operations.push({
            kind: 'update_work',
            patch: {
              toh: tohMatch ? `toh${tohMatch[1].trim().replace(/^toh/i, '')}` : text,
            },
          });
          continue;
        }

        if (canonicalIndex === 2) {
          operations.push({
            kind: 'upsert_folio_annotation',
            patch: {
              source_description: text,
            },
          });
          continue;
        }

        if (canonicalIndex === 3) {
          if (text.includes('☒')) {
            operations.push({
              kind: 'update_work',
              patch: {
                restriction: true,
              },
            });
          }
          mode = 'body';
          continue;
        }
      }
    }

    if (paragraph.headingLevel === 1) {
      mode = 'body';
      currentSectionKey = toSectionKey(text);
      currentSection = SECTION_CONFIG[currentSectionKey] || null;
      currentHeadingLabel = undefined;
      labels.reset();

      if (!currentSection || !currentSection.supported) {
        currentSection = null;
        continue;
      }

      operations.push(
        createPassageOperation({
          workUuid,
          sort: sort++,
          label: currentSection.headerLabel,
          type: currentSection.headerType,
          content: text,
          annotations: [buildHeadingAnnotation(1)],
        }),
      );

      if (currentSectionKey === 'the translation') {
        const first = paragraphs[i + 1];
        const second = paragraphs[i + 2];
        if (
          first &&
          second &&
          !first.headingLevel &&
          !second.headingLevel &&
          trimText(first.text) &&
          trimText(second.text)
        ) {
          const mergedContent = `${trimText(first.text)}\n${trimText(second.text)}`;
          operations.push(
            createPassageOperation({
              workUuid,
              sort: sort++,
              label: '1',
              type: currentSection.bodyType,
              content: mergedContent,
              annotations: [
                buildHeadingAnnotation(2, 'body-title-honorific'),
                buildHeadingAnnotation(2, 'body-title-main'),
              ],
            }),
          );
          labels.reserveExplicit('1');
          i += 2;
        }
      }

      continue;
    }

    if (!currentSection) {
      continue;
    }

    if (paragraph.headingLevel && paragraph.headingLevel > 1) {
      const label = labels.nextHeading(paragraph.headingLevel);
      currentHeadingLabel = label;
      operations.push(
        createPassageOperation({
          workUuid,
          sort: sort++,
          label,
          type: currentSection.headerType,
          content: text,
          annotations: [buildHeadingAnnotation(paragraph.headingLevel)],
        }),
      );
      continue;
    }

    const label = currentHeadingLabel
      ? labels.nextBody(currentHeadingLabel)
      : labels.nextRoot();

    operations.push(
      createPassageOperation({
        workUuid,
        sort: sort++,
        label,
        type: currentSection.bodyType,
        content: text,
        annotations: buildStyleAnnotations(paragraph),
      }),
    );
  }

  const counts = operations.reduce(
    (acc, operation) => {
      if (operation.kind === 'insert_title') {
        acc.titles += 1;
      }
      if (operation.kind === 'insert_passage') {
        acc.passages += 1;
        acc.annotations += operation.annotations.length;
      }
      if (operation.kind === 'update_work') {
        acc.workUpdates += 1;
      }
      if (operation.kind === 'upsert_folio_annotation') {
        acc.folioUpdates += 1;
      }
      return acc;
    },
    {
      titles: 0,
      passages: 0,
      annotations: 0,
      workUpdates: 0,
      folioUpdates: 0,
    },
  );

  return {
    document,
    operations,
    counts,
  };
}
