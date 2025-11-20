'use client';

import {
  BO_TITLE_PREFIX,
  Imprint,
  Titles as TitlesData,
  TitleType,
} from '@data-access';
import { TitlesCard } from './TitlesCard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../Dialog/Dialog';
import { useState } from 'react';
import { TitleForm } from './TitleForm';
import { LongTitles } from './LongTitles';

export type TitlesVariant = 'english' | 'tibetan' | 'comparison' | 'other';

export const Titles = ({
  titles,
  variant = 'english',
  imprint,
  canEdit = false,
}: {
  titles: TitlesData;
  imprint?: Imprint;
  variant?: TitlesVariant;
  canEdit?: boolean;
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const titlesByType = titles.reduce(
    (acc, title) => {
      if (!acc[title.type]) {
        acc[title.type] = [];
      }
      acc[title.type].push(title);
      return acc;
    },
    {} as Record<TitleType, TitlesData>,
  );

  let header = '';
  let main = '';
  let footer = '';

  // TODO: support other variants once we have a good understanding of them
  // and the required data is available
  switch (variant) {
    case 'tibetan':
      {
        const mainTitles = titlesByType['mainTitle'] || [];
        const boMain =
          imprint?.mainTitles?.bo ||
          mainTitles.find((t) => t.language === 'bo')?.title;
        const saMain =
          imprint?.mainTitles?.['Sa-Ltn'] ||
          mainTitles.find((t) => t.language === 'Sa-Ltn')?.title ||
          '...';
        header = saMain;
        main = `${BO_TITLE_PREFIX}${boMain || '...'}`;
        footer = imprint?.toh
          ? imprint.toh
          : titlesByType['toh']?.[0]?.title || '';
      }
      break;
    case 'comparison':
      {
        const mainTitles = titlesByType['mainTitle'] || [];
        const boMain =
          imprint?.mainTitles?.bo ||
          mainTitles.find((t) => t.language === 'bo')?.title;
        const enMain =
          imprint?.mainTitles?.en ||
          mainTitles.find((t) => t.language === 'en')?.title ||
          '...';
        header = enMain;
        main = `${BO_TITLE_PREFIX}${boMain || '...'}`;
        footer = imprint?.toh
          ? imprint.toh
          : titlesByType['toh']?.[0]?.title || '';
      }
      break;
    case 'english':
    default:
      {
        const mainTitles = titlesByType['mainTitle'] || [];
        const boMain =
          imprint?.section ||
          mainTitles.find((t) => t.language === 'bo')?.title;
        header = imprint?.section || `${BO_TITLE_PREFIX}${boMain || '...'}`;
        main =
          imprint?.mainTitles?.en ||
          mainTitles.find((t) => t.language === 'en')?.title ||
          mainTitles[0]?.title ||
          '';
        footer = imprint?.toh
          ? imprint.toh
          : titlesByType['toh']?.[0]?.title || '';
      }
      break;
  }

  return (
    <>
      <TitlesCard
        header={header}
        main={main}
        footer={footer}
        canEdit={canEdit}
        hasMore={false}
        onMore={() => setIsMoreOpen(true)}
        onEdit={() => setIsEditOpen(true)}
      />
      <Dialog open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <DialogContent className="max-w-4xl" showCloseButton={false}>
          <DialogTitle className="hidden">All Titles</DialogTitle>
          <DialogDescription className="hidden">All Titles</DialogDescription>
          <LongTitles imprint={imprint} />
        </DialogContent>
      </Dialog>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-4xl" showCloseButton={false}>
          <DialogTitle className="hidden">Edit Titles</DialogTitle>
          <DialogDescription className="hidden">Edit Titles</DialogDescription>
          <TitleForm
            titles={titles}
            onChange={(title) => {
              console.log('TODO: save title', title);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
