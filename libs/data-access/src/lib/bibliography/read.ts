import {
  BibliographyEntriesDTO,
  bibliographyEntriesFromDTO,
  BibliographyEntryItemDTO,
  bibliographyEntryItemFromDTO,
  DataClient,
} from '../types';
import {
  DEFAULT_CONTENT_SOURCE,
  relationFor,
  rpcFor,
  type ContentSource,
} from '../content-source';
import { stripCommentMarks } from '../html/comment-marks';

/**
 * A work's bibliography as readers see it, grouped by heading. Comment marks
 * are taken out: comments are draft-only, and these rows leave the editor.
 */
export const getBibliographyEntries = async ({
  client,
  uuid,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  uuid: string;
  source?: ContentSource;
}) => {
  const { data, error } = await client.rpc(
    rpcFor('showBibliographies', source),
    {
      v_work_uuid: uuid,
    },
  );
  if (error) {
    console.error(
      `Error fetching glossary instances for work: ${uuid} `,
      error,
    );
    return [];
  }

  const dto = data as BibliographyEntriesDTO;
  return bibliographyEntriesFromDTO(dto).map((section) => ({
    ...section,
    entries: section.entries.map((entry) => ({
      ...entry,
      html: entry.html && stripCommentMarks(entry.html),
    })),
  }));
};

/** One bibliography entry as readers see it, comment marks taken out. */
export const getBibliographyEntry = async ({
  client,
  uuid,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  uuid: string;
  source?: ContentSource;
}) => {
  const { data, error } = await client
    .from(relationFor('bibliographies', source))
    .select(
      `
      uuid::uuid,
      work_uuid::uuid,
      bibl_html::text
`,
    )
    .eq('uuid', uuid)
    .single();
  if (error) {
    console.error(`Error fetching bibliography entry: ${uuid} `, error);
    return null;
  }

  const entry = bibliographyEntryItemFromDTO(data as BibliographyEntryItemDTO);

  return { ...entry, html: entry.html && stripCommentMarks(entry.html) };
};

/**
 * The resolved reference label for a bibliography entry, plus a plain-text
 * citation used as a fallback when no positional label can be derived.
 */
export type BibliographyLabel = {
  uuid: string;
  label: string | null;
  citation: string;
};

/**
 * Batch-resolve bibliography reference labels (e.g. "1.2") by entry UUID via the
 * `bibliography_labels` RPC, returning a map keyed by UUID. Mirrors the label
 * convention used by the entity search picker. Used by the GraphQL bibliography
 * label DataLoader to resolve bibliography mention display text.
 */
export const getBibliographyLabelsByUuids = async ({
  client,
  uuids,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  uuids: readonly string[];
  source?: ContentSource;
}): Promise<Map<string, BibliographyLabel>> => {
  const labelsByUuid = new Map<string, BibliographyLabel>();

  if (uuids.length === 0) {
    return labelsByUuid;
  }

  const { data, error } = await client.rpc(
    rpcFor('bibliographyLabels', source),
    {
      v_uuids: uuids as string[],
    },
  );

  if (error) {
    console.error('Error batch loading bibliography labels:', error);
    return labelsByUuid;
  }

  for (const row of (data ?? []) as BibliographyLabel[]) {
    labelsByUuid.set(row.uuid, row);
  }

  return labelsByUuid;
};
