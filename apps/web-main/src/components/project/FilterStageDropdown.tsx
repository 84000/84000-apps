import {
  PROJECT_STAGE_LABELS,
  STAGE_COLORS,
  STAGE_DESCRIPTIONS,
  ProjectStageLabel,
} from '@data-access';
import { FilterDropdown, Separator } from '@design-system';
import { cn } from '@lib-utils';
import { RowData, Table } from '@tanstack/react-table';
import { Check } from 'lucide-react';

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
  return (
    <FilterDropdown
      table={table}
      placeholder="Stage"
      column="stage"
      options={PROJECT_STAGE_LABELS}
      className="w-[310px]"
      renderCheckbox={(stage, checked, onCheckChanged, index) => (
        <>
          <StageCheckboxItem
            stage={stage}
            className="py-2 pr-4"
            checked={checked}
            onCheckedChanged={(isChecked) => {
              onCheckChanged(stage, isChecked);
            }}
          />
          {index < PROJECT_STAGE_LABELS.length - 2 &&
            stage.charAt(0) !== PROJECT_STAGE_LABELS[index + 1].charAt(0) && (
              <Separator className="my-1" />
            )}
        </>
      )}
    />
  );
};
