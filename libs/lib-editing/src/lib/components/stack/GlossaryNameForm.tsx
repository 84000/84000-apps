'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { Button } from '@eightyfourthousand/design-system';
import { toEwtsWithWarnings } from '@eightyfourthousand/lib-tibetan';
import { cn } from '@eightyfourthousand/lib-utils';
import { CheckIcon, XIcon } from 'lucide-react';

import {
  groupTitle,
  hasSameName,
  type NameGroup,
  type PanelName,
} from './glossary-entry-names';

const TIBETAN = 'Bo-Ltn';

/** A name's text as entered: Tibetan as Wylie and script. */
export type EnteredName = {
  content: string;
  contentTransformed: string | null;
};

/**
 * The text of a name being added or edited. A Tibetan name is entered as
 * script, its Wylie shown as it is generated.
 */
export const GlossaryNameForm = ({
  group,
  name,
  disabled,
  onSubmit,
  onCancel,
}: {
  group: NameGroup;
  /** The name being edited, or none to add one. */
  name?: PanelName;
  disabled: boolean;
  onSubmit: (entered: EnteredName, warnings: string[]) => void;
  onCancel: () => void;
}) => {
  const tibetan = group.language === TIBETAN;
  const [text, setText] = useState(
    (tibetan ? name?.contentTransformed : name?.content) ?? '',
  );
  const [refused, setRefused] = useState<string | null>(null);
  const id = useId();
  const trimmed = text.trim();
  const converted =
    tibetan && trimmed
      ? toEwtsWithWarnings(trimmed, { finalShad: 'drop' })
      : null;
  const entered: EnteredName = converted
    ? { content: converted.ewts, contentTransformed: trimmed }
    : { content: trimmed, contentTransformed: null };

  const submit = () => {
    if (!trimmed || (tibetan && !converted?.ewts.trim())) {
      setRefused('Enter the name first.');
      return;
    }
    if (hasSameName(group, entered, name)) {
      setRefused(`This group already has “${trimmed}”.`);
      return;
    }
    onSubmit(entered, converted?.warnings ?? []);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className="flex flex-col gap-1.5" data-glossary-name-form="">
      <div className="flex items-center gap-2">
        {/* Not the design system's Input, whose debounce Enter could outrun. */}
        <input
          id={id}
          value={text}
          autoFocus
          disabled={disabled}
          aria-label={
            tibetan
              ? 'Tibetan name in script'
              : `${name ? 'Edit' : 'New'} ${groupTitle(group)} name`
          }
          placeholder={tibetan ? 'Tibetan script' : 'Name'}
          className={cn(
            'border-input bg-background placeholder:text-muted-foreground flex h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none disabled:opacity-50',
            tibetan && 'font-tibetan text-base',
          )}
          onChange={(event) => {
            setText(event.target.value);
            setRefused(null);
          }}
          onKeyDown={onKeyDown}
        />
        <Button
          size="icon"
          variant="ghost"
          aria-label={name ? 'Save' : 'Add'}
          disabled={disabled}
          onClick={submit}
        >
          <CheckIcon className="text-success" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Cancel"
          onClick={onCancel}
        >
          <XIcon />
        </Button>
      </div>
      {converted && (
        <p className="text-sm" data-glossary-name-wylie="">
          <span className="text-muted-foreground text-xs">Wylie </span>
          <span className="italic">{converted.ewts}</span>
        </p>
      )}
      {converted && <NameWarnings warnings={converted.warnings} />}
      {refused && (
        <p role="alert" className="text-destructive text-xs">
          {refused}
        </p>
      )}
    </div>
  );
};

/** Warnings about entered Tibetan script. */
export const NameWarnings = ({ warnings }: { warnings: string[] }) =>
  warnings.length ? (
    <ul
      className="text-xs text-amber-700 dark:text-amber-400"
      data-glossary-name-warnings=""
    >
      {warnings.map((warning) => (
        <li key={warning}>{warning}</li>
      ))}
    </ul>
  ) : null;
