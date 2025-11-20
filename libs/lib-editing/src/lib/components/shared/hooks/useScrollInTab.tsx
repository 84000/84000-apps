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
  const { panels } = useNavigation();

  useEffect(() => {
    const div = ref.current;
    if (!div) {
      return;
    }

    const { open, hash, tab: currentTab } = panels[panel];

    if (!open || !hash || currentTab !== tab) {
      return;
    }

    const element = div.querySelector<HTMLElement>(`#${CSS.escape(hash)}`);
    if (element) {
      scrollToElement({ element, delay: 10 });
    }
  }, [panels, panel, tab]);

  return { ref };
};
