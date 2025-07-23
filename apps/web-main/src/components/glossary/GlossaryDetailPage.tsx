'use client';

import { GlossaryPageItem } from '@data-access';
import { GlossaryEntryEditor } from './GlossaryEditor';
import { GlossaryVariants } from './GlossaryVariants';
import { GlossaryRelatedTerms } from './GlossaryRelatedTerms';
import { GlossaryHeading } from './GlossaryHeading';

export const GlossaryDetailPage = ({
  detail,
}: {
  detail: GlossaryPageItem;
}) => {
  return (
    <div className="w-full">
      <GlossaryHeading detail={detail} />
      <GlossaryEntryEditor detail={detail} />
      <GlossaryVariants detail={detail} />
      <GlossaryRelatedTerms detail={detail} />
    </div>
  );
};
