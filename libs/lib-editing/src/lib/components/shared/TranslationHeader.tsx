'use client';

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from '@design-system';
import { PassageMatch, SearchButton, SearchResult } from '@lib-search';
import { ChevronLeftIcon, MenuIcon } from 'lucide-react';
import { useNavigation } from './NavigationProvider';
import { useCallback, useEffect, useState } from 'react';
import { PanelName, PanelState, TabName } from './types';
import { BodyItemType } from '@data-access';
import { cn, useIsMobile } from '@lib-utils';

const BACK_TO_DEFAULT = 'https://84000.co/all-publications';

export const TranslationHeader = ({ className }: { className?: string }) => {
  const { imprint, uuid, toh, updatePanel } = useNavigation();
  const isMobile = useIsMobile();

  const [backTo, setBackTo] = useState(BACK_TO_DEFAULT);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  useEffect(() => {
    if (!document?.referrer) {
      return;
    }

    setBackTo(document.referrer);
  }, []);

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

      // Close the popover on mobile after selection
      if (isMobile) {
        setIsPopoverOpen(false);
      }
    },
    [updatePanel, isMobile],
  );
  return (
    <div
      className={cn(
        'h-12 w-full px-0 lg:px-3 flex justify-between text-lg bg-background',
        className,
      )}
    >
      <div className="flex gap-2 min-w-0">
        <Button
          variant="ghost"
          className="text-accent my-auto text-base px-3 cursor-pointer hover:bg-background hover:text-accent/80 [&_svg]:size-5 [&_svg]:stroke-2"
          onClick={() => {
            window.location.href = backTo;
          }}
        >
          <ChevronLeftIcon className="my-auto" /> Back
        </Button>
        {!isMobile && (
          <span className="font-serif font-light line-clamp-1 text-darkgray text-sm my-auto flex-shrink">
            {`${imprint?.mainTitles?.en ? `“${imprint?.mainTitles?.en}”` : ''}${imprint?.section ? ` from ${imprint?.section}` : ''}`}
          </span>
        )}
      </div>
      {!isMobile && (
        <SearchButton
          workUuid={uuid}
          toh={toh}
          onResultSelected={onResultSelected}
        />
      )}
      {isMobile && (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger className="my-auto px-2 [&_svg]:size-6 cursor-pointer hover:bg-background hover:text-primary/50">
            <MenuIcon />
          </PopoverTrigger>
          <PopoverContent
            sideOffset={8}
            className="w-[100vw] h-[100vh] border-none"
          >
            <div className="size-full flex flex-col gap-2">
              <span className="text-navy text-lg text-center">
                {`“${imprint?.mainTitles?.en}” from ${imprint?.section}`}
              </span>
              <Separator />
              <div className="w-full flex justify-center h-12 text-lg">
                <SearchButton
                  workUuid={uuid}
                  toh={toh}
                  onResultSelected={onResultSelected}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
