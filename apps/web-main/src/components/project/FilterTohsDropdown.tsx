import { FilterFn, RowData, Table } from '@tanstack/react-table';
import { FilterPopover } from './FilterPopover';
import { ComponentPropsWithRef, useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { TableProject } from './TableProject';
import { MinMax } from './MinMax';

const TOH_RANGES = [
  '1 - 500',
  '501 - 1000',
  '1001 - 2000',
  '2001 - 3000',
  '3001 - 4569',
];

const TOH_VALUES: MinMax[] = [
  { min: 1, max: 500 },
  { min: 501, max: 1000 },
  { min: 1001, max: 2000 },
  { min: 2001, max: 3000 },
  { min: 3001, max: 4569 },
];

export const filterFn: FilterFn<TableProject> = (
  row,
  columnId,
  filter: MinMax[],
) => {
  if (!filter.length) {
    return true;
  }

  const tohs = row.getValue(columnId) as string;
  const tohNumbers = tohs
    ?.split(', ')
    .map((toh) => Number.parseInt(toh.match(/\d{1,4}/)?.[0] || '0'));
  for (const { min, max } of filter) {
    for (const toh of tohNumbers) {
      if (toh >= min && toh <= max) {
        return true;
      }
    }
  }

  return false;
};

function TohRangeCheckboxItem({
  range,
  checked,
  onCheckedChanged,
}: ComponentPropsWithRef<'div'> & {
  range: string;
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
        <span className={'pr-1'}>{range}</span>
      </span>
    </div>
  );
}

export const FilterTohsDropdown = <T extends RowData>({
  table,
}: {
  table: Table<T>;
}) => {
  const [checked, setChecked] = useState<{ [key: string]: boolean }>(
    TOH_RANGES.reduce((acc, curr) => ({ ...acc, [curr]: false }), {}),
  );

  const onCheckedChanged = useCallback((range: string, isChecked: boolean) => {
    setChecked((prev) => ({
      ...prev,
      [range]: isChecked,
    }));
  }, []);

  useEffect(() => {
    const ranges = Object.keys(checked)
      .filter((range) => range && checked[range])
      .map((key) => TOH_RANGES.indexOf(key))
      .map((index) => TOH_VALUES[index]);

    table.getColumn('toh')?.setFilterValue(ranges);
  }, [table, checked]);

  return (
    <FilterPopover className="px-0 w-[210px]" label="Toh">
      <>
        {TOH_RANGES.map((range) => (
          <TohRangeCheckboxItem
            key={range}
            range={range}
            checked={checked[range]}
            onCheckedChanged={(isChecked) => onCheckedChanged(range, isChecked)}
          />
        ))}
      </>
    </FilterPopover>
  );
};
