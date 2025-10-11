'use client';

import {
  BO_TITLE_PREFIX,
  Titles as TitlesData,
  TitleType,
  TohokuCatalogEntry,
} from '@data-access';
import { TitlesCard } from './TitlesCard';
import { parseToh } from '@lib-utils';
import { Dialog, DialogContent } from '../../Dialog/Dialog';
import { useState } from 'react';
import { TitleForm } from './TitleForm';
import { LongTitles } from './LongTitles';

type TitlesVariant = 'english' | 'tibetan' | 'comparison' | 'other';

export const Titles = ({
  titles,
  variant = 'english',
  toh,
  canEdit = false,
}: {
  titles: TitlesData;
  variant?: TitlesVariant;
  toh?: TohokuCatalogEntry;
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
    default:
      {
        const mainTitles = titlesByType['mainTitle'] || [];
        header = mainTitles.find((t) => t.language === 'bo')?.title || '';
        if (header) {
          header = `${BO_TITLE_PREFIX}${header}`;
        }
        main =
          mainTitles.find((t) => t.language === 'en')?.title ||
          mainTitles[0]?.title ||
          '';
        footer = toh ? parseToh(toh) : titlesByType['toh']?.[0]?.title || '';
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
        onMore={() => setIsMoreOpen(true)}
        onEdit={() => setIsEditOpen(true)}
      />
      <Dialog open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <DialogContent className="max-w-4xl" showCloseButton={false}>
          <LongTitles titles={titles} />
        </DialogContent>
      </Dialog>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent showCloseButton={false}>
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
