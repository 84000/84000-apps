'use client';

import { BodyItemType } from '@eightyfourthousand/data-access';
import {
  PassageMatch,
  SearchButton,
  SearchResult,
} from '@eightyfourthousand/lib-search';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useEditorState } from '../editor/EditorProvider';
import { useNavigation } from './NavigationProvider';
import { SearchReplacePanel } from './SearchReplacePanel';
import { PanelName, PanelState, TabName } from './types';

export const ReaderSearchButton = () => {
  const { uuid, toh, updatePanel } = useNavigation();
  const { applyReplacedPassages, canEdit, dirtyStore } = useEditorState();
  const [canReplace, setCanReplace] = useState(false);
  const isDirty = useSyncExternalStore(
    dirtyStore.subscribe.bind(dirtyStore),
    dirtyStore.getSnapshot.bind(dirtyStore),
    () => false,
  );

  useEffect(() => {
    let active = true;

    (async () => {
      const editable = await canEdit();
      if (active) {
        setCanReplace(editable);
      }
    })();

    return () => {
      active = false;
    };
  }, [canEdit]);

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
      renderActions={(searchContext) => (
        <SearchReplacePanel
          canReplace={canReplace}
          replaceDisabledReason={
            isDirty ? 'Save changes before using search and replace.' : undefined
          }
          onPassagesReplaced={applyReplacedPassages}
          searchContext={searchContext}
        />
      )}
    />
  );
};
