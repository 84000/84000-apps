'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Wylie for a Tibetan name entered as script, with anything a reader should
 * check against the script. Shaped like lib-tibetan's `toEwtsWithWarnings`
 * with `finalShad: 'drop'`.
 */
export type TibetanToWylie = (script: string) => {
  ewts: string;
  warnings: string[];
};

const TibetanToWylieContext = createContext<TibetanToWylie | null>(null);

/**
 * Supplies the conversion the entry panel enters Tibetan names with. Without
 * it the panel lists Tibetan names but does not add or edit them.
 */
export const GlossaryTibetanProvider = ({
  toWylie,
  children,
}: {
  toWylie: TibetanToWylie;
  children: ReactNode;
}) => (
  <TibetanToWylieContext.Provider value={toWylie}>
    {children}
  </TibetanToWylieContext.Provider>
);

/** The conversion Tibetan names are entered with, if the host supplies one. */
export const useTibetanToWylie = () => useContext(TibetanToWylieContext);
