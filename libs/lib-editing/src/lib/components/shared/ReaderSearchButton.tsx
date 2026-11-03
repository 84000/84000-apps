'use client';

import {
  PassageMatch,
  RenderAlignmentEnglish,
  SearchButton,
  SearchResult,
} from '@eightyfourthousand/lib-search';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useEditorState } from '../editor/EditorProvider';
import { useNavigation } from './NavigationProvider';
import { SearchAlignmentEnglish } from './SearchAlignmentEnglish';
import { SearchReplacePanel } from './SearchReplacePanel';
import { createStaticPassageBatcher } from './static-passage-batcher';
import { locationForPassageType, PanelName, PanelState } from './types';

export const ReaderSearchButton = () => {
  const { uuid, toh, updatePanel } = useNavigation();
  const { applyReplacedPassages, readOnly, dirtyStore } = useEditorState();
  // Read-only covers both a user without edit permission and an editor who
  // chose to read, so replace follows it rather than permission alone.
  const canReplace = !readOnly;
  const isDirty = useSyncExternalStore(
    dirtyStore.subscribe.bind(dirtyStore),
    dirtyStore.getSnapshot.bind(dirtyStore),
    () => false,
  );

  // Translation Passages show the English as the reader does, folio markers
  // included, reading only the results scrolled into view.
  const renderAlignmentEnglish = useMemo<
    RenderAlignmentEnglish | undefined
  >(() => {
    if (!uuid) return undefined;
    const batcher = createStaticPassageBatcher({ workUuid: uuid });
    const render: RenderAlignmentEnglish = (props) => (
      <SearchAlignmentEnglish {...props} batcher={batcher} />
    );
    return render;
  }, [uuid]);

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
      renderAlignmentEnglish={renderAlignmentEnglish}
      renderActions={(searchContext) => (
        <SearchReplacePanel
          canReplace={canReplace}
          replaceDisabledReason={
            isDirty
              ? 'Save changes before using search and replace.'
              : undefined
          }
          onPassagesReplaced={applyReplacedPassages}
          searchContext={searchContext}
        />
      )}
    />
  );
};
