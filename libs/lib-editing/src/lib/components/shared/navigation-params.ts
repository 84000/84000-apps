import type { TohokuCatalogEntry } from '@eightyfourthousand/data-access';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import {
  HighlightRange,
  PANEL_NAMES,
  PanelName,
  PanelsState,
  TabName,
} from './types';
import { DEFAULT_PANELS } from './NavigationContext';

/** Reads the panel states and toh from the query parameters. */
export const parsePanelParams = (
  params: ReadonlyURLSearchParams,
): {
  toh?: TohokuCatalogEntry;
  panels: PanelsState;
} => {
  const panels: PanelsState = { ...DEFAULT_PANELS };

  for (const [key, value] of params.entries()) {
    const match = value.match(/^(open|closed)(?::(.+))?$/);
    if (match) {
      const [state, tab, hash] = value.split(':');
      const panelKey = key as PanelName;
      if (!PANEL_NAMES.includes(panelKey)) {
        continue;
      }
      panels[panelKey] = {
        open: state === 'open',
        tab: tab as TabName | undefined,
        hash: hash || undefined,
      };
    }
  }

  const toh = (params.get('toh') as TohokuCatalogEntry) || undefined;

  return { toh, panels };
};

/**
 * Parses the `start`/`end` query parameters into a highlight range. Both must
 * be present and numeric with `end > start`; otherwise no highlight is applied.
 */
export const parseHighlight = (
  params: ReadonlyURLSearchParams,
): HighlightRange | undefined => {
  const start = Number(params.get('start'));
  const end = Number(params.get('end'));
  if (
    !params.has('start') ||
    !params.has('end') ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start
  ) {
    return undefined;
  }
  return { start, end };
};
