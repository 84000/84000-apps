'use client';

import { useEffect } from 'react';
import type { TohokuCatalogEntry } from '@eightyfourthousand/data-access';

import { useNavigation } from '../shared/NavigationContext';
import { useTohToggle } from '../shared/hooks/useTohToggle';

/**
 * A hook for managing the current Tohoku number. In practice, this controls
 * visibility of passages and annotations specific to a Tohoku number.
 */
export const useStackTohVisibility = ({
  tohList,
}: {
  /** The work's Tohoku entries, most canonical first. */
  tohList: TohokuCatalogEntry[];
}) => {
  const { toh, setToh } = useNavigation();

  useTohToggle({ toh });

  useEffect(() => {
    const next = toh || tohList[0];
    if (next) setToh(next);
  }, [toh, tohList, setToh]);

  return toh;
};
