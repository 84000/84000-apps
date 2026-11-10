'use client';

import { Button } from '@eightyfourthousand/design-system';
import { useGlossaryPassages } from './GlossaryPassagesDialog';

/**
 * "Passages ›" under a glossary entry: opens the dialog listing every passage
 * that cites the entry. Draws nothing outside a `GlossaryPassagesProvider`.
 */
export const GlossaryPassagesLink = ({
  uuid,
  english,
}: {
  /** The glossary entry's uuid. */
  uuid?: string;
  /** The entry's English name, for the dialog title. */
  english?: string | null;
}) => {
  const passages = useGlossaryPassages();

  if (!passages || !uuid) return null;

  return (
    <Button
      variant="link"
      className="h-auto p-0 self-start text-sm font-normal hover:cursor-pointer"
      onClick={() => passages.openGlossaryPassages({ uuid, english })}
    >
      Passages ›
    </Button>
  );
};
