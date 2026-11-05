'use client';

import {
  canonicalToh,
  TohokuCatalogEntry,
} from '@eightyfourthousand/data-access';
import { useEffect } from 'react';

/**
 * Selects the Toh-scoped markup that does not belong to `toh`: everything
 * scoped when no Toh is active, or when `toh` is not a catalogued Toh.
 */
export const tohHiddenSelector = (toh?: TohokuCatalogEntry) => {
  // `data-toh` may hold a comma-separated list (e.g. "toh417,toh418") when
  // content belongs to several tohs, so the active toh is treated as list
  // membership: keep the element visible if its list equals the active toh or
  // contains it as a comma-delimited token (first, middle, or last). The comma
  // boundaries avoid prefix collisions such as "toh41" matching "toh417".
  // The Toh can come from the URL, and the rule is drawn into a <style> on the
  // server, so only a catalogued Toh — letters, digits and a hyphen — is let
  // into it; anything else could close the selector or the element.
  const active = canonicalToh(toh);
  return active
    ? `[data-toh]` +
        `:not([data-toh="${active}"])` +
        `:not([data-toh^="${active},"])` +
        `:not([data-toh*=",${active},"])` +
        `:not([data-toh$=",${active}"])`
    : '[data-toh]';
};

/**
 * The same rule as `useTohToggle`, drawn with the page, so markup the server
 * renders for another Toh is hidden before the browser runs any script. Draws
 * nothing until a catalogued Toh is active.
 */
export const TohVisibilityStyle = ({ toh }: { toh?: TohokuCatalogEntry }) =>
  canonicalToh(toh) ? (
    <style>{`${tohHiddenSelector(toh)} { display: none; }`}</style>
  ) : null;

export const useTohToggle = ({ toh }: { toh?: TohokuCatalogEntry }) => {
  useEffect(() => {
    let styleEl = document.getElementById(
      'dynamic-visibility-rules',
    ) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-visibility-rules';
      document.head.appendChild(styleEl);
    }

    const sheet = styleEl.sheet;

    if (!sheet) {
      console.warn(
        'Could not find or create stylesheet for dynamic class toggling.',
      );
      return;
    }

    // Clear existing rules
    while (sheet.cssRules.length > 0) {
      sheet.deleteRule(0);
    }

    const selector = tohHiddenSelector(toh);
    try {
      sheet.insertRule(`${selector} { display: none; }`, 0);
    } catch (e) {
      console.error('Failed to insert toh visibility rule:', e);
    }
  }, [toh]);
};
