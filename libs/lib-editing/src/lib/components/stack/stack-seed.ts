import type { JSONContent } from '@tiptap/core';
import {
  BODY_MATTER_FILTER,
  FRONT_MATTER_FILTER,
} from '@eightyfourthousand/data-access';

import type { RowMetaPage, SpineSection } from './spine-feed';
import type { PassageExtras } from './types';

/**
 * The sections drawn as stacks, **in the order the work reads**.
 *
 * Order is load bearing: a section whose run is still empty is appended at the
 * end of the spine, so seeding them out of order would put the back matter
 * before the body.
 */
export const STACK_SECTIONS: SpineSection[] = [
  // The filter matches each type's `*Header` too.
  { tab: 'front', type: FRONT_MATTER_FILTER },
  { tab: 'translation', type: BODY_MATTER_FILTER },
  // Between the body and the notes, as every work that has them reads.
  { tab: 'abbreviations', type: 'abbreviations' },
  { tab: 'endnotes', type: 'endnotes' },
];

/** How many passages to put in the spine before the reader asks for more. */
export const FIRST_PAGE = 100;

/** The tab the bibliography is drawn in, from its own work. */
export const BIBLIOGRAPHY_TAB = 'bibliography';

/** A passage's content as the stack stores it, with its row data. */
export type StackSeedPassage = {
  uuid: string;
  content: JSONContent[];
  extras?: PassageExtras;
};

/** One section's first page, read ahead of the stack. */
export type StackSectionSeed = {
  tab: string;
  /** Its first page of metadata, which the section's feed continues from. */
  page: RowMetaPage;
  /** Content for its first passages: the ones a first render draws. */
  passages: StackSeedPassage[];
};

/**
 * What a server reads so the stack can be built without a request: plain data,
 * so it can be handed from a server component to the provider.
 */
export type StackReaderSeed = {
  workUuid: string;
  /** In `STACK_SECTIONS` order. */
  sections: StackSectionSeed[];
};

/**
 * A translation block as the API serves it, as stored content and row data.
 * Null for a block with no uuid.
 */
export const passageFromBlock = (block: {
  attrs?: Record<string, unknown>;
  content?: unknown[];
}): StackSeedPassage | null => {
  const uuid = block?.attrs?.uuid as string | undefined;
  if (!uuid) return null;
  const references = block.attrs?.references as
    | PassageExtras['references']
    | undefined;
  const alignments = block.attrs?.alignments as
    | PassageExtras['alignments']
    | undefined;
  return {
    uuid,
    content: (block.content ?? []) as JSONContent[],
    extras: {
      ...(references?.length ? { references } : {}),
      ...(alignments && Object.keys(alignments).length ? { alignments } : {}),
    },
  };
};
