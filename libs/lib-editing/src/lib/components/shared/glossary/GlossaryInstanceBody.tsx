'use client';

import type { GlossaryTermInstance } from '@eightyfourthousand/data-access';
import { Button, Li, Ul } from '@eightyfourthousand/design-system';
import { GatedFeature } from '@eightyfourthousand/lib-instr';
import { cn } from '@eightyfourthousand/lib-utils';
import { useCallback, useRef, useState } from 'react';
import { useGlossaryInstanceListener } from '../hooks/useGlossaryInstanceListener';
import { useNavigation } from '../NavigationProvider';
import { TAB_FOR_SECTION, PANEL_FOR_SECTION } from '../types';
import {
  createGraphQLClient,
  getTermPassages,
} from '@eightyfourthousand/client-graphql';

type PassageItem = { uuid: string; type: string; label: string };

export const GlossaryInstanceBody = ({
  instance,
  className,
  isEditor = false,
}: {
  instance: GlossaryTermInstance;
  className?: string;
  isEditor?: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useGlossaryInstanceListener({ ref });
  const { updatePanel } = useNavigation();

  const initialPage = instance.passages;
  const [passages, setPassages] = useState<PassageItem[]>(
    initialPage?.items ?? [],
  );
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialPage?.nextCursor ?? null,
  );
  const [hasMore, setHasMore] = useState(initialPage?.hasMore ?? false);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(() => {
    if (!nextCursor || loading) return;
    setLoading(true);
    getTermPassages({
      client: createGraphQLClient(),
      uuid: instance.uuid,
      first: 10,
      after: nextCursor,
    }).then((page) => {
      setPassages((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setLoading(false);
    });
  }, [instance.uuid, nextCursor, loading]);

  const handlePassageClick = useCallback(
    (passage: PassageItem) => {
      updatePanel({
        name: PANEL_FOR_SECTION[passage.type] || 'main',
        state: {
          open: true,
          tab: TAB_FOR_SECTION[passage.type] || 'translation',
          hash: passage.uuid,
        },
      });
    },
    [updatePanel],
  );

  return (
    <div className={cn('p-2 flex gap-1 flex-col', className)}>
      {instance.names.english && (
        <div className="text-primary font-sans text-base font-bold">
          {instance.names.english}
        </div>
      )}
      {isEditor && instance.names.alternatives && (
        <div className="text-sm text-accent">
          {`Also: ${instance.names.alternatives}`}
        </div>
      )}
      <Ul>
        {instance.names.wylie && (
          <Li className="italic">{instance.names.wylie}</Li>
        )}
        {instance.names.tibetan && (
          <Li className="pt-1">
            <span className="font-tibetan text-base">
              {instance.names.tibetan}
            </span>
          </Li>
        )}
        {instance.names.sanskrit && (
          <Li className="italic">{instance.names.sanskrit}</Li>
        )}
        {instance.names.chinese && <Li>{instance.names.chinese}</Li>}
        {instance.names.pali && (
          <Li className="italic">{instance.names.pali}</Li>
        )}
      </Ul>
      {instance.definition && (
        <div
          ref={ref}
          className="glossary-instance-definition"
          dangerouslySetInnerHTML={{ __html: instance.definition }}
        />
      )}
      {passages.length > 0 && (
        <div>
          {passages.map((passage, index) => (
            <span key={passage.uuid}>
              {index > 0 && ', '}
              <Button
                variant="link"
                className="p-0 h-6 font-normal hover:cursor-pointer"
                onClick={() => handlePassageClick(passage)}
              >
                {passage.label || passage.uuid.slice(0, 6)}
              </Button>
            </span>
          ))}
          {hasMore && !loading && (
            <span>
              {', '}
              <Button
                variant="link"
                className="p-0 h-6 font-normal hover:cursor-pointer"
                onClick={loadMore}
              >
                more &rsaquo;
              </Button>
            </span>
          )}
          {loading && (
            <span className="text-muted-foreground text-sm">{', …'}</span>
          )}
        </div>
      )}
      <GatedFeature flag="authority-pages">
        <div className="text-sm text-mut my-2">
          <a
            href={`/glossary/${instance.authority}`}
            target="_blank"
            rel="noreferrer"
            className="hover:underline decoration-primary hover:text-primary"
          >
            {'View full entry ›'}
          </a>
        </div>
      </GatedFeature>
    </div>
  );
};
