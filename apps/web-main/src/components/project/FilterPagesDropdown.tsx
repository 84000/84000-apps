import { FilterFn, RowData, Table } from '@tanstack/react-table';
import { FilterPopover } from './FilterPopover';
import { ComponentPropsWithRef, useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { TableProject } from './TableProject';

export type MinMax = {
  min: number;
  max: number;
};

const PAGE_RANGES = [
  '1 to 2 pages',
  '3 to 5 pages',
  '6 to 10 pages',
  '11 to 50 pages',
  'Greater then 50 pages',
];

const PAGE_VALUES: MinMax[] = [
  { min: 1, max: 2 },
  { min: 3, max: 5 },
  { min: 6, max: 10 },
  { min: 11, max: 50 },
  { min: 51, max: Infinity },
];

export const filterFn: FilterFn<TableProject> = (
  row,
  columnId,
  filter: MinMax[],
) => {
  if (!filter.length) {
    return true;
  }

  const pages = row.getValue(columnId) as number;
  for (const { min, max } of filter) {
    if (pages >= min && pages <= max) {
      return true;
    }
  }

  return false;
};

function PageRangeCheckboxItem({
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

export const FilterPagesDropdown = <T extends RowData>({
  table,
}: {
  table: Table<T>;
}) => {
  const [checked, setChecked] = useState<{ [key: string]: boolean }>(
    PAGE_RANGES.reduce((acc, curr) => ({ ...acc, [curr]: false }), {}),
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
      .map((key) => PAGE_RANGES.indexOf(key))
      .map((index) => PAGE_VALUES[index]);

    table.getColumn('pages')?.setFilterValue(ranges);
  }, [table, checked]);

  return (
    <FilterPopover className="px-0 w-[210px]" label="Pages">
      <>
        {PAGE_RANGES.map((range) => (
          <PageRangeCheckboxItem
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
