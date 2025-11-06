'use client';

import { useInView } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from './NavigationProvider';
import { Folio, getFolios } from '@data-access';
import { Skeleton } from '@design-system';
import { LabeledElement } from './LabeledElement';

const PAGE_SIZE = 10;

export const SourceReader = () => {
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [folios, setFolios] = useState<Folio[]>([]);

  const { toh, uuid } = useNavigation();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const shouldLoadMore = useInView(loadMoreRef);

  const fetchMore = useCallback(async () => {
    if (!toh || !uuid) return;

    const folios = await getFolios({
      toh,
      uuid,
      page,
      size: PAGE_SIZE,
    });
    if (folios.length) {
      setPage((prevPage) => prevPage + 1);
      setFolios((prevFolios) => [...prevFolios, ...folios]);
      setHasMore(folios.length >= PAGE_SIZE);
    }
  }, [toh, uuid, page]);

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
    <div className="p-8 flex flex-col gap-8 mx-auto max-w-5xl 2xl:max-w-380">
      {folios.map((folio, index) => (
        <LabeledElement
          key={index}
          label={`f.${folio.folio}.${folio.side}\nvol.${folio.volume}`}
        >
          <div className="-mt-1 leading-8 text-lg 2xl:whitespace-pre-wrap whitespace-normal">
            {folio.content}
          </div>
        </LabeledElement>
      ))}
      <div ref={loadMoreRef} className="h-0" />
      {hasMore && (
        <>
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="flex gap-5" key={i}>
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-32 grow" />
            </div>
          ))}
        </>
      )}
    </div>
  );
};
