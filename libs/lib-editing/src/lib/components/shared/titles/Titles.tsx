'use client';

import { useState } from 'react';
import {
  BO_TITLE_PREFIX,
  Imprint,
  Titles as TitlesData,
  TitleType,
} from '@eightyfourthousand/data-access';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@eightyfourthousand/design-system';
import { TitlesCard } from './TitlesCard';
import { TitleForm } from './TitleForm';

export type TitlesVariant = 'english' | 'tibetan' | 'comparison' | 'front' | 'other';

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

  const mainTitles = titlesByType['mainTitle'] || [];

  let header = '';
  let main = '';
  const authors = imprint?.tibetanAuthors || [];

  const footer =
    imprint?.mainTitles?.['Sa-Ltn'] ||
    mainTitles.find((t) => t.language === 'Sa-Ltn')?.title;

  switch (variant) {
    case 'tibetan': {
      const boMain =
        imprint?.mainTitles?.bo ||
        mainTitles.find((t) => t.language === 'bo')?.title;
      header = boMain ? `${BO_TITLE_PREFIX}${boMain || ''}` : '';
      break;
    }
    case 'comparison': {
      const boMain =
        imprint?.mainTitles?.bo ||
        mainTitles.find((t) => t.language === 'bo')?.title;
      const enMain =
        imprint?.mainTitles?.en ||
        mainTitles.find((t) => t.language === 'en')?.title ||
        '';
      header = boMain ? `${BO_TITLE_PREFIX}${boMain || ''}` : '';
      main = enMain;
      break;
    }
    case 'front': {
      const boMain =
        imprint?.mainTitles?.bo ||
        mainTitles.find((t) => t.language === 'bo')?.title;
      header = boMain ? `${BO_TITLE_PREFIX}${boMain || ''}` : '';
      main =
        imprint?.mainTitles?.en ||
        mainTitles.find((t) => t.language === 'en')?.title ||
        mainTitles[0]?.title ||
        '';
      break;
    }
    case 'english':
    default:
      main =
        imprint?.mainTitles?.en ||
        mainTitles.find((t) => t.language === 'en')?.title ||
        mainTitles[0]?.title ||
        '';
      break;
  }

  return (
    <>
      <TitlesCard
        header={header}
        main={main}
        footer={footer}
        toh={imprint?.toh}
        section={imprint?.section}
        authors={authors}
        attribution={imprint?.isAuthorContested ? 'attributed to' : 'by'}
        authorsJoiner={imprint?.isAuthorContested ? ' or' : ','}
        canEdit={canEdit}
        onEdit={() => setIsEditOpen(true)}
      />
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
