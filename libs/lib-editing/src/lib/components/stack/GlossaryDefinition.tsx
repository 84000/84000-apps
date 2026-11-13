'use client';

import {
  GLOSSARY_DEFINITION_ALLOWLIST,
  sanitizeHtml,
} from '@eightyfourthousand/data-access';

import { glossaryDefinitionToContent } from './glossary-codec';
import { renderGlossaryRow } from './glossary-work';

/**
 * A stored definition as the row draws it, through the glossary codec. An
 * authority's definition is not saved through the entry's sanitizing save, so
 * it is sanitized here first.
 */
const definitionHtml = (definition: string | null) =>
  renderGlossaryRow({
    type: 'doc',
    content: glossaryDefinitionToContent(
      sanitizeHtml({
        html: definition ?? '',
        allowlist: GLOSSARY_DEFINITION_ALLOWLIST,
      }),
    ),
  });

/** A stored definition as the row draws it, or `empty` when it has no text. */
export const GlossaryDefinition = ({
  html,
  empty,
  ...props
}: {
  html: string | null;
  empty: string;
  'data-glossary-entry-standard'?: string;
}) => {
  const drawn = definitionHtml(html);
  if (!drawn) {
    return (
      <p className="text-muted-foreground text-sm italic" {...props}>
        {empty}
      </p>
    );
  }
  return (
    <div
      className="rounded-md border bg-muted/30 p-2 font-serif text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: drawn }}
      {...props}
    />
  );
};
