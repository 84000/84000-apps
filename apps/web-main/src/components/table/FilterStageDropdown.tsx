import {
  PROJECT_STAGE_LABELS,
  ProjectStageLabel,
  STAGE_COLORS,
  STAGE_DESCRIPTIONS,
} from '@data-access';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from '@design-system';
import { cn } from '@lib-utils';
import { RowData, Table } from '@tanstack/react-table';
import { Check, ChevronDown, ListFilter } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

function StageCheckboxItem({
  className,
  checked,
  stage,
  onCheckedChanged,
}: React.ComponentPropsWithoutRef<'div'> & {
  checked: boolean;
  stage: ProjectStageLabel;
  onCheckedChanged: (checked: boolean) => void;
}) {
  const color = STAGE_COLORS[stage] || 'grey';
  const desc = STAGE_DESCRIPTIONS[stage] || '';
  const textClass = `text-${color}`;
  return (
    <div
      className={cn(
        'w-full relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      onClick={() => onCheckedChanged(!checked)}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <Check className="size-4" />}
      </span>
      <span className={textClass}>
        <span className={"uppercase after:content-['.'] pr-1"}>{stage}</span>
        {desc}
      </span>
    </div>
  );
}

export const FilterStageDropdown = <T extends RowData>({
  table,
}: {
  table: Table<T>;
}) => {
  const [checked, setChecked] = useState<{ [key: string]: boolean }>(
    PROJECT_STAGE_LABELS.reduce((acc, curr) => ({ ...acc, [curr]: false }), {}),
  );
  const onCheckedChanged = useCallback((stage: string, isChecked: boolean) => {
    setChecked((prev) => ({
      ...prev,
      [stage]: isChecked,
    }));
  }, []);

  useEffect(() => {
    table
      .getColumn('stage')
      ?.setFilterValue(
        Object.keys(checked).filter((stage) => stage && checked[stage]),
      );
  }, [table, checked]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="ml-auto rounded-full">
          <ListFilter />
          Filter Stage
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="px-0 w-[310px]">
        {PROJECT_STAGE_LABELS.map((stage, index) => (
          <div key={stage}>
            <StageCheckboxItem
              stage={stage}
              className="py-2 pr-4"
              checked={!!checked[stage]}
              onCheckedChanged={(checked) => onCheckedChanged(stage, checked)}
            />
            {index < PROJECT_STAGE_LABELS.length - 2 &&
              stage.charAt(0) !== PROJECT_STAGE_LABELS[index + 1].charAt(0) && (
                <Separator className="my-1" />
              )}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
};
