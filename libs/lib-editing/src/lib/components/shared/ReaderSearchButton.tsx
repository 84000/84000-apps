'use client';

import {
  PassageMatch,
  SearchButton,
  SearchResult,
} from '@eightyfourthousand/lib-search';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useEditorState } from '../editor/EditorProvider';
import { useNavigation } from './NavigationProvider';
import { SearchReplacePanel } from './SearchReplacePanel';
import { locationForPassageType, PanelName, PanelState } from './types';

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

      switch (result.type) {
        case 'passage':
          {
            // `section` is the passage's raw type, heading rows included.
            const { panel, tab } = locationForPassageType(
              (result as PassageMatch).section,
            );
            side = panel;
            panelState.tab = tab;
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
