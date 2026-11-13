'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@eightyfourthousand/design-system';

type Choice = { value: string; label: string; explanation: string };

/** What a stored null renders as: the entry's own definition. */
export const CUSTOM_REND = 'incompatibleWithStandard';
/** Readers see only the authority's standard definition. */
export const STANDARD_REND = 'overrideWithStandard';

/** The definition relations, in the order the panel offers them. */
export const DEFINITION_REND_CHOICES: Choice[] = [
  {
    value: CUSTOM_REND,
    label: 'Custom definition',
    explanation: 'Readers see only this entry’s definition.',
  },
  {
    value: STANDARD_REND,
    label: 'Use standard',
    explanation: 'Readers see the authority’s standard definition.',
  },
  {
    value: 'appendWithStandard',
    label: 'Append standard',
    explanation: 'Readers see this entry’s definition, then the standard one.',
  },
  {
    value: 'prependWithStandard',
    label: 'Prepend standard',
    explanation: 'Readers see the standard definition, then this entry’s.',
  },
];

/** The entry's definition relation: a select to edit, its label when read-only. */
export const GlossaryDefinitionRend = ({
  value,
  readOnly,
  disabled,
  onChange,
}: {
  value: string;
  readOnly: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) => {
  const chosen = DEFINITION_REND_CHOICES.find(
    (choice) => choice.value === value,
  );
  return (
    <div className="flex flex-col gap-1.5" data-glossary-entry-rend="">
      {readOnly ? (
        <span className="text-sm font-medium">{chosen?.label ?? value}</span>
      ) : (
        <Select value={value} disabled={disabled} onValueChange={onChange}>
          <SelectTrigger aria-label="Definition relation">
            <SelectValue placeholder={value} />
          </SelectTrigger>
          <SelectContent>
            {DEFINITION_REND_CHOICES.map((choice) => (
              <SelectItem key={choice.value} value={choice.value}>
                {choice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <span className="text-muted-foreground text-xs">
        {chosen
          ? chosen.explanation
          : `Stored as “${value}”, which the panel does not offer.`}
      </span>
    </div>
  );
};
