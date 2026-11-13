'use client';

import type { GlossaryEntry } from '@eightyfourthousand/data-access';

import {
  CUSTOM_REND,
  DEFINITION_REND_CHOICES,
  GlossaryDefinitionRend,
  STANDARD_REND,
} from './GlossaryDefinitionRend';
import { GlossaryEntryNames } from './GlossaryEntryNames';
import {
  GlossaryEntrySaveStatus,
  useGlossaryEntrySaves,
  type GlossaryEntryPanelField,
  type GlossaryEntrySaves,
} from './GlossaryEntrySaves';
import { GlossaryLinkedAuthority } from './GlossaryLinkedAuthority';
import type { StackController } from './StackController';
import { useGlossaryAuthority } from './useGlossaryAuthority';

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
  <section className="flex flex-col gap-3 border-t py-4">
    <h3 className="text-base font-semibold">{title}</h3>
    {children}
  </section>
);

/** The entry the panel shows: its definition relation, names and authority. */
export const GlossaryEntryPanelBody = ({
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
  const authority = useGlossaryAuthority(authorityUuid);
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
      <Section title="Definition relation">
        <GlossaryDefinitionRend
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

      <Section title="Names">
        <GlossaryEntryNames entry={entry} saves={saves} readOnly={readOnly} />
      </Section>

      {/* Last, so its search results grow into the dialog's own scroll. */}
      <Section title="Authority">
        <GlossaryLinkedAuthority
          read={authority}
          saves={saves}
          readOnly={readOnly}
          drawsOnStandard={rend !== CUSTOM_REND}
        />
      </Section>
    </div>
  );
};
