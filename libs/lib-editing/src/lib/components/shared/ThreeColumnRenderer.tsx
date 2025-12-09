'use client';

import { ThreeColumns } from '@design-system';
import { ReactNode } from 'react';
import { useNavigation } from './NavigationProvider';
import { cn } from '@lib-utils';
import { TranslationHeader } from './TranslationHeader';

export const ThreeColumnRenderer = ({
  withHeader = false,
  children,
}: {
  withHeader?: boolean;
  children: ReactNode;
}) => {
  const { panels, updatePanel } = useNavigation();

  return (
    <div
      className={cn(
        'fixed flex flex-col size-full p-2',
        withHeader ? 'pb-20' : '',
      )}
    >
      <div className="pb-2.5">
        <TranslationHeader className="rounded-full shadow-lg" />
      </div>
      <ThreeColumns
        leftPanelOpen={panels.left.open}
        rightPanelOpen={panels.right.open}
        onLeftPanelOpenChange={(open) => {
          updatePanel({
            name: 'left',
            state: { open, tab: panels.left.tab },
          });
        }}
        onRightPanelOpenChange={(open) => {
          updatePanel({
            name: 'right',
            state: { open, tab: panels.right.tab },
          });
        }}
      >
        {children}
      </ThreeColumns>
    </div>
  );
};
