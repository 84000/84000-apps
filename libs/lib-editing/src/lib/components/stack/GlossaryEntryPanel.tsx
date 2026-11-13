'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  createBrowserClient,
  getGlossaryAuthorities,
  termDefinition,
  type GlossaryAuthority,
  type GlossaryAuthorityMatch,
  type GlossaryEntry,
} from '@eightyfourthousand/data-access';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@eightyfourthousand/design-system';

import { GlossaryAuthoritySearch } from '../shared/glossary/GlossaryAuthoritySearch';
import { nameLanguageLabel } from '../shared/glossary/glossary-languages';
import {
  GlossaryEntrySaveStatus,
  useGlossaryEntrySaves,
  type GlossaryEntryPanelField,
  type GlossaryEntrySaves,
} from './GlossaryEntrySaves';
import type { StackController } from './StackController';
import { glossaryDefinitionToContent } from './glossary-codec';
import {
  glossaryEntryPanelOf,
  useGlossaryEntryPanel,
} from './glossary-entry-panel';
import { englishNameOf, GlossaryRowNames } from './glossary-row';
import { renderGlossaryRow } from './glossary-work';

type Choice = { value: string; label: string; explanation: string };

/** The `none` choice of the definition relation, stored as null. */
const NO_REND = '';

/** The definition relations, in the order the panel offers them. */
export const DEFINITION_REND_CHOICES: Choice[] = [
  {
    value: NO_REND,
    label: 'None',
    explanation: 'No relation set: readers see this entry’s definition.',
  },
  {
    value: 'incompatibleWithStandard',
    label: 'Incompatible with the standard',
    explanation: 'Readers see only this entry’s definition.',
  },
  {
    value: 'overrideWithStandard',
    label: 'Override with the standard',
    explanation: 'Readers see the standard definition instead of this one.',
  },
  {
    value: 'appendWithStandard',
    label: 'Append the standard',
    explanation: 'Readers see this entry’s definition, then the standard one.',
  },
  {
    value: 'prependWithStandard',
    label: 'Prepend the standard',
    explanation: 'Readers see the standard definition, then this entry’s.',
  },
];

/** The matching modes, in the order the panel offers them. */
export const GLOSSARY_MODE_CHOICES: Choice[] = [
  {
    value: 'match',
    label: 'Match',
    explanation:
      'Its names are linked wherever they appear in the translation.',
  },
  {
    value: 'marked',
    label: 'Marked',
    explanation: 'Only instances marked by hand are linked.',
  },
];

/** A stored definition as the row draws it, through the glossary codec. */
const definitionHtml = (definition: string | null) =>
  renderGlossaryRow({
    type: 'doc',
    content: glossaryDefinitionToContent(definition),
  });

const Definition = ({
  html,
  empty,
  ...props
}: {
  html: string | null;
  empty: string;
  'data-glossary-entry-preview'?: string;
  'data-glossary-entry-standard'?: string;
}) => {
  const drawn = definitionHtml(html);
  if (!drawn) {
    return (
      <p className="text-muted-foreground text-sm italic" {...props}>
        {empty}
      </p>
    );
  }
  return (
    <div
      className="rounded-md border bg-muted/30 p-2 font-serif text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: drawn }}
      {...props}
    />
  );
};

type AuthorityRead =
  | { status: 'reading' }
  | { status: 'error' }
  | { status: 'missing' }
  | { status: 'read'; authority: GlossaryAuthority };

/** The entry's authority, read again when the entry is relinked. */
const useAuthority = (uuid: string | undefined): AuthorityRead => {
  const [read, setRead] = useState<{
    uuid: string;
    authority: GlossaryAuthority | null | undefined;
  } | null>(null);

  useEffect(() => {
    if (!uuid) return;
    let current = true;
    getGlossaryAuthorities({
      client: createBrowserClient(),
      uuids: [uuid],
    }).then((authorities) => {
      if (current) setRead({ uuid, authority: authorities && authorities[0] });
    });
    return () => {
      current = false;
    };
  }, [uuid]);

  if (!uuid || read?.uuid !== uuid) return { status: 'reading' };
  if (read.authority === null) return { status: 'error' };
  if (!read.authority) return { status: 'missing' };
  return { status: 'read', authority: read.authority };
};

/**
 * The value a field shows: the editor's change while it saves or after it was
 * refused, else the entry's.
 */
const shownValue = <T,>(
  saves: GlossaryEntrySaves,
  field: GlossaryEntryPanelField,
  stored: T,
  pick: (change: NonNullable<GlossaryEntrySaves['pending']>['after']) => T,
): T => (saves.pending?.field === field ? pick(saves.pending.after) : stored);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-2 border-t px-4 py-3">
    <h3 className="text-sm font-semibold">{title}</h3>
    {children}
  </section>
);

/** A set of choices: radios to edit, or only the chosen one when read-only. */
const ChoiceGroup = ({
  name,
  legend,
  choices,
  value,
  readOnly,
  disabled,
  onChange,
}: {
  name: string;
  legend: string;
  choices: Choice[];
  value: string;
  readOnly: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) => {
  const id = useId();
  const chosen = choices.find((choice) => choice.value === value);
  if (readOnly) {
    return (
      <div className="flex flex-col text-sm" data-glossary-entry-choice={name}>
        <span className="font-medium">{chosen?.label ?? value}</span>
        {chosen && (
          <span className="text-muted-foreground text-xs">
            {chosen.explanation}
          </span>
        )}
      </div>
    );
  }
  return (
    <fieldset
      className="flex flex-col gap-1.5"
      data-glossary-entry-choice={name}
    >
      <legend className="sr-only">{legend}</legend>
      {!chosen && (
        <p className="text-muted-foreground text-xs">
          Stored as “{value}”, which the panel does not offer.
        </p>
      )}
      {choices.map((choice) => {
        const inputId = `${id}-${choice.value || 'none'}`;
        return (
          <label
            key={choice.value}
            htmlFor={inputId}
            className="flex cursor-pointer items-start gap-2 text-sm has-disabled:cursor-default"
          >
            <input
              id={inputId}
              type="radio"
              name={`${id}-${name}`}
              value={choice.value}
              checked={choice.value === value}
              disabled={disabled}
              onChange={() => onChange(choice.value)}
              className="accent-primary mt-1"
            />
            <span className="flex flex-col">
              <span>{choice.label}</span>
              <span className="text-muted-foreground text-xs">
                {choice.explanation}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
};

const AuthorityHeading = ({ authority }: { authority: GlossaryAuthority }) => (
  <span className="flex flex-wrap items-baseline gap-x-2">
    <span className="font-semibold">{authority.headword}</span>
    <span className="text-muted-foreground text-xs">
      {nameLanguageLabel(authority.headwordLanguage)}
    </span>
  </span>
);

/** The entry's authority, and the search that relinks it. */
const LinkedAuthority = ({
  read,
  saves,
  readOnly,
}: {
  read: AuthorityRead;
  saves: GlossaryEntrySaves;
  readOnly: boolean;
}) => {
  const [searching, setSearching] = useState(false);
  const [relinking, setRelinking] = useState<GlossaryAuthorityMatch | null>(
    null,
  );
  const current = read.status === 'read' ? read.authority : null;

  const confirm = () => {
    if (!relinking) return;
    saves.save('authorityUuid', { authorityUuid: relinking.uuid });
    setRelinking(null);
    setSearching(false);
  };

  return (
    <div className="flex flex-col gap-2" data-glossary-entry-authority="">
      {read.status === 'reading' && (
        <p className="text-muted-foreground text-sm">Reading the authority…</p>
      )}
      {read.status === 'error' && (
        <p role="alert" className="text-destructive text-sm">
          The authority could not be read.
        </p>
      )}
      {read.status === 'missing' && (
        <p className="text-muted-foreground text-sm">
          The linked authority was not found.
        </p>
      )}
      {current && (
        <>
          <AuthorityHeading authority={current} />
          <span className="text-muted-foreground text-xs">
            Standard definition
          </span>
          <Definition
            html={current.definition}
            empty="This authority has no standard definition."
            data-glossary-entry-standard=""
          />
        </>
      )}
      <GlossaryEntrySaveStatus saves={saves} field="authorityUuid" />
      {!readOnly &&
        (searching ? (
          <div className="flex flex-col gap-2">
            <GlossaryAuthoritySearch
              autoFocus
              currentUuid={current?.uuid}
              disabled={!saves.canSave}
              onSelect={setRelinking}
            />
            <Button
              size="sm"
              variant="ghost"
              className="self-start"
              onClick={() => setSearching(false)}
            >
              Stop searching
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            disabled={!saves.canSave}
            onClick={() => setSearching(true)}
          >
            Link another authority
          </Button>
        ))}
      <Dialog
        open={!!relinking}
        onOpenChange={(open) => !open && setRelinking(null)}
      >
        {relinking && (
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Link to {relinking.headword}?</DialogTitle>
              <DialogDescription>
                The entry moves from{' '}
                <strong>{current?.headword ?? 'its authority'}</strong> to{' '}
                <strong>{relinking.headword}</strong>. The definition readers
                see may change, as it can draw on the authority’s standard
                definition.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRelinking(null)}>
                Cancel
              </Button>
              <Button onClick={confirm}>Link</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

/** The entry the panel shows: its names, settings and authority. */
const GlossaryEntryPanelBody = ({
  controller,
  entry,
}: {
  controller: StackController;
  entry: GlossaryEntry;
}) => {
  const readOnly = controller.isReadOnly();
  const saves = useGlossaryEntrySaves(controller, entry);
  const authorityUuid = shownValue(
    saves,
    'authorityUuid',
    entry.authorityUuid,
    (after) => after.authorityUuid ?? entry.authorityUuid,
  );
  const authority = useAuthority(authorityUuid);
  const rend = shownValue(
    saves,
    'definitionRend',
    entry.definitionRend ?? NO_REND,
    (after) => after.definitionRend ?? NO_REND,
  );
  const mode = shownValue(
    saves,
    'glossMode',
    entry.glossMode,
    (after) => after.glossMode ?? 'match',
  );
  const standard =
    authority.status === 'read' ? authority.authority.definition : null;

  return (
    <div className="flex flex-col pb-6" data-glossary-entry-panel-body="">
      <Section title="Names">
        <GlossaryRowNames entry={entry} />
      </Section>

      <Section title="Authority">
        <LinkedAuthority read={authority} saves={saves} readOnly={readOnly} />
      </Section>

      <Section title="Definition relation">
        <ChoiceGroup
          name="definitionRend"
          legend="Definition relation"
          choices={DEFINITION_REND_CHOICES}
          value={rend}
          readOnly={readOnly}
          disabled={!saves.canSave}
          onChange={(value) =>
            saves.save('definitionRend', { definitionRend: value || null })
          }
        />
        <GlossaryEntrySaveStatus
          saves={saves}
          field="definitionRend"
          describeTheirs={(theirs) =>
            DEFINITION_REND_CHOICES.find(
              (choice) => choice.value === (theirs.definitionRend ?? NO_REND),
            )?.label ??
            theirs.definitionRend ??
            ''
          }
        />
        <span className="text-muted-foreground text-xs">
          What readers will see
        </span>
        <Definition
          html={termDefinition(entry.definition, standard, rend || null)}
          empty="Readers see no definition."
          data-glossary-entry-preview=""
        />
      </Section>

      <Section title="Matching">
        <ChoiceGroup
          name="glossMode"
          legend="Matching mode"
          choices={GLOSSARY_MODE_CHOICES}
          value={mode}
          readOnly={readOnly}
          disabled={!saves.canSave}
          onChange={(value) => saves.save('glossMode', { glossMode: value })}
        />
        <GlossaryEntrySaveStatus
          saves={saves}
          field="glossMode"
          describeTheirs={(theirs) =>
            GLOSSARY_MODE_CHOICES.find(
              (choice) => choice.value === theirs.glossMode,
            )?.label ?? theirs.glossMode
          }
        />
      </Section>
    </div>
  );
};

/**
 * The side panel for the parts of a glossary entry its row does not hold.
 * Opened from a row's label menu; while open it follows the selected row.
 */
export const GlossaryEntryPanel = ({
  controller,
}: {
  controller: StackController;
}) => {
  useSyncExternalStore(
    controller.subscribe,
    controller.getVersion,
    controller.getVersion,
  );
  const uuid = useGlossaryEntryPanel(controller);
  const entry = uuid ? controller.getGlossaryEntry(uuid) : null;
  const readOnly = controller.isReadOnly();
  const english = entry && englishNameOf(entry);
  const title = english?.content ?? entry?.names[0]?.content ?? 'Entry';
  const content = useRef<HTMLDivElement>(null);

  return (
    <Sheet
      modal={false}
      open={!!uuid}
      onOpenChange={(open) => !open && glossaryEntryPanelOf(controller).close()}
    >
      <SheetContent
        ref={content}
        side="left"
        className="w-full overflow-y-auto sm:max-w-md"
        // The rows stay usable beside it: selecting one switches the panel.
        onInteractOutside={(event) => event.preventDefault()}
        // Escape in a row's editor is the editor's, not the panel's.
        onEscapeKeyDown={(event) => {
          if (!content.current?.contains(document.activeElement)) {
            event.preventDefault();
          }
        }}
        onOpenAutoFocus={(event) => event.preventDefault()}
        data-glossary-entry-panel=""
      >
        <SheetHeader className="pr-16">
          <SheetTitle className="font-serif text-lg">{title}</SheetTitle>
          <SheetDescription>
            {readOnly
              ? 'This glossary entry, as stored. You can’t change it.'
              : 'Each change saves on its own.'}
          </SheetDescription>
        </SheetHeader>
        {entry ? (
          <GlossaryEntryPanelBody
            key={entry.uuid}
            controller={controller}
            entry={entry}
          />
        ) : (
          <p className="text-muted-foreground px-4 text-sm">
            This entry is no longer in the glossary.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
};
