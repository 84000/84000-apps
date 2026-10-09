'use client';

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DiffView,
  Input,
  Label,
  MutedText,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  RevisionList,
} from '@eightyfourthousand/design-system/core';
import { cn } from '@eightyfourthousand/lib-utils';
import {
  LoaderCircleIcon,
  PencilIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
} from 'lucide-react';
import {
  type ComponentProps,
  type ComponentType,
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
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
  /**
   * `read` browses policies and their history; `edit` also saves and
   * restores; `admin` also deletes and renames.
   */
  permissions: PolicyPermissions;
  /** The policy to open first. */
  initialName?: string;
  /** Called after each successful save or restore. */
  onSaved?: (saved: PolicySaved) => void;
  /** Called after a policy is deleted. */
  onDeleted?: (deleted: { name: string; archivedPath: string }) => void;
  /** Called after a policy is renamed. */
  onRenamed?: (renamed: {
    from: string;
    to: string;
    archivedPath: string;
  }) => void;
  /** Called whenever the open policy gains or loses unsaved changes, e.g. to guard navigation. */
  onDirtyChange?: (dirty: boolean) => void;
  className?: string;
};

const clean = (markdown: string) => ({ markdown, dirty: false, exact: true });

const MESSAGES: Record<PolicyFailure['reason'], string> = {
  conflict: 'This policy changed after you opened it.',
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

/** Wraps a policy name after its folder before breaking either part. */
const wrapAfterFolder = (name: string) =>
  name.split('/').map((part, index, parts) => (
    <span key={index} className="inline-block">
      {part}
      {index < parts.length - 1 && '/'}
    </span>
  ));

/** The policy name rule the server enforces: `<folder>/<name>`. */
const POLICY_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

type Action = 'save' | 'restore' | 'delete' | 'rename';

/** A change refused because the stored policy is not the version it named. */
type Conflict = {
  action: Action;
  current: PolicyDocument;
  /** What the change would write; for a delete or rename, what it expected. */
  mine: string;
  revisionPath?: string;
  to?: string;
};

const CONFLICT_TEXT: Record<
  Action,
  [mine: string, offer: string, act: string]
> = {
  save: ['Your changes', 'overwrite it with your changes', 'Overwrite'],
  restore: ['The revision', 'overwrite it with the revision', 'Overwrite'],
  delete: ['The version you opened', 'delete it anyway', 'Delete anyway'],
  rename: ['The version you opened', 'rename it anyway', 'Rename anyway'],
};

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
  onDeleted,
  onRenamed,
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
  // A change to the open policy is in flight.
  const [busy, setBusy] = useState<Action>();
  // The selected policy is being read.
  const [loading, setLoading] = useState(Boolean(initialName));
  const [failure, setFailure] = useState<PolicyFailure>();
  const [conflict, setConflict] = useState<Conflict>();
  const [confirming, setConfirming] = useState<'delete' | 'rename'>();
  // A policy chosen from the list while there were unsaved changes.
  const [pending, setPending] = useState<string>();
  // Why the rename dialog's name was refused.
  const [renameError, setRenameError] = useState<string>();
  const [viewing, setViewing] =
    useState<Awaited<ReturnType<PolicySource['readRevision']>>>();
  // Bumped on every open, so responses for a policy no longer open are dropped.
  const opened = useRef(0);
  // Bumped on every list request, so only the latest is shown.
  const listed = useRef(0);
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

  const loadList = () => {
    const ticket = ++listed.current;
    call(() => source.list())
      .catch(unavailable)
      .then((found) => ticket === listed.current && setNames(found));
  };

  /** Clears every dialog and message about the open policy. */
  const dismiss = () => {
    setFailure(undefined);
    setConflict(undefined);
    setConfirming(undefined);
    setRenameError(undefined);
  };

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
    dismiss();
    setHistory([]);
    loadHistory(loaded.name);
  };

  /** Closes the open policy, dropping everything about it, and opens `name`. */
  const open = async (name: string | undefined) => {
    opened.current += 1;
    const fresh = stillOpen();
    setPending(undefined);
    setSelected(name);
    setDoc(undefined);
    setDraft(clean(''));
    closeRevision();
    setHistory([]);
    dismiss();
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
    loadList();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new source closes the open policy
    open(initialName);
    return () => {
      listed.current += 1;
    };
    // Only on mount and when the source changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, permissions.read]);

  /** Opens `name` from the list, first asking to discard unsaved changes. */
  const navigate = (name: string) => {
    if (name === doc?.name) {
      return;
    }
    if (permissions.edit && draft.dirty) {
      setPending(name);
    } else {
      open(name);
    }
  };

  /** Shows a refused change, offering a conflict's reload or overwrite. */
  const refuse = (
    result: PolicyFailure,
    refused: Omit<Conflict, 'current'>,
  ) => {
    setConfirming(undefined);
    if (result.reason === 'conflict') {
      setConflict({ ...refused, current: result.current });
    } else {
      setFailure(result);
    }
  };

  /** Calls a host callback, which must not break the editor by throwing. */
  const report = (callback: () => void) => {
    try {
      callback();
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * Settles a write: while its policy is still open, shows a failure or
   * `apply`s a success; then reports any success.
   */
  const settle = (
    name: string,
    result: PolicyWriteResult,
    fresh: () => boolean,
    apply: (version: string) => void,
    refused: Omit<Conflict, 'current'>,
  ) => {
    if (fresh()) {
      setBusy(undefined);
      if (result.ok) {
        apply(result.version);
      } else {
        refuse(result, refused);
      }
    }
    if (result.ok) {
      const { revisionPath: restoredFrom } = refused;
      report(() =>
        onSaved?.({ ...result, name, ...(restoredFrom && { restoredFrom }) }),
      );
    }
  };

  /** Whether `permissions` allow the action now, whatever dialog is open. */
  const allowed = (action: Action) =>
    action === 'save' || action === 'restore'
      ? permissions.edit
      : permissions.admin;

  const save = async (expectedVersion = doc?.version) => {
    // Never write an unchanged document, or one the editor cannot reproduce.
    if (!doc || !draft.dirty || !draft.exact || busy || !allowed('save')) {
      return;
    }
    const { name } = doc;
    const content = draft.markdown;
    const fresh = stillOpen();
    setBusy('save');
    const result = await call(() =>
      source.write({ name, content, expectedVersion }),
    ).catch(asFailure);
    settle(
      name,
      result,
      fresh,
      (version) => {
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
      },
      { action: 'save', mine: content },
    );
  };

  const restore = async (
    revisionPath: string,
    content: string,
    expectedVersion = doc?.version,
  ) => {
    if (!doc || busy || !allowed('restore')) {
      return;
    }
    const { name } = doc;
    const fresh = stillOpen();
    setBusy('restore');
    const result = await call(() =>
      source.restore({ name, revisionPath, expectedVersion }),
    ).catch(asFailure);
    settle(name, result, fresh, () => open(name), {
      action: 'restore',
      mine: content,
      revisionPath,
    });
  };

  const remove = async (expectedVersion = doc?.version) => {
    if (!doc || busy || !allowed('delete')) {
      return;
    }
    const { name, content } = doc;
    const fresh = stillOpen();
    setBusy('delete');
    const result = await call(() =>
      source.delete({ name, expectedVersion }),
    ).catch(asFailure);
    if (fresh()) {
      setBusy(undefined);
      if (result.ok || result.reason === 'not-found') {
        loadList();
      }
      if (result.ok) {
        open(undefined);
      } else if (result.reason === 'not-found') {
        // It is gone, so stop showing it.
        open(undefined);
        setFailure(result);
      } else {
        refuse(result, { action: 'delete', mine: content });
      }
    }
    if (result.ok) {
      report(() => onDeleted?.({ name, archivedPath: result.archivedPath }));
    }
  };

  const rename = async (to: string, expectedVersion = doc?.version) => {
    if (!doc || busy || !allowed('rename')) {
      return;
    }
    const { name: from, content } = doc;
    const fresh = stillOpen();
    setBusy('rename');
    const result = await call(() =>
      source.rename({ from, to, expectedVersion }),
    ).catch(asFailure);
    if (fresh()) {
      setBusy(undefined);
      if (result.ok) {
        loadList();
        open(to);
      } else if (result.reason === 'exists') {
        // A repeat after a conflict closed the dialog, so reopen it.
        setConfirming('rename');
        setRenameError(MESSAGES.exists);
      } else {
        refuse(result, { action: 'rename', mine: content, to });
      }
    }
    if (result.ok) {
      report(() =>
        onRenamed?.({ from, to, archivedPath: result.archivedPath }),
      );
    }
  };

  /** Repeats the refused change over the stored version it conflicted with. */
  const overwrite = ({ action, current, mine, revisionPath, to }: Conflict) => {
    setConflict(undefined);
    if (current.name !== doc?.name) {
      return;
    }
    const { version } = current;
    if (action === 'save') {
      save(version);
    } else if (action === 'restore' && revisionPath) {
      restore(revisionPath, mine, version);
    } else if (action === 'delete') {
      remove(version);
    } else if (action === 'rename' && to) {
      rename(to, version);
    }
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

  // Why the open policy cannot be restored, renamed or deleted now, if it cannot.
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
    <ResizablePanelGroup
      orientation="horizontal"
      className={cn('min-h-0', className)}
    >
      <ResizablePanel
        id="policies"
        defaultSize="16rem"
        minSize="10rem"
        maxSize="50%"
        groupResizeBehavior="preserve-pixel-size"
      >
        <nav aria-label="Policies" className="h-full overflow-auto p-4">
          {!names?.length ? (
            <MutedText>
              {names === null
                ? 'The policies could not be loaded.'
                : names
                  ? 'There are no policies yet.'
                  : 'Loading policies…'}
            </MutedText>
          ) : (
            <div className="flex flex-col gap-0.5">
              {names.map((name) => (
                <Button
                  key={name}
                  variant="ghost"
                  size="sm"
                  // A long name wraps, so its highlight covers all of it.
                  className={cn(
                    'h-auto min-h-9 justify-start rounded py-2 text-left font-normal whitespace-normal [overflow-wrap:anywhere] hover:bg-primary/5 hover:text-foreground',
                    name === selected &&
                      'bg-primary/10 font-semibold text-primary hover:bg-primary/10 hover:text-primary',
                  )}
                  // The wrapped parts would otherwise be read with a space between.
                  aria-label={name}
                  aria-current={name === selected ? 'true' : undefined}
                  onClick={() => navigate(name)}
                >
                  <span>{wrapAfterFolder(name)}</span>
                </Button>
              ))}
            </div>
          )}
        </nav>
      </ResizablePanel>
      <ResizableHandle aria-label="Resize policy list" className="bg-border" />
      <ResizablePanel id="policy" minSize="20rem">
        <section
          aria-label="Policy editor"
          className="flex h-full min-w-0 flex-col gap-3 p-4"
        >
          <span id={lockId} role="status" className="sr-only">
            {lock}
          </span>
          {failure && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              {MESSAGES[failure.reason]}
              {failure.reason === 'error' && ` ${failure.message}`}
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
              <header className="flex items-center gap-1">
                <h2 className="text-lg font-semibold [overflow-wrap:anywhere]">
                  {doc.name}
                </h2>
                {permissions.admin && (
                  <IconButton
                    label="Rename"
                    icon={PencilIcon}
                    lock={lock}
                    lockId={lockId}
                    onClick={() => {
                      setRenameError(undefined);
                      setConfirming('rename');
                    }}
                  />
                )}
                <div className="ms-auto flex shrink-0 items-center gap-1">
                  {permissions.edit && draft.dirty && (
                    <IconButton
                      label="Discard changes"
                      icon={RotateCcwIcon}
                      // A save in flight settles against the text it sent.
                      disabled={Boolean(busy)}
                      onClick={() => show(doc)}
                    />
                  )}
                  {permissions.edit && (
                    <IconButton
                      label={busy === 'save' ? 'Saving…' : 'Save'}
                      icon={busy === 'save' ? SavingIcon : SaveIcon}
                      variant="default"
                      disabled={!draft.dirty || !draft.exact || Boolean(busy)}
                      onClick={() => save()}
                    />
                  )}
                  {permissions.admin && (
                    <IconButton
                      label="Delete"
                      icon={Trash2Icon}
                      lock={lock}
                      lockId={lockId}
                      className="hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        setRenameError(undefined);
                        setConfirming('delete');
                      }}
                    />
                  )}
                </div>
              </header>
              <div className={cn('flex min-h-0 flex-1', viewing && 'hidden')}>
                <MarkdownEditor
                  key={generation}
                  source={doc.content}
                  toolbar
                  // A delete, rename or restore replaces the document, so typing
                  // during one would be lost; typing during a save is kept.
                  editable={permissions.edit && (!busy || busy === 'save')}
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
                        onClick={() =>
                          restore(viewing.revision.path, viewing.content)
                        }
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
              {conflict && allowed(conflict.action) && (
                <ConflictDialog
                  // Overwriting a save writes the draft as it is now.
                  conflict={
                    conflict.action === 'save'
                      ? { ...conflict, mine: draft.markdown }
                      : conflict
                  }
                  // `save` writes only a changed draft that serializes exactly.
                  blocked={
                    conflict.action === 'save' && !(draft.dirty && draft.exact)
                      ? 'Your changes can no longer be saved as they are.'
                      : undefined
                  }
                  onReload={() => show(conflict.current)}
                  onOverwrite={() => overwrite(conflict)}
                  onCancel={() => setConflict(undefined)}
                />
              )}
              <Dialog
                open={confirming === 'delete' && permissions.admin}
                onOpenChange={(open) =>
                  !open && !busy && setConfirming(undefined)
                }
              >
                <DialogContent showCloseButton={false}>
                  <DialogHeader>
                    <DialogTitle>Delete {doc.name}?</DialogTitle>
                    <DialogDescription>
                      It leaves the list of policies. Its content and history
                      stay in the archive.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" disabled={Boolean(busy)}>
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button
                      variant="destructive"
                      disabled={Boolean(busy)}
                      onClick={() => remove()}
                    >
                      {busy === 'delete' ? 'Deleting…' : 'Delete'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog
                open={confirming === 'rename' && permissions.admin}
                onOpenChange={(open) =>
                  !open && !busy && setConfirming(undefined)
                }
              >
                {confirming === 'rename' && permissions.admin && (
                  <RenameDialogContent
                    from={doc.name}
                    busy={busy === 'rename'}
                    error={renameError}
                    onRename={rename}
                    onEdit={() => setRenameError(undefined)}
                  />
                )}
              </Dialog>
            </>
          )}
          <Dialog
            open={pending !== undefined}
            onOpenChange={(open) => !open && setPending(undefined)}
          >
            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>Discard unsaved changes?</DialogTitle>
                <DialogDescription>
                  Your changes to {doc?.name} have not been saved. Opening{' '}
                  {pending} discards them.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Keep editing</Button>
                </DialogClose>
                <Button variant="destructive" onClick={() => open(pending)}>
                  Discard changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

const SavingIcon = ({ className }: { className?: string }) => (
  <LoaderCircleIcon className={cn('animate-spin', className)} />
);

/** A header action shown as an icon, named and titled by `label`. */
const IconButton = ({
  label,
  icon: Icon,
  lock,
  lockId,
  variant = 'ghost',
  className,
  disabled,
  ...props
}: Omit<ComponentProps<typeof Button>, 'children' | 'title'> & {
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Why the action is unavailable now, if it is. */
  lock?: string;
  /** The status element that announces `lock`. */
  lockId?: string;
}) => (
  <Button
    variant={variant}
    size="icon"
    aria-label={label}
    title={lock ?? label}
    aria-describedby={lock && lockId}
    disabled={disabled || Boolean(lock)}
    className={cn(
      'size-8 shrink-0 rounded',
      variant === 'ghost' && 'hover:bg-primary/5 hover:text-foreground',
      className,
    )}
    {...props}
  >
    <Icon />
  </Button>
);

/** Shows how a refused change differs from the stored policy, offering a reload or an overwrite. */
const ConflictDialog = ({
  conflict: { action, current, mine },
  blocked,
  onReload,
  onOverwrite,
  onCancel,
}: {
  conflict: Conflict;
  /** Why the overwrite is unavailable, if it is. */
  blocked?: string;
  onReload: () => void;
  onOverwrite: () => void;
  onCancel: () => void;
}) => {
  const [mineLabel, offer, act] = CONFLICT_TEXT[action];
  const reason = useId();
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>This policy changed after you opened it</DialogTitle>
          <DialogDescription>
            Reload to open the saved version
            {action === 'save' && ', discarding your changes'}, or {offer}.
          </DialogDescription>
        </DialogHeader>
        <DiffView
          oldText={current.content}
          newText={mine}
          oldLabel="Saved version"
          newLabel={mineLabel}
          className="max-h-[50vh]"
        />
        {blocked && (
          <p id={reason} className="text-sm text-destructive">
            {blocked}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onReload}>
            Reload
          </Button>
          <Button
            variant="destructive"
            disabled={Boolean(blocked)}
            aria-describedby={blocked && reason}
            onClick={onOverwrite}
          >
            {act}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Asks for a new name, checked against the server's rule before `onRename`. */
const RenameDialogContent = ({
  from,
  busy,
  error,
  onRename,
  onEdit,
}: {
  from: string;
  busy: boolean;
  /** Why the server refused the last name tried. */
  error?: string;
  onRename: (to: string) => void;
  onEdit: () => void;
}) => {
  const [invalid, setInvalid] = useState<string>();
  const inputId = useId();
  const message = invalid ?? error;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const to = String(new FormData(event.currentTarget).get('name')).trim();
    const reason = !POLICY_NAME.test(to)
      ? 'Use folder/name: letters, digits, dots, dashes and underscores, each part starting with a letter or digit.'
      : to === from
        ? 'Choose a different name.'
        : undefined;
    setInvalid(reason);
    if (!reason) {
      onRename(to);
    }
  };

  return (
    <DialogContent showCloseButton={false}>
      <form onSubmit={submit} className="grid gap-4">
        <DialogHeader>
          <DialogTitle>Rename {from}</DialogTitle>
          <DialogDescription>
            The history stays under the old name.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={inputId}>New name</Label>
          <Input
            id={inputId}
            name="name"
            // Input keeps its own state, starting from `value`.
            value={from}
            autoComplete="off"
            aria-invalid={Boolean(message)}
            aria-describedby={message && `${inputId}-error`}
            onInput={() => {
              setInvalid(undefined);
              onEdit();
            }}
          />
          {message && (
            <p
              id={`${inputId}-error`}
              role="alert"
              className="text-sm text-destructive"
            >
              {message}
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={busy}>
            {busy ? 'Renaming…' : 'Rename'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};
