'use client';

import { useCallback, useRef } from 'react';
import type { GraphQLClient } from 'graphql-request';
import {
  getBibliographyEntry,
  getGlossaryInstance,
  getPassage,
  getTranslationMetadataByUuid,
} from '@eightyfourthousand/client-graphql';
import type {
  BibliographyEntryItem,
  GlossaryTermInstance,
  Passage,
  Work,
} from '@eightyfourthousand/data-access';

/** Cached lookups for the entities a navigation link can point at. */
export const useNavigationFetchers = (graphqlClient: GraphQLClient) => {
  const bibliographyCache = useRef<{ [uuid: string]: BibliographyEntryItem }>(
    {},
  );
  const endnoteCache = useRef<{ [uuid: string]: Passage }>({});
  const glossaryCache = useRef<{ [uuid: string]: GlossaryTermInstance }>({});
  const passageCache = useRef<{ [uuid: string]: Passage }>({});
  const workCache = useRef<{ [uuid: string]: Work }>({});

  const fetchBibliographyEntry = useCallback(
    async (uuid: string): Promise<BibliographyEntryItem | undefined> => {
      if (!bibliographyCache.current) {
        bibliographyCache.current = {};
      }

      if (bibliographyCache.current[uuid]) {
        return bibliographyCache.current[uuid];
      }

      const entry = await getBibliographyEntry({
        client: graphqlClient,
        uuid,
      });
      if (!entry) {
        return undefined;
      }

      bibliographyCache.current[uuid] = entry;
      return entry;
    },
    [graphqlClient],
  );

  const fetchEndNote = useCallback(
    async (uuid: string): Promise<Passage | undefined> => {
      if (!endnoteCache.current) {
        endnoteCache.current = {};
      }

      if (endnoteCache.current[uuid]) {
        return endnoteCache.current[uuid];
      }

      const endnote = await getPassage({ client: graphqlClient, uuid });
      if (!endnote) {
        return undefined;
      }

      endnoteCache.current[uuid] = endnote;
      return endnote;
    },
    [graphqlClient],
  );

  const fetchGlossaryTerm = useCallback(
    async (uuid: string) => {
      if (!glossaryCache.current) {
        glossaryCache.current = {};
      }

      if (glossaryCache.current[uuid]) {
        return glossaryCache.current[uuid];
      }

      const term = await getGlossaryInstance({ client: graphqlClient, uuid });
      if (!term) {
        return undefined;
      }

      glossaryCache.current[uuid] = term;
      return term;
    },
    [graphqlClient],
  );

  const fetchPassage = useCallback(
    async (uuid: string): Promise<Passage | undefined> => {
      if (!passageCache.current) {
        passageCache.current = {};
      }

      if (passageCache.current[uuid]) {
        return passageCache.current[uuid];
      }

      const passage = await getPassage({ client: graphqlClient, uuid });
      if (!passage) {
        return undefined;
      }

      passageCache.current[uuid] = passage;
      return passage;
    },
    [graphqlClient],
  );

  const fetchWork = useCallback(
    async (uuid: string): Promise<Work | undefined> => {
      if (!workCache.current) {
        workCache.current = {};
      }

      if (workCache.current[uuid]) {
        return workCache.current[uuid];
      }

      const work = await getTranslationMetadataByUuid({
        client: graphqlClient,
        uuid,
      });
      if (!work) {
        return undefined;
      }

      workCache.current[uuid] = work;
      return work;
    },
    [graphqlClient],
  );

  return {
    fetchBibliographyEntry,
    fetchEndNote,
    fetchGlossaryTerm,
    fetchPassage,
    fetchWork,
  };
};
