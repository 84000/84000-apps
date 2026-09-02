'use client';

import { useEffect } from 'react';
import type { TohokuCatalogEntry } from '@eightyfourthousand/data-access';

import { useNavigation } from '../shared/NavigationContext';
import { useTohToggle } from '../shared/hooks/useTohToggle';

/**
 * The two things a host owes the stack around Tohoku scope.
 *
 * **Install the visibility rule.** Annotations carry a `toh` scope, and a work
 * may span several Tohoku texts — toh145's spans four. Without the rule every
 * scope shows at once: two endnote markers numbered 10, one for toh145 and one
 * for toh847, both visible.
 *
 * **Settle on a default**, so one toh is always active. The active toh comes
 * from `NavigationProvider`, which already reads `?toh=` and falls back to the
 * `initialToh` it was given; this only fills the gap when neither names one.
 *
 * `web-main` gets both from `LeftPanel`. A host without that panel calls this.
 * The stack does not do it unprompted: with no `NavigationProvider` above it
 * the active toh would be `undefined`, and the rule for that hides *all*
 * scoped markup — worse than doing nothing.
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
