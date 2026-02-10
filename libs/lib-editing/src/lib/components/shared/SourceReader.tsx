'use client';

import { useInView } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from './NavigationProvider';
import { createGraphQLClient, getWorkFolios } from '@client-graphql';
import type { Folio } from '@data-access';
import { LabeledElement } from './LabeledElement';
import { PassageSkeleton } from './PassageSkeleton';
import { LotusPond } from '@design-system';

const PAGE_SIZE = 10;

export const SourceReader = () => {
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [folios, setFolios] = useState<Folio[]>([]);

  const { toh, uuid } = useNavigation();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const shouldLoadMore = useInView(loadMoreRef);
  const graphqlClient = createGraphQLClient();

  const fetchMore = useCallback(async () => {
    if (!toh || !uuid) return;

    const folios = await getWorkFolios({
      client: graphqlClient,
      uuid,
      toh,
      page,
      size: PAGE_SIZE,
    });
    if (folios.length) {
      setPage((prevPage) => prevPage + 1);
      setFolios((prevFolios) => [...prevFolios, ...folios]);
      setHasMore(folios.length >= PAGE_SIZE);
    }
  }, [toh, uuid, page, graphqlClient]);

  useEffect(() => {
    if (shouldLoadMore && hasMore) {
      fetchMore();
    }
  }, [shouldLoadMore, hasMore, fetchMore]);

  useEffect(() => {
    // Reset when uuid or toh changes
    setFolios([]);
    setPage(0);
    setHasMore(true);
  }, [toh, uuid]);

  return (
    <div className="pt-12 flex flex-col gap-5 mx-auto max-w-readable 2xl:max-w-380">
      {folios.map((folio, index) => (
        <LabeledElement
          key={index}
          id={folio.uuid}
          label={`f.${folio.folio}.${folio.side}\nvol.${folio.volume}`}
          className="mt-0.5"
          contentType="source"
        >
          <div className="leading-7 font-tibetan text-lg 2xl:whitespace-pre-wrap whitespace-normal">
            {folio.content}
          </div>
        </LabeledElement>
      ))}
      <div ref={loadMoreRef} className="h-0" />
      {hasMore ? (
        <>
          {Array.from({ length: 3 }).map((_, i) => (
            <PassageSkeleton key={i} />
          ))}
        </>
      ) : (
        <div className="w-full pt-16 pb-6">
          <LotusPond className="mx-auto w-96" />
        </div>
      )}
    </div>
  );
};
