'use client';

import {
  createGraphQLClient,
  searchEntities,
} from '@eightyfourthousand/client-graphql';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '../../../shared';

const DEBOUNCE_MS = 300;

export type MentionLinkType =
  | 'work'
  | 'passage'
  | 'folio'
  | 'bibliography'
  | 'glossary';

export interface MentionSearchResult {
  /** UUID of the linked entity (becomes the mention item's `entity`). */
  entity: string;
  linkType: MentionLinkType;
  /** Short identifier shown as the primary label. */
  label: string;
  /** Secondary descriptive text shown beneath the label. */
  text: string;
}

/** Display order and section headings for grouped mention results. */
export const MENTION_TYPE_ORDER: MentionLinkType[] = [
  'passage',
  'folio',
  'work',
  'glossary',
  'bibliography',
];

export const MENTION_TYPE_LABELS: Record<MentionLinkType, string> = {
  work: 'Works',
  passage: 'Passages',
  folio: 'Folios',
  bibliography: 'Bibliography',
  glossary: 'Glossary',
};

export interface MentionResultGroup {
  type: MentionLinkType;
  label: string;
  items: MentionSearchResult[];
}

/** Group results by entity type, preserving the canonical section order. */
export const groupMentionResults = (
  results: MentionSearchResult[],
): MentionResultGroup[] =>
  MENTION_TYPE_ORDER.map((type) => ({
    type,
    label: MENTION_TYPE_LABELS[type],
    items: results.filter((r) => r.linkType === type),
  })).filter((group) => group.items.length > 0);

/**
 * Debounced entity search backed by the top-level GraphQL `search` query
 * (data-access `search_entities`). Returns mention candidates: other works
 * (global) plus passages, folios, bibliographies, and glossary terms scoped to
 * a work.
 *
 * The searched work defaults to the current work but can be re-targeted with a
 * `toh` override. When the toh differs from the current work's, the known
 * workUuid is dropped so the server resolves the work from the toh.
 */
export const useMentionSearch = (query: string, toh?: string) => {
  const { uuid: navWorkUuid, toh: navToh } = useNavigation();
  const effectiveToh = (toh ?? navToh ?? '').trim() || undefined;
  // Fast path: only pass the known workUuid when searching the current work.
  // Otherwise let the toh resolve the target work server-side.
  const workUuid = effectiveToh === navToh ? navWorkUuid : undefined;

  const [results, setResults] = useState<MentionSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestId = useRef(0);

  const runSearch = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      const id = ++requestId.current;
      setLoading(true);
      const client = createGraphQLClient();
      const matches = await searchEntities({
        client,
        query: text.trim(),
        workUuid,
        toh: effectiveToh,
        // Top 5 per category (the SQL applies the limit per entity type).
        limit: 5,
      });

      // Ignore out-of-order responses.
      if (id !== requestId.current) {
        return;
      }
      setResults(
        matches.map((m) => ({
          entity: m.uuid,
          linkType: m.type,
          label: m.label,
          text: m.text,
        })),
      );
      setLoading(false);
    },
    [workUuid, effectiveToh],
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => runSearch(query), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, runSearch]);

  return { results, loading };
};
