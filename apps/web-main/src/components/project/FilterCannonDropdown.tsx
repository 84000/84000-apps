import { RowData, Table } from '@tanstack/react-table';
import { FilterPopover } from './FilterPopover';
import { ComponentPropsWithRef, useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { CANNON_TYPES } from '@data-access';

function CannonCheckboxItem({
  cannon,
  checked,
  onCheckedChanged,
}: ComponentPropsWithRef<'div'> & {
  cannon: string;
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
        <span className={'capitalize pr-1'}>{cannon}</span>
      </span>
    </div>
  );
}

export const FilterCannonDropdown = <T extends RowData>({
  table,
}: {
  table: Table<T>;
}) => {
  const [checked, setChecked] = useState<{ [key: string]: boolean }>(
    CANNON_TYPES.reduce((acc, curr) => ({ ...acc, [curr]: false }), {}),
  );

  const onCheckedChanged = useCallback((cannon: string, isChecked: boolean) => {
    setChecked((prev) => ({
      ...prev,
      [cannon]: isChecked,
    }));
  }, []);

  useEffect(() => {
    table
      .getColumn('cannons')
      ?.setFilterValue(
        Object.keys(checked).filter((cannon) => cannon && checked[cannon]),
      );
  }, [table, checked]);

  return (
    <FilterPopover className="px-0 w-[112px]" label="Cannon">
      <>
        {CANNON_TYPES.map((cannon) => (
          <CannonCheckboxItem
            key={cannon}
            cannon={cannon}
            checked={checked[cannon]}
            onCheckedChanged={(isChecked) =>
              onCheckedChanged(cannon, isChecked)
            }
          />
        ))}
      </>
    </FilterPopover>
  );
};
