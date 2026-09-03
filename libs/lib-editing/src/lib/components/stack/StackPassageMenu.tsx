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

/** The clicked label, and where it was. */
export type StackPassageMenuTarget = {
  uuid: string;
  rect: { top: number; left: number; width: number; height: number };
};

/**
 * The passage label menu, mounted once for the whole stack.
 *
 * `PassageMenuOverlay`'s counterpart, acting on the work and the spine rather
 * than on an editor. Editor options only; the reader's still live there.
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
  // Held apart from `target`, which choosing a dialog clears.
  const [subject, setSubject] = useState<PassageMeta | null>(null);

  const meta = target ? controller.getMeta(target.uuid) : null;

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
