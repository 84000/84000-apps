'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  createBrowserClient,
  getGlossaryAuthorities,
  GLOSSARY_DEFINITION_ALLOWLIST,
  sanitizeHtml,
  type GlossaryAuthority,
  type GlossaryAuthorityMatch,
  type GlossaryEntry,
} from '@eightyfourthousand/data-access';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@eightyfourthousand/design-system';
import { PencilIcon, XIcon } from 'lucide-react';

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

/** What a stored null renders as: the entry's own definition. */
const CUSTOM_REND = 'incompatibleWithStandard';
const STANDARD_REND = 'overrideWithStandard';

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

/**
 * A stored definition as the row draws it, through the glossary codec. An
 * authority's definition is not saved through the entry's sanitizing save, so
 * it is sanitized here first.
 */
const definitionHtml = (definition: string | null) =>
  renderGlossaryRow({
    type: 'doc',
    content: glossaryDefinitionToContent(
      sanitizeHtml({
        html: definition ?? '',
        allowlist: GLOSSARY_DEFINITION_ALLOWLIST,
      }),
    ),
  });

const Definition = ({
  html,
  empty,
  ...props
}: {
  html: string | null;
  empty: string;
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
  <section className="flex flex-col gap-2 border-t py-3">
    <h3 className="text-sm font-semibold">{title}</h3>
    {children}
  </section>
);

/** The entry's definition relation: a select to edit, its label when read-only. */
const DefinitionRend = ({
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

/** The authority's headword, with its language beneath. */
const AuthorityHeading = ({ authority }: { authority: GlossaryAuthority }) => (
  <span className="flex flex-col">
    <span className="font-semibold">{authority.headword}</span>
    <span className="text-muted-foreground text-xs">
      {nameLanguageLabel(authority.headwordLanguage)}
    </span>
  </span>
);

/** Asks before relinking the entry, in place of the search. */
const RelinkConfirm = ({
  from,
  to,
  onConfirm,
  onCancel,
}: {
  from: string | undefined;
  to: GlossaryAuthorityMatch;
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <div
    role="group"
    aria-label={`Link to ${to.headword}?`}
    className="flex flex-col gap-2 rounded-md border p-3"
    data-glossary-entry-relink=""
  >
    <p className="text-sm font-medium">Link to {to.headword}?</p>
    <p className="text-muted-foreground text-sm">
      The entry moves from <strong>{from ?? 'its authority'}</strong> to{' '}
      <strong>{to.headword}</strong>. The definition readers see may change, as
      it can draw on the authority’s standard definition.
    </p>
    <div className="flex gap-2">
      <Button size="sm" onClick={onConfirm}>
        Link
      </Button>
      <Button size="sm" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  </div>
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
      {(current || !readOnly) && (
        <div className="flex items-start gap-2">
          {current ? <AuthorityHeading authority={current} /> : <span />}
          {!readOnly && !searching && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Link another authority"
              disabled={!saves.canSave}
              onClick={() => setSearching(true)}
            >
              <PencilIcon />
            </Button>
          )}
        </div>
      )}
      {current && (
        <Definition
          html={current.definition}
          empty="This authority has no standard definition."
          data-glossary-entry-standard=""
        />
      )}
      <GlossaryEntrySaveStatus saves={saves} field="authorityUuid" />
      {!readOnly &&
        searching &&
        (relinking ? (
          <RelinkConfirm
            from={current?.headword}
            to={relinking}
            onConfirm={confirm}
            onCancel={() => setRelinking(null)}
          />
        ) : (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <GlossaryAuthoritySearch
                autoFocus
                currentUuid={current?.uuid}
                disabled={!saves.canSave}
                onSelect={setRelinking}
              />
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Stop searching"
              onClick={() => setSearching(false)}
            >
              <XIcon />
            </Button>
          </div>
        ))}
    </div>
  );
};

/** The entry the panel shows: its names, authority and definition relation. */
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
  // A stored null reads as the entry's own definition, so it shows as custom.
  const rend = shownValue(
    saves,
    'definitionRend',
    entry.definitionRend ?? CUSTOM_REND,
    (after) => after.definitionRend ?? CUSTOM_REND,
  );
  const noStandard =
    authority.status === 'read' && !authority.authority.definition?.trim();

  return (
    <div className="flex flex-col" data-glossary-entry-panel-body="">
      <Section title="Names">
        <GlossaryRowNames entry={entry} />
      </Section>

      <Section title="Authority">
        <LinkedAuthority read={authority} saves={saves} readOnly={readOnly} />
      </Section>

      <Section title="Definition relation">
        <DefinitionRend
          value={rend}
          readOnly={readOnly}
          disabled={!saves.canSave}
          onChange={(value) =>
            saves.save('definitionRend', { definitionRend: value })
          }
        />
        {rend === STANDARD_REND && noStandard && (
          <p
            role="status"
            className="text-destructive text-sm"
            data-glossary-entry-no-standard=""
          >
            This authority has no standard definition, so readers will see no
            definition.
          </p>
        )}
        <GlossaryEntrySaveStatus
          saves={saves}
          field="definitionRend"
          describeTheirs={(theirs) =>
            DEFINITION_REND_CHOICES.find(
              (choice) =>
                choice.value === (theirs.definitionRend ?? CUSTOM_REND),
            )?.label ??
            theirs.definitionRend ??
            ''
          }
        />
      </Section>
    </div>
  );
};

/**
 * The dialog for the parts of a glossary entry its row does not hold, opened
 * from a row's label menu.
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

  return (
    <Dialog
      open={!!uuid}
      onOpenChange={(open) => !open && glossaryEntryPanelOf(controller).close()}
    >
      <DialogContent
        className="max-w-readable"
        onOpenAutoFocus={(event) => event.preventDefault()}
        data-glossary-entry-panel=""
      >
        <DialogHeader>
          <DialogTitle className="font-serif">{title}</DialogTitle>
          <DialogDescription>
            {readOnly
              ? 'This glossary entry, as stored. You can’t change it.'
              : 'Each change saves on its own.'}
          </DialogDescription>
        </DialogHeader>
        {entry ? (
          <GlossaryEntryPanelBody
            key={entry.uuid}
            controller={controller}
            entry={entry}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            This entry is no longer in the glossary.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
