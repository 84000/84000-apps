'use client';

import { Imprint, Titles as TitlesData } from '@eightyfourthousand/data-access';
import { useEffect, useState } from 'react';
import { useEditorState } from './EditorProvider';
import { Titles } from '../shared/titles';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';

export const TitlesBuilder = ({
  titles,
  imprint,
}: {
  titles: TitlesData;
  imprint?: Imprint;
}) => {
  const [isEditable, setIsEditable] = useState(false);
  const [loading, setLoading] = useState(true);

  const { canEdit } = useEditorState();

  useEffect(() => {
    const checkEditable = async () => {
      if (!loading) {
        return;
      }

      const editable = await canEdit();

      setIsEditable(editable);
      setLoading(false);
    };
    checkEditable();
  }, [loading, canEdit]);

  return !loading ? (
    <Titles titles={titles} imprint={imprint} canEdit={isEditable} />
  ) : (
    <TranslationSkeleton />
  );
};
