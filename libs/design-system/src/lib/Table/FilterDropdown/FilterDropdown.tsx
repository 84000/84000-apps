'use client';

import { Row, Table } from '@tanstack/react-table';
import {
  ComponentPropsWithRef,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Check } from 'lucide-react';
import { FilterPopover } from '../FilterPopover/FilterPopover';
import { cn } from '@lib-utils';
import { DataTableRow } from '../hooks';

export const defaultFilterFn = <T extends DataTableRow>(
  row: Row<T>,
  columnId: string,
  filter: string[],
) => {
  if (!filter.length) {
    return true;
  }

  const value = row.getValue(columnId) as string;
  return filter.some((v) => value.includes(v));
};

export const FilterCheckboxItem = ({
  label,
  checked,
  onCheckedChanged,
}: ComponentPropsWithRef<'div'> & {
  label: string;
  checked: boolean;
  onCheckedChanged: (checked: boolean) => void;
}) => {
  return (
    <div
      className="w-full relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
      onClick={() => onCheckedChanged(!checked)}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <Check className="size-4" />}
      </span>
      <span>
        <span className="capitalize pr-1">{label}</span>
      </span>
    </div>
  );
};

export const FilterDropdown = <T extends DataTableRow>({
  placeholder,
  column,
  options,
  table,
  className,
  getCheckedValues,
  renderCheckbox,
}: {
  placeholder: string;
  column: string;
  options: string[];
  table: Table<T>;
  className?: string;
  getCheckedValues?: (options: string[]) => unknown[];
  renderCheckbox?: (
    label: string,
    checked: boolean,
    onCheckChanged: (option: string, checked: boolean) => void,
    index: number,
  ) => ReactNode;
}) => {
  const [checked, setChecked] = useState<{ [key: string]: boolean }>(
    options.reduce((acc, curr) => ({ ...acc, [curr]: false }), {}),
  );

  const onCheckedChanged = useCallback((item: string, isChecked: boolean) => {
    setChecked((prev) => ({
      ...prev,
      [item]: isChecked,
    }));
  }, []);

  useEffect(() => {
    const checkedKeys = Object.keys(checked).filter(
      (item) => item && checked[item],
    );
    const checkedValues = getCheckedValues?.(checkedKeys) || checkedKeys;
    table.getColumn(column)?.setFilterValue(checkedValues);
  }, [table, checked, column, getCheckedValues]);

  return (
    <FilterPopover className={cn('px-0', className)} label={placeholder}>
      <>
        {options.map((option) => (
          <div key={option}>
            {renderCheckbox ? (
              renderCheckbox(
                option,
                checked[option],
                onCheckedChanged,
                options.indexOf(option),
              )
            ) : (
              <FilterCheckboxItem
                label={option}
                checked={checked[option]}
                onCheckedChanged={(isChecked) =>
                  onCheckedChanged(option, isChecked)
                }
              />
            )}
          </div>
        ))}
      </>
    </FilterPopover>
  );
};
