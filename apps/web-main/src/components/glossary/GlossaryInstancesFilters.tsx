'use client';

import { GlossaryPageItem } from '@data-access';
import { FuzzyGlobalFilter } from '@design-system';
import { Table } from '@tanstack/react-table';
import { GlossaryInstanceRow } from './GlossaryInstancesTable';
import { useEffect, useState } from 'react';
import { FilterCanonPathDropdown } from './FilterCanonPathDropdown';

const MAX_CANON_DEPTH = 3;

export const GlossaryInstancesFilters = ({
  detail,
  table,
}: {
  detail: GlossaryPageItem;
  table: Table<GlossaryInstanceRow>;
}) => {
  const [canons, setCanons] = useState<string[]>([]);

  useEffect(() => {
    const instances = detail.relatedInstances;
    const trimmedCanons = instances
      .map((instance) => {
        const split = instance.canon?.split('>') || [];
        return split
          .slice(0, Math.min(MAX_CANON_DEPTH, split.length))
          .join('>')
          .trim();
      })
      .filter((canon) => canon && canon.length > 0);

    const uniqueCanons = Array.from(new Set(trimmedCanons)).sort();
    setCanons(uniqueCanons);
  }, [detail.relatedInstances]);

  return (
    <div className="flex lg:items-center lg:flex-row flex-col py-4 gap-4">
      <div className="grow flex">
        <FuzzyGlobalFilter table={table} placeholder="Search instances..." />
        <div className="grow" />
      </div>
      <div className="flex md:gap-4 gap-1 overflow-auto">
        {canons.length > 1 && (
          <FilterCanonPathDropdown table={table} options={canons} />
        )}
      </div>
    </div>
  );
};
