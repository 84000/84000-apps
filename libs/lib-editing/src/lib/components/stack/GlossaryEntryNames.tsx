'use client';

import { useState } from 'react';
import {
  formatAttestation,
  type GlossaryEntry,
} from '@eightyfourthousand/data-access';
import { Button } from '@eightyfourthousand/design-system';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';

import {
  nameLanguageLabel,
  tibetanScript,
} from '../shared/glossary/glossary-languages';
import { GlossaryNameAttestation } from './GlossaryNameAttestation';
import {
  GlossaryNameForm,
  NameWarnings,
  type EnteredName,
} from './GlossaryNameForm';
import {
  GlossaryEntrySaveStatus,
  type GlossaryEntrySaves,
} from './GlossaryEntrySaves';
import {
  enteredText,
  groupEntryNames,
  groupTitle,
  isRootName,
  newName,
  replacingName,
  takesAttestation,
  withName,
  withoutName,
  type PanelName,
} from './glossary-entry-names';
import { isShared, textEditable, useSharedNames } from './useSharedNames';

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

  const remember = (entered: EnteredName, warnings: string[]) => {
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
            {/* An empty language group's add button already names it. */}
            {(group.kind !== 'language' || !!group.names.length || adding) && (
              <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {groupTitle(group)}
              </h4>
            )}
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
                    className="flex flex-col gap-2 py-3"
                    data-glossary-name={name.content}
                  >
                    {isEditing ? (
                      <GlossaryNameForm
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
                          <span className="flex min-w-0 flex-wrap items-center gap-x-2">
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
                              className="ml-auto"
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
                            <GlossaryNameAttestation
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
                <GlossaryNameForm
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
                  className="-ml-3 self-start"
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
