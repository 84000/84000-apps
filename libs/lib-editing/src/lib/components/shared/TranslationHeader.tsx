'use client';

import { Button, MiniLogo } from '@design-system';
import { PassageMatch, SearchButton, SearchResult } from '@lib-search';
import { useNavigation } from './NavigationProvider';
import { useCallback } from 'react';
import { PanelName, PanelState, TabName } from './types';
import { BodyItemType } from '@data-access';
import { cn } from '@lib-utils';

const BACK_TO_DEFAULT = 'https://84000.co/all-publications';

export const TranslationHeader = ({ className }: { className?: string }) => {
  const { imprint, uuid, toh, updatePanel } = useNavigation();

  const onResultSelected = useCallback(
    (result: SearchResult) => {
      let side: PanelName = 'main';
      const panelState: PanelState = {
        open: true,
        hash: result.uuid,
      };

      const TAB_FOR_PASSAGE_SECTION: Partial<Record<BodyItemType, TabName>> = {
        abbreviations: 'abbreviations',
        endnotes: 'endnotes',
        summary: 'front',
        introduction: 'front',
        acknowledgements: 'front',
      };

      const SIDE_FOR_PASSAGE_SECTION: Partial<Record<BodyItemType, PanelName>> =
        {
          abbreviations: 'right',
          endnotes: 'right',
        };

      switch (result.type) {
        case 'passage':
          {
            const passage = result as PassageMatch;
            side = SIDE_FOR_PASSAGE_SECTION[passage.section] || 'main';
            panelState.tab =
              TAB_FOR_PASSAGE_SECTION[passage.section] || 'translation';
          }
          break;
        case 'alignment':
          side = 'main';
          panelState.tab = 'compare';
          break;
        case 'bibliography':
          side = 'right';
          panelState.tab = 'bibliography';
          break;
        case 'glossary':
          side = 'right';
          panelState.tab = 'glossary';
          break;
      }

      updatePanel({
        name: side,
        state: panelState,
      });
    },
    [updatePanel],
  );
  return (
    <div
      className={cn(
        'h-11 w-full px-0 lg:px-3 flex justify-between text-lg bg-background',
        className,
      )}
    >
      <div className="flex gap-2 md:gap-5 min-w-0">
        <Button
          variant="ghost"
          className="text-accent my-auto text-base px-3 cursor-pointer hover:bg-background hover:text-accent/80 min-w-16"
          onClick={() => {
            window.location.href = BACK_TO_DEFAULT;
          }}
        >
          <MiniLogo width={32} height={32} />
        </Button>
        <span className="font-serif font-light truncate text-darkgray text-xs sm:text-sm my-auto flex-shrink">
          {`${imprint?.mainTitles?.en ? `“${imprint?.mainTitles?.en}”` : ''}${imprint?.section ? ` from ${imprint?.section}` : ''}`}
        </span>
      </div>
      <SearchButton
        workUuid={uuid}
        toh={toh}
        onResultSelected={onResultSelected}
      />
    </div>
  );
};
