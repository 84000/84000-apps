'use client';

import { Button } from '@eightyfourthousand/design-system';
import { useCallback } from 'react';
import { useNavigation } from '../NavigationContext';
import { useGlossaryPassages } from './GlossaryPassagesDialog';

/**
 * "Passages ›" in a glossary instance's hover card: opens the dialog listing
 * every passage that cites the entry, and closes the card.
 */
export const GlossaryPassagesLink = ({
  glossary,
  close,
}: {
  /** The glossary uuid the instance cites. */
  glossary: string;
  close: () => void;
}) => {
  const passages = useGlossaryPassages();
  const { fetchGlossaryTerm } = useNavigation();

  // The card has already read the entry, so this is normally a cache hit.
  const open = useCallback(async () => {
    const term = await fetchGlossaryTerm(glossary);
    close();
    if (!term) {
      console.error(`Glossary entry not found for ${glossary}`);
      return;
    }
    passages?.openGlossaryPassages({
      uuid: term.uuid,
      english: term.names.english,
    });
  }, [glossary, fetchGlossaryTerm, close, passages]);

  if (!passages || !glossary) return null;

  return (
    <Button
      variant="link"
      className="h-6 px-1 my-auto shrink-0 text-xs font-normal hover:cursor-pointer"
      onClick={open}
    >
      Passages ›
    </Button>
  );
};
