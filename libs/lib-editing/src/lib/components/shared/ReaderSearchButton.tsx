'use client';

import { PassageMatch, SearchButton, SearchResult } from '@eightyfourthousand/lib-search';
import { useNavigation } from './NavigationProvider';
import { useCallback } from 'react';
import { PanelName, PanelState, TabName } from './types';
import { BodyItemType } from '@eightyfourthousand/data-access';

export const ReaderSearchButton = () => {
  const { uuid, toh, updatePanel } = useNavigation();

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
    <SearchButton
      workUuid={uuid}
      toh={toh}
      onResultSelected={onResultSelected}
    />
  );
};
