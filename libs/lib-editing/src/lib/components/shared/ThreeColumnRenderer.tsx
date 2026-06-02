'use client';

import { ThreeColumns } from '@eightyfourthousand/design-system';
import { ReactNode, useMemo } from 'react';
import { useNavigation } from './NavigationProvider';
import { cn } from '@eightyfourthousand/lib-utils';
import { TranslationHeader } from './TranslationHeader';
import { ReaderSearchButton } from './ReaderSearchButton';
import { FocusToggleButton } from './FocusToggleButton';
import { GatedFeature } from '@eightyfourthousand/lib-instr';

export const ThreeColumnRenderer = ({
  withHeader = false,
  withFocusToggle = false,
  children,
}: {
  withHeader?: boolean;
  withFocusToggle?: boolean;
  children: ReactNode;
}) => {
  const { panels, updatePanel, hasTranslationContent, focusMode } =
    useNavigation();
  const rightPanelEnabled = hasTranslationContent;

  const mainPanelActions = useMemo(
    () => (
      <>
        {withFocusToggle && <FocusToggleButton />}
        <ReaderSearchButton />
      </>
    ),
    [withFocusToggle],
  );

  return (
    <div
      className={cn(
        'fixed flex flex-col size-full p-2 bg-canvas',
        withHeader ? 'pb-20' : '',
        withFocusToggle && focusMode && 'focus-mode',
      )}
    >
      <GatedFeature flag='show-reader-header'>
        <div className="pb-2.5">
          <TranslationHeader className="rounded-full shadow-lg" />
        </div>
      </GatedFeature>
      <ThreeColumns
        leftPanelOpen={panels.left.open}
        rightPanelOpen={rightPanelEnabled ? panels.right.open : false}
        rightPanelEnabled={rightPanelEnabled}
        mainPanelActions={mainPanelActions}
        onLeftPanelOpenChange={(open) => {
          updatePanel({
            name: 'left',
            state: { open, tab: panels.left.tab },
          });
        }}
        onRightPanelOpenChange={
          rightPanelEnabled
            ? (open) => {
              updatePanel({
                name: 'right',
                state: { open, tab: panels.right.tab },
              });
            }
            : undefined
        }
      >
        {children}
      </ThreeColumns>
    </div>
  );
};
