'use client';

import { ThreeColumns } from '@84000/design-system';
import { ReactNode } from 'react';
import { useNavigation } from './NavigationProvider';
import { cn } from '@84000/lib-utils';
import { TranslationHeader } from './TranslationHeader';

export const ThreeColumnRenderer = ({
  withHeader = false,
  children,
}: {
  withHeader?: boolean;
  children: ReactNode;
}) => {
  const { panels, updatePanel, hasTranslationContent } = useNavigation();
  const rightPanelEnabled = hasTranslationContent;

  return (
    <div
      className={cn(
        'fixed flex flex-col size-full p-2 bg-canvas',
        withHeader ? 'pb-20' : '',
      )}
    >
      <div className="pb-2.5">
        <TranslationHeader className="rounded-full shadow-lg" />
      </div>
      <ThreeColumns
        leftPanelOpen={panels.left.open}
        rightPanelOpen={rightPanelEnabled ? panels.right.open : false}
        rightPanelEnabled={rightPanelEnabled}
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
