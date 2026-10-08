'use client';

import {
  Button,
  MutedText,
  RevisionList,
} from '@eightyfourthousand/design-system/core';
import { cn } from '@eightyfourthousand/lib-utils';
import { useEffect, useId, useRef, useState } from 'react';
import { MarkdownEditor } from '../editor/markdown/MarkdownEditor';
import { hasMarkdownChanges } from '../editor/markdown/markdown-codec';
import type {
  PolicyDocument,
  PolicyFailure,
  PolicyPermissions,
  PolicyRevision,
  PolicySource,
  PolicyWriteResult,
} from './policy-source';

/**
 * A successful save or restore, reported so a host can react, e.g. by
 * updating a model's context. `restoredFrom` is the revision a restore wrote back.
 */
export type PolicySaved = Extract<PolicyWriteResult, { ok: true }> & {
  name: string;
  restoredFrom?: string;
};

/** Props for {@link PolicyEditor}. */
export type PolicyEditorProps = {
  source: PolicySource;
  /** `read` browses policies and their history; `edit` also saves and restores. */
  permissions: PolicyPermissions;
  /** The policy to open first. */
  initialName?: string;
  /** Called after each successful save or restore. */
  onSaved?: (saved: PolicySaved) => void;
  /** Called whenever the open policy gains or loses unsaved changes, e.g. to guard navigation. */
  onDirtyChange?: (dirty: boolean) => void;
  className?: string;
};

const clean = (markdown: string) => ({ markdown, dirty: false, exact: true });

const MESSAGES: Record<PolicyFailure['reason'], string> = {
  conflict:
    'This policy changed after you opened it, so it was not saved. Reload it to see the latest version; your unsaved changes will be lost.',
  'not-found': 'This policy no longer exists.',
  exists: 'A policy with that name already exists.',
  forbidden: 'You do not have permission to do that.',
  error: 'Something went wrong.',
};

const asFailure = (error: unknown): PolicyFailure => {
  console.error(error);
  return { ok: false, reason: 'error', message: String(error) };
};

/** Logs a failed list or history load, which shows as unavailable (`null`). */
const unavailable = (error: unknown) => {
  console.error(error);
  return null;
};

const formatStamp = (iso: string) => new Date(iso).toLocaleString();

/** Calls a source method, turning a synchronous throw into a rejection. */
const call = <T,>(method: () => Promise<T>) =>
  new Promise<T>((resolve) => resolve(method()));

/**
 * Browses, edits and restores policies through a {@link PolicySource}. Writes
 * only on an explicit save of a changed document that serializes exactly,
 * always against the version it loaded, and renders only the controls
 * `permissions` allow.
 */
export const PolicyEditor = ({
  source,
  permissions,
  initialName,
  onSaved,
  onDirtyChange,
  className,
}: PolicyEditorProps) => {
  // `null` means the list or history could not be loaded.
  const [names, setNames] = useState<string[] | null>();
  const [history, setHistory] = useState<PolicyRevision[] | null>([]);
  const [selected, setSelected] = useState(initialName);
  const [doc, setDoc] = useState<PolicyDocument>();
  // Remounts the editor whenever a document is (re)loaded.
  const [generation, setGeneration] = useState(0);
  const [draft, setDraft] = useState(clean(''));
  // A save or restore is in flight for the open policy.
  const [busy, setBusy] = useState<'save' | 'restore'>();
  // The selected policy is being read.
  const [loading, setLoading] = useState(Boolean(initialName));
  const [failure, setFailure] = useState<PolicyFailure>();
  const [viewing, setViewing] =
    useState<Awaited<ReturnType<PolicySource['readRevision']>>>();
  // Bumped on every open, so responses for a policy no longer open are dropped.
  const opened = useRef(0);
  // The last revision asked for, so a response for any other is dropped.
  const requested = useRef<string | undefined>(undefined);
  const reported = useRef({ dirty: false, onDirtyChange });
  const lockId = useId();

  /** Returns a check that no other policy has been opened since this call. */
  const stillOpen = () => {
    const ticket = opened.current;
    return () => ticket === opened.current;
  };

  useEffect(() => {
    const report = reported.current;
    report.onDirtyChange = onDirtyChange;
    if (report.dirty !== draft.dirty) {
      report.dirty = draft.dirty;
      onDirtyChange?.(draft.dirty);
    }
  });

  // Unmounting drops unsaved changes, so a host guarding them can stop.
  useEffect(() => {
    const report = reported.current;
    return () => {
      if (report.dirty) {
        report.onDirtyChange?.(false);
      }
    };
  }, []);

  const closeRevision = () => {
    requested.current = undefined;
    setViewing(undefined);
  };

  const loadHistory = (name: string) => {
    const fresh = stillOpen();
    call(() => source.history(name))
      .catch(unavailable)
      .then((found) => fresh() && setHistory(found));
  };

  const show = (loaded: PolicyDocument) => {
    setSelected(loaded.name);
    setDoc(loaded);
    setDraft(clean(loaded.content));
    setGeneration((value) => value + 1);
    closeRevision();
    setFailure(undefined);
    setHistory([]);
    loadHistory(loaded.name);
  };

  /** Closes the open policy, dropping everything about it, and opens `name`. */
  const open = async (name: string | undefined) => {
    opened.current += 1;
    const fresh = stillOpen();
    setSelected(name);
    setDoc(undefined);
    setDraft(clean(''));
    closeRevision();
    setHistory([]);
    setFailure(undefined);
    setBusy(undefined);
    setLoading(Boolean(name));
    if (!name) {
      return;
    }
    const found = await call(() => source.read(name)).catch(asFailure);
    if (!fresh()) {
      return;
    }
    setLoading(false);
    // A missing policy shows as not found, without an alert.
    if (found && 'ok' in found) {
      setFailure(found);
    } else if (found) {
      show(found);
    }
  };

  useEffect(() => {
    if (!permissions.read) {
      return;
    }
    let current = true;
    call(() => source.list())
      .catch(unavailable)
      .then((found) => current && setNames(found));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new source closes the open policy
    open(initialName);
    return () => {
      current = false;
    };
    // Only on mount and when the source changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, permissions.read]);

  /**
   * Settles a write: while its policy is still open, shows a failure or
   * `apply`s a success; then reports any success.
   */
  const settle = (
    name: string,
    result: PolicyWriteResult,
    fresh: () => boolean,
    apply: (version: string) => void,
    restoredFrom?: string,
  ) => {
    if (fresh()) {
      setBusy(undefined);
      if (result.ok) {
        apply(result.version);
      } else {
        setFailure(result);
      }
    }
    if (result.ok) {
      try {
        onSaved?.({ ...result, name, ...(restoredFrom && { restoredFrom }) });
      } catch (error) {
        console.error(error);
      }
    }
  };

  const save = async () => {
    // Never write an unchanged document, or one the editor cannot reproduce.
    if (!doc || !draft.dirty || !draft.exact || busy) {
      return;
    }
    const { name, version: expectedVersion } = doc;
    const content = draft.markdown;
    const fresh = stillOpen();
    setBusy('save');
    const result = await call(() =>
      source.write({ name, content, expectedVersion }),
    ).catch(asFailure);
    settle(name, result, fresh, (version) => {
      // The saved markdown becomes the editor's source. The editor reported
      // it, so it treats it as an echo and keeps anything typed since; that
      // typing stays unsaved, measured against what was saved.
      setDoc({ name, content, version });
      setDraft((current) =>
        hasMarkdownChanges(current.markdown, content)
          ? { ...current, dirty: true }
          : clean(content),
      );
      setFailure(undefined);
      loadHistory(name);
    });
  };

  const restore = async ({ path }: PolicyRevision) => {
    if (!doc || busy) {
      return;
    }
    const { name, version: expectedVersion } = doc;
    const fresh = stillOpen();
    setBusy('restore');
    const result = await call(() =>
      source.restore({ name, revisionPath: path, expectedVersion }),
    ).catch(asFailure);
    settle(name, result, fresh, () => open(name), path);
  };

  const viewRevision = async ({ path }: PolicyRevision) => {
    const fresh = stillOpen();
    requested.current = path;
    const found = await call(() => source.readRevision(path)).catch(asFailure);
    if (!fresh() || requested.current !== path) {
      return;
    }
    if (found && !('ok' in found)) {
      setViewing(found);
    } else {
      setFailure(found ?? { ok: false, reason: 'not-found' });
    }
  };

  // Why the list cannot open another policy now, if it cannot.
  const lock =
    permissions.edit && draft.dirty
      ? 'Save or discard your changes first.'
      : busy || loading
        ? 'Wait for the open policy to finish loading or saving.'
        : undefined;

  if (!permissions.read) {
    return (
      <MutedText className={cn('p-4', className)}>
        You do not have permission to read policies.
      </MutedText>
    );
  }

  return (
    <div className={cn('flex h-full min-h-0', className)}>
      <nav
        aria-label="Policies"
        className="flex w-64 shrink-0 flex-col overflow-auto border-r p-4"
      >
        <MutedText id={lockId} role="status" className="empty:hidden">
          {lock}
        </MutedText>
        {!names?.length ? (
          <MutedText>
            {names === null
              ? 'The policies could not be loaded.'
              : names
                ? 'There are no policies yet.'
                : 'Loading policies…'}
          </MutedText>
        ) : (
          names.map((name) => (
            <Button
              key={name}
              variant={name === selected ? 'active' : 'ghost'}
              size="sm"
              className="justify-start"
              aria-current={name === selected ? 'true' : undefined}
              disabled={Boolean(lock)}
              title={lock}
              aria-describedby={lock && lockId}
              onClick={() => open(name)}
            >
              {name}
            </Button>
          ))
        )}
      </nav>
      <section
        aria-label="Policy editor"
        className="flex min-w-0 flex-1 flex-col gap-3 p-4"
      >
        {failure && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <span className="me-auto">
              {MESSAGES[failure.reason]}
              {failure.reason === 'error' && ` ${failure.message}`}
            </span>
            {failure.reason === 'conflict' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => show(failure.current)}
              >
                Reload
              </Button>
            )}
          </div>
        )}
        {!doc ? (
          <MutedText>
            {loading
              ? 'Loading policy…'
              : !selected
                ? 'Select a policy to open it.'
                : failure
                  ? 'The policy could not be loaded.'
                  : 'Policy not found.'}
          </MutedText>
        ) : (
          <>
            <header className="flex items-center gap-2">
              <h2 className="me-auto text-lg font-semibold">{doc.name}</h2>
              {permissions.edit && draft.dirty && (
                <Button
                  variant="outline"
                  size="sm"
                  // A save in flight settles against the text it sent.
                  disabled={Boolean(busy)}
                  onClick={() => show(doc)}
                >
                  Discard changes
                </Button>
              )}
              {permissions.edit && (
                <Button
                  size="sm"
                  disabled={!draft.dirty || !draft.exact || Boolean(busy)}
                  onClick={save}
                >
                  {busy === 'save' ? 'Saving…' : 'Save'}
                </Button>
              )}
            </header>
            <div className={cn('flex min-h-0 flex-1', viewing && 'hidden')}>
              <MarkdownEditor
                key={generation}
                source={doc.content}
                editable={permissions.edit}
                onChange={(markdown, dirty, exact) =>
                  setDraft({ markdown, dirty, exact })
                }
              />
            </div>
            {viewing && (
              <section
                aria-label="Revision"
                className="flex min-h-0 flex-1 flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <MutedText className="me-auto">
                    Revision from {formatStamp(viewing.revision.archivedAt)}
                  </MutedText>
                  <Button variant="outline" size="sm" onClick={closeRevision}>
                    Back to current
                  </Button>
                  {permissions.edit && (
                    <Button
                      size="sm"
                      disabled={Boolean(lock)}
                      title={lock}
                      aria-describedby={lock && lockId}
                      onClick={() => restore(viewing.revision)}
                    >
                      Restore
                    </Button>
                  )}
                </div>
                <pre className="flex-1 overflow-auto whitespace-pre-wrap rounded-md border p-3 font-mono text-sm">
                  {viewing.content}
                </pre>
              </section>
            )}
            <RevisionList
              title="History"
              defaultOpen
              items={history ?? []}
              unavailable={history === null}
              toRevision={(revision) => ({
                id: revision.path,
                label: formatStamp(revision.archivedAt),
              })}
              selectedId={viewing?.revision.path}
              onSelect={viewRevision}
            />
          </>
        )}
      </section>
    </div>
  );
};
