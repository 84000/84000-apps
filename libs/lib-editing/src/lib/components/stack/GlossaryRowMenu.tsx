'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createBrowserClient,
  getGlossaryTermExcerpts,
  MAX_GLOSSARY_EXCERPTS_LIMIT,
  urlForPanelContent,
  type GlossaryExcerptsPage,
} from '@eightyfourthousand/data-access';
import type { PassageMeta } from '@eightyfourthousand/lib-doc-model';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@eightyfourthousand/design-system';
import { CopyIcon, Trash2Icon } from 'lucide-react';

import type { StackController } from './StackController';
import type { StackPassageMenuTarget } from './StackPassageMenu';
import { englishNameOf } from './glossary-row';
import { useStackWork } from './stack-work-context';

const plural = (count: number, one: string, many: string) =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`;

/** The passages an entry's instances are in, as read for the dialog. */
type Instances =
  | { uuid: string; status: 'loading' }
  | { uuid: string; status: 'error' }
  | { uuid: string; status: 'read'; page: GlossaryExcerptsPage };

/**
 * A glossary row's label menu: copy a link to the row, and delete its entry.
 * Mounted once for the stack, as `StackPassageMenu` is for passages.
 */
export const GlossaryRowMenu = ({
  controller,
  target,
  onClose,
}: {
  controller: StackController;
  target: StackPassageMenuTarget | null;
  onClose: () => void;
}) => {
  // Held apart from `target`, which opening the dialog clears.
  const [deleting, setDeleting] = useState<PassageMeta | null>(null);
  // Keyed by row, so a list never shows against another row's dialog.
  const [read, setRead] = useState<Instances | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stack = useStackWork();

  const meta = target ? controller.getMeta(target.uuid) : null;
  const uuid = meta?.uuid ?? '';
  const instances = deleting && read?.uuid === deleting.uuid ? read : null;
  const name =
    deleting &&
    (() => {
      const entry = controller.getGlossaryEntry(deleting.uuid);
      return entry ? englishNameOf(entry)?.content : undefined;
    })();

  // The captured rect goes stale on scroll, so close rather than drift.
  useEffect(() => {
    if (!target) return;
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [target, onClose]);

  // Read when asked, as the list is only worth a request then.
  useEffect(() => {
    if (!deleting) return;
    const { uuid } = deleting;
    let current = true;
    setRead({ uuid, status: 'loading' });
    getGlossaryTermExcerpts({
      client: createBrowserClient(),
      uuid,
      first: MAX_GLOSSARY_EXCERPTS_LIMIT,
      source: 'draft',
    }).then((page) => {
      if (!current) return;
      setRead(
        page ? { uuid, status: 'read', page } : { uuid, status: 'error' },
      );
    });
    return () => {
      current = false;
    };
  }, [deleting]);

  const onMenuOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onClose();
    },
    [onClose],
  );

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(
      urlForPanelContent({
        location: window.location,
        hash: uuid,
        contentType: 'glossary',
      }),
    );
  }, [uuid]);

  const close = useCallback(() => {
    if (pending) return;
    setDeleting(null);
    setError(null);
  }, [pending]);

  const handleDelete = useCallback(async () => {
    if (!deleting) return;
    setPending(true);
    setError(null);
    const result = await controller.deleteGlossaryEntry(deleting.uuid, {
      client: createBrowserClient(),
      passages: stack ? [stack.work] : [],
    });
    setPending(false);
    if (result.deleted) {
      setDeleting(null);
    } else {
      setError(result.error);
    }
  }, [controller, deleting, stack]);

  const rect = target?.rect;

  return (
    <>
      <DropdownMenu
        modal={false}
        open={!!target}
        onOpenChange={onMenuOpenChange}
      >
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden
            style={{
              position: 'fixed',
              left: rect?.left ?? 0,
              top: rect?.top ?? 0,
              width: rect?.width ?? 0,
              height: rect?.height ?? 0,
              pointerEvents: 'none',
            }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          alignOffset={48}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="w-64"
        >
          {meta && (
            <>
              <DropdownMenuItem onSelect={copyLink}>
                <CopyIcon className="text-primary" /> Copy Link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  setDeleting(meta);
                  onClose();
                }}
                className="text-destructive"
              >
                <Trash2Icon className="text-destructive" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && close()}>
        {deleting && (
          <DialogContent
            className="max-w-readable w-full font-serif"
            showCloseButton={false}
          >
            <DialogHeader>
              <DialogTitle>
                Delete {deleting.label}
                {name ? ` ${name}` : ''}
              </DialogTitle>
              <DialogDescription>
                This deletes the entry and every instance of it in this work,
                straight away. It cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <GlossaryDeleteInstances instances={instances} />
            {error && (
              <p role="alert" className="text-destructive text-sm">
                The entry was not deleted: {error}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" disabled={pending} onClick={close}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={handleDelete}
              >
                {pending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
};

/** The passages a delete takes the entry's instances out of. */
const GlossaryDeleteInstances = ({
  instances,
}: {
  instances: Instances | null;
}) => {
  if (!instances || instances.status === 'loading') {
    return (
      <p className="text-muted-foreground text-sm">
        Finding the passages with instances…
      </p>
    );
  }
  if (instances.status === 'error') {
    return (
      <p className="text-muted-foreground text-sm">
        The passages with instances could not be read.
      </p>
    );
  }
  const { items, totalCount } = instances.page;
  if (!totalCount) {
    return (
      <p className="text-muted-foreground text-sm">
        No passage has an instance of it.
      </p>
    );
  }
  const more = totalCount - items.length;
  return (
    <div className="flex flex-col gap-2" data-glossary-delete-instances="">
      <p className="text-sm">
        It has instances in {plural(totalCount, 'passage', 'passages')}:
      </p>
      <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-md border p-2">
        {items.map((item) => (
          <li key={item.uuid} className="text-sm">
            <span className="flex items-baseline gap-2 text-xs">
              <span className="text-primary font-sans font-bold">
                {item.label || item.uuid.slice(0, 6)}
              </span>
              <span className="text-muted-foreground">
                {plural(item.instanceCount, 'instance', 'instances')}
              </span>
            </span>
            <span className="block leading-relaxed">
              {item.excerpt.truncatedStart && '…'}
              {item.excerpt.text}
              {item.excerpt.truncatedEnd && '…'}
            </span>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <p className="text-muted-foreground text-sm">
          and {plural(more, 'more passage', 'more passages')}.
        </p>
      )}
    </div>
  );
};
