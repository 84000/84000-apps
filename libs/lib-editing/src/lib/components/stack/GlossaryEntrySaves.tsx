'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  createBrowserClient,
  type GlossaryEntry,
  type GlossaryEntryChange,
} from '@eightyfourthousand/data-access';
import { Button } from '@eightyfourthousand/design-system';

import type { StackController } from './StackController';
import { saveGlossaryEntryPanelChange } from './glossary-entry-panel';

/** A part of the entry the panel saves on its own. */
export type GlossaryEntryPanelField =
  | 'names'
  | 'definitionRend'
  | 'glossMode'
  | 'authorityUuid';

const FIELD_LABELS: Record<GlossaryEntryPanelField, string> = {
  names: 'names',
  definitionRend: 'definition relation',
  glossMode: 'matching mode',
  authorityUuid: 'authority',
};

/** The panel's latest save, until it settles. */
export type GlossaryEntryPanelPending = {
  uuid: string;
  field: GlossaryEntryPanelField;
  after: GlossaryEntryChange;
} & (
  | { status: 'saving' }
  | { status: 'conflict'; theirs: GlossaryEntry | null }
  | { status: 'failed'; error: string }
);

/** The panel's saves: one change at a time, each on its own. */
export type GlossaryEntrySaves = {
  /** The entry's latest save, while it runs or until its failure is settled. */
  pending: GlossaryEntryPanelPending | null;
  /** Whether a change can be saved now. */
  canSave: boolean;
  save: (field: GlossaryEntryPanelField, after: GlossaryEntryChange) => void;
  /** Take the stored entry and drop the editor's change. */
  useTheirs: () => void;
  /** Save the editor's change over the stored entry. */
  keepMine: () => void;
  /** Drop a failed change. */
  dismiss: () => void;
};

/** Each entry's latest save in a stack, kept while the panel switches rows. */
class GlossaryEntrySaveStore {
  private saves = new Map<string, GlossaryEntryPanelPending>();
  private listeners = new Set<() => void>();

  get = (uuid: string | undefined) => (uuid && this.saves.get(uuid)) || null;

  set(uuid: string, pending: GlossaryEntryPanelPending | null) {
    if (pending) this.saves.set(uuid, pending);
    else this.saves.delete(uuid);
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

const stores = new WeakMap<StackController, GlossaryEntrySaveStore>();

const saveStoreOf = (controller: StackController) => {
  let store = stores.get(controller);
  if (!store) {
    store = new GlossaryEntrySaveStore();
    stores.set(controller, store);
  }
  return store;
};

/**
 * Saves for the entry a panel shows. A save is guarded by the entry as the
 * row holds it; a saved entry becomes the row's. A save still running, or
 * refused, when the panel moves to another row is there on coming back.
 */
export const useGlossaryEntrySaves = (
  controller: StackController,
  entry: GlossaryEntry | null,
): GlossaryEntrySaves => {
  const store = saveStoreOf(controller);
  const uuid = entry?.uuid;
  const pending = useSyncExternalStore(
    store.subscribe,
    () => store.get(uuid),
    () => null,
  );

  const run = useCallback(
    async (
      before: GlossaryEntry,
      field: GlossaryEntryPanelField,
      after: GlossaryEntryChange,
    ) => {
      const { uuid } = before;
      store.set(uuid, { uuid, field, after, status: 'saving' });
      const outcome = await saveGlossaryEntryPanelChange({
        client: createBrowserClient(),
        before,
        after,
      });
      if (outcome.status === 'saved') {
        controller.settleGlossaryEntry(uuid, outcome.entry);
        store.set(uuid, null);
        return;
      }
      store.set(uuid, { uuid, field, after, ...outcome });
    },
    [controller, store],
  );

  const save = useCallback(
    (field: GlossaryEntryPanelField, after: GlossaryEntryChange) => {
      if (!entry || controller.isReadOnly() || pending) return;
      void run(entry, field, after);
    },
    [controller, entry, pending, run],
  );

  const useTheirs = useCallback(() => {
    if (pending?.status !== 'conflict') return;
    if (pending.theirs) {
      controller.settleGlossaryEntry(pending.uuid, pending.theirs);
    }
    store.set(pending.uuid, null);
  }, [controller, pending, store]);

  const keepMine = useCallback(() => {
    if (pending?.status !== 'conflict' || !pending.theirs) return;
    controller.settleGlossaryEntry(pending.uuid, pending.theirs);
    const before = controller.getGlossaryEntry(pending.uuid);
    if (before) void run(before, pending.field, pending.after);
  }, [controller, pending, run]);

  const dismiss = useCallback(() => {
    if (pending) store.set(pending.uuid, null);
  }, [pending, store]);

  return {
    pending,
    canSave: !!entry && !controller.isReadOnly() && !pending,
    save,
    useTheirs,
    keepMine,
    dismiss,
  };
};

/**
 * A field's save as the panel shows it: saving, refused because the entry
 * changed meanwhile, or failed. Nothing once it has saved.
 */
export const GlossaryEntrySaveStatus = ({
  saves,
  field,
  describeTheirs,
}: {
  saves: GlossaryEntrySaves;
  field: GlossaryEntryPanelField;
  /** The stored value of the field, as the panel words it. */
  describeTheirs?: (theirs: GlossaryEntry) => string;
}) => {
  const { pending } = saves;
  if (!pending || pending.field !== field) return null;
  const what = FIELD_LABELS[field];
  if (pending.status === 'saving') {
    return (
      <p className="text-muted-foreground text-xs" aria-live="polite">
        Saving…
      </p>
    );
  }
  if (pending.status === 'failed') {
    return (
      <div
        role="alert"
        className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm"
      >
        <p>
          The {what} could not be saved: {pending.error}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={saves.dismiss}>
            Undo my change
          </Button>
        </div>
      </div>
    );
  }
  const { theirs } = pending;
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm"
      data-glossary-entry-conflict=""
    >
      {theirs ? (
        <>
          <p className="font-medium">
            This entry was changed by someone else since the panel loaded it, so
            your {what} change was not saved.
          </p>
          {describeTheirs && (
            <p className="text-muted-foreground">
              Saved now: {describeTheirs(theirs)}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={saves.useTheirs}>
              Use theirs
            </Button>
            <Button size="sm" onClick={saves.keepMine}>
              Keep mine
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="font-medium">
            This entry was deleted by someone else, so your {what} change was
            not saved.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={saves.useTheirs}>
              Discard my change
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
