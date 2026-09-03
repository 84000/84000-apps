'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PanelContentType } from '@eightyfourthousand/data-access';
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
  DropdownMenuTrigger,
} from '@eightyfourthousand/design-system';

import { EditLabel } from '../editor/extensions/Passage/EditLabel';
import { EditorOptions } from '../editor/extensions/Passage/EditorOptions';
import { ShowAnnotations } from '../editor/extensions/Passage/ShowAnnotations';
import type { PassageStackController } from './PassageStackController';

/** The label that was clicked, and where it was when it was. */
export type StackPassageMenuTarget = {
  uuid: string;
  rect: { top: number; left: number; width: number; height: number };
};

/**
 * The passage label menu, mounted once for the whole stack.
 *
 * `PassageMenuOverlay` is driven from a ProseMirror click plugin, because
 * production's label is DOM inside the document. Here the label is React in
 * `StackRow`, so the trigger is an ordinary click and none of that plumbing —
 * `editor.storage.passage.openMenu`, the click plugin, `findPassageNode` —
 * has anything to do. The actions go to the work and the spine for the same
 * reason: a label and a passage's existence are spine facts now, not node
 * attributes.
 *
 * Editor options only. Bookmarks and Suggest Revision belong to the reader,
 * which still runs on `TranslationEditor`.
 */
export const StackPassageMenu = ({
  controller,
  target,
  onClose,
}: {
  controller: PassageStackController;
  target: StackPassageMenuTarget | null;
  onClose: () => void;
}) => {
  const [dialogType, setDialogType] = useState<string>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // The passage the dialogs act on, held apart from `target` because choosing
  // a dialog closes the dropdown, and closing it clears the target.
  const [subject, setSubject] = useState<PassageMeta | null>(null);

  const meta = target ? controller.getMeta(target.uuid) : null;

  // The menu is anchored to a fixed-position trigger placed over the clicked
  // label; a captured rect goes stale on scroll, so close instead of drift.
  useEffect(() => {
    if (!target) return;
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [target, onClose]);

  const onMenuOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onClose();
    },
    [onClose],
  );

  const handleDelete = useCallback(() => {
    if (subject) controller.removePassage(subject.uuid);
    setIsDialogOpen(false);
  }, [controller, subject]);

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
            <EditorOptions
              uuid={meta.uuid}
              contentType={meta.type as PanelContentType}
              onSelection={(item) => {
                setSubject(meta);
                setDialogType(item);
                setIsDialogOpen(true);
                onClose();
              }}
            />
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {subject && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {dialogType === 'label' && (
            <EditLabel
              label={subject.label}
              onSave={(label) => controller.setLabel(subject.uuid, label)}
              close={() => setIsDialogOpen(false)}
            />
          )}
          {dialogType === 'attributes' && (
            <ShowAnnotations
              uuid={subject.uuid}
              label={subject.label}
              type={subject.type}
              json={controller.getPassageJSON(subject.uuid)}
            />
          )}
          {dialogType === 'delete' && (
            <DialogContent
              className="max-w-readable w-full font-serif"
              showCloseButton={false}
            >
              <DialogHeader>
                <DialogTitle>Delete Passage</DialogTitle>
                <DialogDescription>
                  This will delete passage {subject.label}
                  {subject.type === 'endnotes' &&
                    ' and remove all links to it in the translation'}
                  . This action cannot be undone after saving.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      )}
    </>
  );
};
