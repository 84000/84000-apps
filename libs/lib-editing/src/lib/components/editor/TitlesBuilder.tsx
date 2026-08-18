'use client';

import { Imprint, Titles as TitlesData } from '@eightyfourthousand/data-access';
import { useEffect, useState } from 'react';
import { useEditorState } from './EditorProvider';
import { Titles } from '../shared/titles';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';

export const TitlesBuilder = ({
  titles,
  imprint,
  workUuid,
  onTitlesSaved,
}: {
  titles: TitlesData;
  imprint?: Imprint;
  workUuid?: string;
  onTitlesSaved?: (titles: TitlesData) => void;
}) => {
  const [isEditable, setIsEditable] = useState(false);
  const [loading, setLoading] = useState(true);

  // Titles are global to the work and go live immediately, with no publishing
  // step in between, so editing them takes `editor.admin` — a higher bar than
  // the `editor.edit` that governs passage content. RLS on `public.titles`
  // enforces the same rule; this only decides whether the pencil is offered.
  const { canAdminister } = useEditorState();

  useEffect(() => {
    const checkEditable = async () => {
      if (!loading) {
        return;
      }

      const editable = await canAdminister();

      setIsEditable(editable);
      setLoading(false);
    };
    checkEditable();
  }, [loading, canAdminister]);

  return !loading ? (
    <Titles
      titles={titles}
      imprint={imprint}
      canEdit={isEditable}
      workUuid={workUuid}
      onTitlesSaved={onTitlesSaved}
    />
  ) : (
    <TranslationSkeleton />
  );
};
