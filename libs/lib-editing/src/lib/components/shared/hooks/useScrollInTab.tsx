'use client';

import { useEffect, useRef } from 'react';
import { PanelName, TabName } from '../types';
import { useNavigation } from '../NavigationProvider';
import { scrollToElement } from '@lib-utils';

export const useScrollInTab = ({
  panel,
  tab,
}: {
  panel: PanelName;
  tab: TabName;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { panels, updatePanel } = useNavigation();

  useEffect(() => {
    const div = ref.current;
    if (!div) {
      return;
    }

    const { open, hash, tab: currentTab } = panels[panel];

    if (!open || !hash || currentTab !== tab) {
      return;
    }

    (async () => {
      const element = div.querySelector<HTMLElement>(`#${CSS.escape(hash)}`);
      if (element) {
        await scrollToElement({ element, behavior: 'smooth' });
        updatePanel({
          name: panel,
          state: { open, tab: currentTab, hash: undefined },
        });
      }
    })();
  }, [panels, panel, tab, updatePanel]);

  return { ref };
};
