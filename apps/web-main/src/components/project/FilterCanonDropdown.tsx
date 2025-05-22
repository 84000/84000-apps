import { RowData, Table } from '@tanstack/react-table';
import { FilterPopover } from './FilterPopover';
import { ComponentPropsWithRef, useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { CANON_TYPES } from '@data-access';

function CanonCheckboxItem({
  canon,
  checked,
  onCheckedChanged,
}: ComponentPropsWithRef<'div'> & {
  canon: string;
  checked: boolean;
  onCheckedChanged: (checked: boolean) => void;
}) {
  return (
    <div
      className="w-full relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
      onClick={() => onCheckedChanged(!checked)}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <Check className="size-4" />}
      </span>
      <span>
        <span className={'capitalize pr-1'}>{canon}</span>
      </span>
    </div>
  );
}

export const FilterCanonDropdown = <T extends RowData>({
  table,
}: {
  table: Table<T>;
}) => {
  const [checked, setChecked] = useState<{ [key: string]: boolean }>(
    CANON_TYPES.reduce((acc, curr) => ({ ...acc, [curr]: false }), {}),
  );

  const onCheckedChanged = useCallback((canon: string, isChecked: boolean) => {
    setChecked((prev) => ({
      ...prev,
      [canon]: isChecked,
    }));
  }, []);

  useEffect(() => {
    table
      .getColumn('canons')
      ?.setFilterValue(
        Object.keys(checked).filter((canon) => canon && checked[canon]),
      );
  }, [table, checked]);

  return (
    <FilterPopover className="px-0 w-[112px]" label="Canon">
      <>
        {CANON_TYPES.map((canon) => (
          <CanonCheckboxItem
            key={canon}
            canon={canon}
            checked={checked[canon]}
            onCheckedChanged={(isChecked) => onCheckedChanged(canon, isChecked)}
          />
        ))}
      </>
    </FilterPopover>
  );
};
