import type { Level } from '@tiptap/extension-heading';
import { cn } from '@eightyfourthousand/lib-utils';
import {
  BODY_TITLE_STYLE,
  H1_STYLE,
  H2_STYLE,
  H3_STYLE,
  H4_STYLE,
  H5_STYLE,
  H6_STYLE,
  HONORIFIC_TITLE_STYLE,
  SECTION_TITLE_STYLE,
} from '@eightyfourthousand/design-system';

export const CLASS_FOR_LEVEL: Record<Level, string> = {
  1: H1_STYLE,
  2: H2_STYLE,
  3: H3_STYLE,
  4: H4_STYLE,
  5: H5_STYLE,
  6: H6_STYLE,
};

export const CLASS_FOR_CLASS: Record<string, string> = {
  'section-title': SECTION_TITLE_STYLE,
  'body-title-main': BODY_TITLE_STYLE,
  'body-title-honorific': HONORIFIC_TITLE_STYLE,
};

export const resolveHeadingPresentation = ({
  rawLevel,
  classAttr,
  levels,
}: {
  rawLevel: unknown;
  classAttr: string | null | undefined;
  levels: Level[];
}) => {
  const nodeLevel = parseInt(String(rawLevel), 10) as Level;
  const level = levels.includes(nodeLevel) ? nodeLevel : levels.at(-1);
  const className = cn(
    CLASS_FOR_LEVEL[nodeLevel],
    classAttr ? CLASS_FOR_CLASS[classAttr] : undefined,
  );
  return { level, tag: `h${level}`, className };
};
