'use client';

import { SaveButton } from '@design-system';
import { PassageMatch, SearchButton, SearchResult } from '@lib-search';
import { useEditorState } from './EditorProvider';
import { useCallback, useEffect, useState } from 'react';
import { PanelName, PanelState, TabName, useNavigation } from '../shared';
import { BodyItemType } from '@data-access';

export const EditorHeader = () => {
  const [canSave, setCanSave] = useState(false);
  const { dirtyUuids, save } = useEditorState();
  const { toh, uuid, updatePanel } = useNavigation();

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

  useEffect(() => {
    setCanSave(dirtyUuids.length > 0);
  }, [dirtyUuids]);

  return (
    <div className="px-4 py-3 flex justify-end h-12 z-10 gap-2">
      {canSave && (
        <SaveButton size="xs" onClick={save} disabled={!dirtyUuids.length} />
      )}
      <SearchButton
        workUuid={uuid}
        toh={toh}
        onResultSelected={onResultSelected}
      />
    </div>
  );
};
