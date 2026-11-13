'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  createBrowserClient,
  formatAttestation,
  getGlossaryEntrySharedNames,
  GLOSSARY_ATTESTATIONS,
  type GlossaryEntry,
} from '@eightyfourthousand/data-access';
import { Button } from '@eightyfourthousand/design-system';
import { toEwtsWithWarnings } from '@eightyfourthousand/lib-tibetan';
import { cn } from '@eightyfourthousand/lib-utils';
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';

import {
  nameLanguageLabel,
  tibetanScript,
} from '../shared/glossary/glossary-languages';
import {
  GlossaryEntrySaveStatus,
  type GlossaryEntrySaves,
} from './GlossaryEntrySaves';
import {
  enteredText,
  groupEntryNames,
  hasSameName,
  isRootName,
  newName,
  replacingName,
  takesAttestation,
  withName,
  withoutName,
  type NameGroup,
  type PanelName,
} from './glossary-entry-names';

const TIBETAN = 'Bo-Ltn';

type Shared =
  | { status: 'reading' }
  | { status: 'error' }
  | { status: 'read'; uuids: Set<string> };

/** Which of the entry's names rows are shared, read again when its names change. */
const useSharedNames = (entry: GlossaryEntry): Shared => {
  const key = entry.names.map((n) => n.nameUuid).join(',');
  // Read by the effect below, so a save of another field doesn't read again.
  const current = useRef(entry);
  useEffect(() => {
    current.current = entry;
  });
  const [read, setRead] = useState<{
    key: string;
    uuids: Set<string> | null;
  } | null>(null);

  useEffect(() => {
    let live = true;
    getGlossaryEntrySharedNames({
      client: createBrowserClient(),
      entry: current.current,
    }).then((uuids) => {
      if (live) setRead({ key, uuids });
    });
    return () => {
      live = false;
    };
  }, [key]);

  if (read?.key !== key) return { status: 'reading' };
  return read.uuids
    ? { status: 'read', uuids: read.uuids }
    : { status: 'error' };
};

const isShared = (shared: Shared, name: PanelName) =>
  'nameUuid' in name &&
  !!name.nameUuid &&
  shared.status === 'read' &&
  shared.uuids.has(name.nameUuid);

/** Whether a name's text may be edited here: not while that is unknown. */
const textEditable = (shared: Shared, name: PanelName) =>
  !('nameUuid' in name && name.nameUuid) ||
  (shared.status === 'read' && !shared.uuids.has(name.nameUuid));

const GROUP_TITLES: Record<
  NameGroup['kind'],
  (language: string | null) => string
> = {
  main: () => 'Main English name',
  alternatives: () => 'English alternatives',
  language: (language) => nameLanguageLabel(language),
  other: (language) => language ?? 'No language',
};

const keyOf = (name: PanelName, index: number) =>
  name.glossaryUuid ?? `new-${index}`;

/** A name's text as the panel draws it: Tibetan as script and Wylie. */
const NameText = ({ name }: { name: PanelName }) => (
  <span className="flex flex-wrap items-baseline gap-x-2">
    {tibetanScript(name) && (
      <span className="font-tibetan text-base">{tibetanScript(name)}</span>
    )}
    <span className={name.language === 'en' ? '' : 'italic'}>
      {name.content}
    </span>
  </span>
);

type Entered = { content: string; contentTransformed: string | null };

/**
 * The text of a name being added or edited. A Tibetan name is entered as
 * script, its Wylie shown as it is generated.
 */
const NameForm = ({
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
  onSubmit: (entered: Entered, warnings: string[]) => void;
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
  const entered: Entered = converted
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
      <div className="flex items-center gap-1">
        {/* Not the design system's Input, whose debounce Enter could outrun. */}
        <input
          id={id}
          value={text}
          autoFocus
          disabled={disabled}
          aria-label={
            tibetan
              ? 'Tibetan name in script'
              : `${name ? 'Edit' : 'New'} ${GROUP_TITLES[group.kind](group.language)} name`
          }
          placeholder={tibetan ? 'Tibetan script' : 'Name'}
          className={cn(
            'border-input bg-background placeholder:text-muted-foreground flex h-8 w-full rounded-md border px-2 text-sm focus-visible:outline-none disabled:opacity-50',
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

const NameWarnings = ({ warnings }: { warnings: string[] }) =>
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

const ATTESTATION_NONE = '';

const AttestationPicker = ({
  name,
  disabled,
  onChange,
}: {
  name: PanelName;
  disabled: boolean;
  onChange: (attestation: string | null) => void;
}) => {
  const value = name.attestation ?? ATTESTATION_NONE;
  const offered: string[] = [...GLOSSARY_ATTESTATIONS];
  if (value && !offered.includes(value)) offered.push(value);
  return (
    <select
      aria-label={`Attestation of ${name.content}`}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
      className="border-input bg-background h-8 self-start rounded-md border px-2 text-xs"
    >
      <option value={ATTESTATION_NONE}>No attestation</option>
      {offered.map((attestation) => (
        <option key={attestation} value={attestation}>
          {formatAttestation(attestation)}
        </option>
      ))}
    </select>
  );
};

/**
 * An entry's names in their groups, each added, removed, edited or given an
 * attestation as its group allows. Every change saves the whole list.
 */
export const GlossaryEntryNames = ({
  entry,
  saves,
  readOnly,
}: {
  entry: GlossaryEntry;
  saves: GlossaryEntrySaves;
  readOnly: boolean;
}) => {
  const shared = useSharedNames(entry);
  // The form open, by group and the name it edits (none to add).
  const [editing, setEditing] = useState<{
    group: string;
    name?: PanelName;
  } | null>(null);
  // Warnings for script entered here, by the script.
  const [warned, setWarned] = useState<Map<string, string[]>>(new Map());

  const pending = saves.pending?.field === 'names' ? saves.pending : null;
  const names: PanelName[] = pending?.after.names ?? entry.names;
  const groups = groupEntryNames(names);
  const disabled = !saves.canSave;

  const save = (next: PanelName[]) => {
    setEditing(null);
    saves.save('names', { names: next });
  };

  const remember = (entered: Entered, warnings: string[]) => {
    if (!entered.contentTransformed) return;
    const script = entered.contentTransformed;
    setWarned((was) => new Map(was).set(script, warnings));
  };

  return (
    <div className="flex flex-col gap-3" data-glossary-entry-names="">
      {shared.status === 'error' && (
        <p className="text-muted-foreground text-xs">
          Which names are shared could not be read, so no name’s text can be
          edited.
        </p>
      )}
      {groups.map((group) => {
        const groupKey = `${group.kind}:${group.language}`;
        const canAdd =
          !readOnly &&
          (group.kind === 'alternatives' || group.kind === 'language');
        const adding = editing?.group === groupKey && !editing.name;
        if (!group.names.length && !canAdd) return null;
        return (
          <section
            key={groupKey}
            className="flex flex-col gap-1"
            data-glossary-name-group={group.kind}
            data-language={group.language ?? undefined}
          >
            <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {GROUP_TITLES[group.kind](group.language)}
            </h4>
            {group.kind === 'alternatives' && (
              <p className="text-muted-foreground text-xs">
                Readers never see these names. They are used only for matching
                and search.
              </p>
            )}
            <ul className="flex flex-col divide-y">
              {group.names.map((name, index) => {
                const root = isRootName(names, name);
                const isEditing =
                  editing?.group === groupKey && editing.name === name;
                const editable =
                  !readOnly &&
                  group.kind !== 'other' &&
                  textEditable(shared, name);
                const removable = !readOnly && group.kind !== 'main' && !root;
                const warnings = name.contentTransformed
                  ? warned.get(name.contentTransformed)
                  : undefined;
                return (
                  <li
                    key={keyOf(name, index)}
                    className="flex flex-col gap-1 py-1"
                    data-glossary-name={name.content}
                  >
                    {isEditing ? (
                      <NameForm
                        group={group}
                        name={name}
                        disabled={disabled}
                        onCancel={() => setEditing(null)}
                        onSubmit={(entered, found) => {
                          remember(entered, found);
                          save(
                            replacingName(names, name, {
                              ...name,
                              ...enteredText(entered),
                            }),
                          );
                        }}
                      />
                    ) : (
                      <>
                        <div className="flex min-h-10 items-center gap-2 text-sm">
                          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
                            <NameText name={name} />
                            {root && group.kind !== 'main' && (
                              <span className="text-muted-foreground text-xs">
                                Root name
                              </span>
                            )}
                            {isShared(shared, name) && (
                              <span
                                className="rounded bg-muted px-1.5 text-xs"
                                title="Another entry or a creator uses this name, so its text can’t be edited here."
                                data-glossary-name-shared=""
                              >
                                Shared
                              </span>
                            )}
                          </span>
                          {editable && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Edit ${name.content}`}
                              disabled={disabled}
                              onClick={() =>
                                setEditing({ group: groupKey, name })
                              }
                            >
                              <PencilIcon />
                            </Button>
                          )}
                          {removable && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Remove ${name.content}`}
                              disabled={disabled}
                              onClick={() => save(withoutName(names, name))}
                            >
                              <Trash2Icon className="text-destructive" />
                            </Button>
                          )}
                        </div>
                        {takesAttestation(group) &&
                          (readOnly ? (
                            name.attestation && (
                              <span className="text-muted-foreground text-xs">
                                {formatAttestation(name.attestation)}
                              </span>
                            )
                          ) : (
                            <AttestationPicker
                              name={name}
                              disabled={disabled}
                              onChange={(attestation) =>
                                save(
                                  replacingName(names, name, {
                                    ...name,
                                    attestation,
                                  }),
                                )
                              }
                            />
                          ))}
                      </>
                    )}
                    {warnings && <NameWarnings warnings={warnings} />}
                  </li>
                );
              })}
            </ul>
            {canAdd &&
              (adding ? (
                <NameForm
                  group={group}
                  disabled={disabled}
                  onCancel={() => setEditing(null)}
                  onSubmit={(entered, found) => {
                    remember(entered, found);
                    save(
                      withName(
                        names,
                        newName(
                          group,
                          entered.content,
                          entered.contentTransformed,
                        ),
                      ),
                    );
                  }}
                />
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  disabled={disabled}
                  onClick={() => setEditing({ group: groupKey })}
                >
                  <PlusIcon className="size-3.5" />
                  Add{' '}
                  {group.kind === 'alternatives'
                    ? 'an alternative'
                    : `a ${nameLanguageLabel(group.language)} name`}
                </Button>
              ))}
          </section>
        );
      })}
      <GlossaryEntrySaveStatus
        saves={saves}
        field="names"
        describeTheirs={(theirs) =>
          theirs.names.map((name) => name.content).join(', ')
        }
      />
    </div>
  );
};
