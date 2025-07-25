'use client';

import { GlossaryPageItem } from '@data-access';
import { GlossaryEntryEditor } from './GlossaryEditor';
import { GlossaryHeading } from './GlossaryHeading';
import { GlossaryInstancesTable } from './GlossaryInstancesTable';
import { GlossaryRelatedTerms } from './GlossaryRelatedTerms';
import { GlossaryVariants } from './GlossaryVariants';

export const GlossaryDetailPage = ({
  detail,
}: {
  detail: GlossaryPageItem;
}) => {
  return (
    <div className="w-full pb-8">
      <GlossaryHeading detail={detail} />
      <GlossaryEntryEditor detail={detail} />
      <GlossaryVariants detail={detail} />
      <GlossaryInstancesTable detail={detail} />
      <GlossaryRelatedTerms detail={detail} />
    </div>
  );
};
