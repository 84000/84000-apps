import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

import type {
  NormalizedDocxDocument,
  NormalizedParagraph,
  NormalizedRun,
} from './types';

const XML_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: false,
};

type XmlNode = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object' && 'text' in value) {
    return textValue((value as { text?: unknown }).text);
  }

  return '';
}

function parseXml(xml: string) {
  const parser = new XMLParser(XML_OPTIONS);
  return parser.parse(xml);
}

function parseStyles(xml: string): Record<string, string> {
  const parsed = parseXml(xml) as {
    styles?: { style?: Array<{ styleId?: string; name?: { val?: string } }> };
  };

  const styles = asArray(parsed.styles?.style);
  return styles.reduce<Record<string, string>>((acc, style) => {
    if (style.styleId) {
      acc[style.styleId] = style.name?.val || style.styleId;
    }
    return acc;
  }, {});
}

function parseRelationships(xml: string): Record<string, string> {
  const parsed = parseXml(xml) as {
    Relationships?: {
      Relationship?: Array<{ Id?: string; Target?: string }>;
    };
  };

  return asArray(parsed.Relationships?.Relationship).reduce<Record<string, string>>(
    (acc, relation) => {
      if (relation.Id && relation.Target) {
        acc[relation.Id] = relation.Target;
      }
      return acc;
    },
    {},
  );
}

function extractRunText(run: XmlNode): string {
  let text = '';

  for (const entry of asArray(run.t as unknown[])) {
    text += textValue(entry);
  }

  if (run.tab !== undefined) {
    text += '\t';
  }

  for (const br of asArray(run.br as XmlNode[])) {
    void br;
    text += '\n';
  }

  return text;
}

function extractRunsFromParagraph(
  paragraph: XmlNode,
  relationships: Record<string, string>,
): NormalizedRun[] {
  const runs: NormalizedRun[] = [];

  for (const run of asArray(paragraph.r as XmlNode[])) {
    const rPr = (run.rPr || {}) as XmlNode;
    const text = extractRunText(run);
    if (!text) {
      continue;
    }
    runs.push({
      text,
      bold: rPr.b !== undefined,
      italic: rPr.i !== undefined,
      underline: rPr.u !== undefined,
      smallCaps: rPr.smallCaps !== undefined,
    });
  }

  for (const hyperlink of asArray(paragraph.hyperlink as XmlNode[])) {
    const href = typeof hyperlink.id === 'string' ? relationships[hyperlink.id] : undefined;
    for (const run of asArray(hyperlink.r as XmlNode[])) {
      const rPr = (run.rPr || {}) as XmlNode;
      const text = extractRunText(run);
      if (!text) {
        continue;
      }
      runs.push({
        text,
        href,
        bold: rPr.b !== undefined,
        italic: rPr.i !== undefined,
        underline: rPr.u !== undefined,
        smallCaps: rPr.smallCaps !== undefined,
      });
    }
  }

  return runs;
}

function parseHeadingLevel(styleName?: string) {
  if (!styleName) {
    return undefined;
  }
  const match = styleName.match(/^Heading\s+(\d+)$/i);
  return match ? Number(match[1]) : undefined;
}

function parseParagraphs(
  xml: string,
  styleMap: Record<string, string>,
  relationships: Record<string, string>,
): NormalizedParagraph[] {
  const parsed = parseXml(xml) as {
    document?: { body?: { p?: XmlNode[] } };
  };

  return asArray(parsed.document?.body?.p).map((paragraph, index) => {
    const styleId = typeof (paragraph.pPr as XmlNode | undefined)?.pStyle === 'object'
      ? ((paragraph.pPr as XmlNode).pStyle as { val?: string }).val
      : undefined;
    const styleName = styleId ? styleMap[styleId] || styleId : undefined;
    const runs = extractRunsFromParagraph(paragraph, relationships);
    const text = runs.map((run) => run.text).join('');

    return {
      id: `p-${index + 1}`,
      index,
      styleId,
      styleName,
      headingLevel: parseHeadingLevel(styleName),
      text,
      runs,
    };
  });
}

export async function parseDocxDocument(file: Blob): Promise<NormalizedDocxDocument> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await zip.file('word/document.xml')?.async('string');
  const stylesXml = await zip.file('word/styles.xml')?.async('string');
  const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string');

  if (!documentXml) {
    throw new Error('Missing word/document.xml in .docx archive');
  }

  const styleMap = stylesXml ? parseStyles(stylesXml) : {};
  const relationships = relsXml ? parseRelationships(relsXml) : {};
  const paragraphs = parseParagraphs(documentXml, styleMap, relationships).filter(
    (paragraph) => paragraph.text.trim() || paragraph.headingLevel,
  );

  return {
    paragraphs,
    sourcePaths: [
      'word/document.xml',
      ...(stylesXml ? ['word/styles.xml'] : []),
      ...(relsXml ? ['word/_rels/document.xml.rels'] : []),
    ],
  };
}
