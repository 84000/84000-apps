'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  countBibliographyReferences,
  createBrowserClient,
  type PanelContentType,
  urlForPanelContent,
} from '@eightyfourthousand/data-access';
import { rowKindOf, type PassageMeta } from '@eightyfourthousand/lib-doc-model';
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@eightyfourthousand/design-system';
import {
  CopyIcon,
  FolderInputIcon,
  Heading1Icon,
  Heading2Icon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
  ListPlusIcon,
  Trash2Icon,
} from 'lucide-react';

import type { PassageStackController } from './PassageStackController';
import type { StackPassageMenuTarget } from './StackPassageMenu';

/** A row as a menu names it: its label, and its text where it is held. */
const rowName = (controller: PassageStackController, meta: PassageMeta) =>
  [meta.label, controller.getRowText(meta.uuid)].filter(Boolean).join(' ');

/**
 * A bibliography row's label menu: start, nest, move and delete rows.
 * Mounted once for the stack, as `StackPassageMenu` is for passages.
 */
export const BibliographyRowMenu = ({
  controller,
  target,
  onClose,
}: {
  controller: PassageStackController;
  target: StackPassageMenuTarget | null;
  onClose: () => void;
}) => {
  // Held apart from `target`, which opening the dialog clears.
  const [deleting, setDeleting] = useState<PassageMeta | null>(null);
  // Keyed by row, so a count never shows against another row's dialog.
  const [counted, setCounted] = useState<{
    uuid: string;
    count: number | null;
  } | null>(null);
  const references =
    deleting && counted?.uuid === deleting.uuid ? counted.count : null;

  const meta = target ? controller.getMeta(target.uuid) : null;
  const uuid = meta?.uuid ?? '';
  const isHeading = !!meta && rowKindOf(meta.type) === 'heading';

  // The captured rect goes stale on scroll, so close rather than drift. A
  // scroll inside the menu, such as a long list of headings, is its own.
  useEffect(() => {
    if (!target) return;
    const onScroll = (event: Event) => {
      const scrolled = event.target;
      if (
        scrolled instanceof Element &&
        scrolled.closest('[data-radix-menu-content]')
      ) {
        return;
      }
      onClose();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [target, onClose]);

  // Counted when asked, as the warning is only worth a request then.
  useEffect(() => {
    if (!deleting) return;
    const { uuid } = deleting;
    let current = true;
    countBibliographyReferences({ client: createBrowserClient(), uuid }).then(
      (count) => {
        if (current) setCounted({ uuid, count });
      },
    );
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

  const contentType = meta?.type as PanelContentType | undefined;
  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(
      urlForPanelContent({
        location: window.location,
        hash: uuid,
        contentType,
      }),
    );
  }, [uuid, contentType]);

  const handleDelete = useCallback(() => {
    if (deleting) controller.removePassage(deleting.uuid);
    setDeleting(null);
  }, [controller, deleting]);

  const targets = meta ? controller.bibliographyMoveTargets(uuid) : [];
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
                onSelect={() => controller.newBibliographyEntry(uuid)}
              >
                <ListPlusIcon className="text-primary" /> New Entry
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => controller.newBibliographyHeading(uuid)}
              >
                <Heading1Icon className="text-primary" /> New Heading
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => controller.newBibliographyHeading(uuid, true)}
              >
                <Heading2Icon className="text-primary" /> New Subheading
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isHeading && (
                <>
                  <DropdownMenuItem
                    disabled={!controller.canIndentBibliographyHeading(uuid)}
                    onSelect={() => controller.indentBibliographyHeading(uuid)}
                  >
                    <IndentIncreaseIcon className="text-primary" /> Indent
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!controller.canOutdentBibliographyHeading(uuid)}
                    onSelect={() => controller.outdentBibliographyHeading(uuid)}
                  >
                    <IndentDecreaseIcon className="text-primary" /> Outdent
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  disabled={!targets.length && !(isHeading && meta.parent)}
                >
                  <FolderInputIcon className="text-primary" /> Move Under
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-80 w-72 overflow-y-auto">
                  {isHeading && meta.parent && (
                    <DropdownMenuItem
                      onSelect={() =>
                        controller.moveBibliographyRow(uuid, null)
                      }
                    >
                      Top level
                    </DropdownMenuItem>
                  )}
                  {targets.map((heading) => (
                    <DropdownMenuItem
                      key={heading.uuid}
                      disabled={heading.uuid === meta.parent}
                      onSelect={() =>
                        controller.moveBibliographyRow(uuid, heading.uuid)
                      }
                      style={{
                        paddingInlineStart: `${0.5 + (heading.depth ?? 0)}rem`,
                      }}
                    >
                      <span className="truncate">
                        {rowName(controller, heading)}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!controller.canRemove(uuid)}
                onSelect={() => {
                  setDeleting(meta);
                  onClose();
                }}
                className="text-destructive"
              >
                <Trash2Icon className="text-destructive" />
                {controller.canRemove(uuid)
                  ? 'Delete'
                  : 'Delete (empty it first)'}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        {deleting && (
          <DialogContent
            className="max-w-readable w-full font-serif"
            showCloseButton={false}
          >
            <DialogHeader>
              <DialogTitle>
                Delete{' '}
                {rowKindOf(deleting.type) === 'heading' ? 'Heading' : 'Entry'}
              </DialogTitle>
              <DialogDescription>
                This will delete {deleting.label}. It can be undone until you
                save.
                {!!references &&
                  ` It is mentioned ${references === 1 ? 'once' : `${references} times`} in the translation, and those mentions will no longer resolve.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
};
