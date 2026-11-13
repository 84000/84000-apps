'use client';

import { useSyncExternalStore } from 'react';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@eightyfourthousand/design-system';

import { GlossaryEntryPanelBody } from './GlossaryEntryPanelBody';
import type { StackController } from './StackController';
import {
  glossaryEntryPanelOf,
  useGlossaryEntryPanel,
} from './glossary-entry-panel';
import { englishNameOf } from './glossary-row';

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
        onEscapeKeyDown={(event) => {
          // Radix hears Escape before the name form and the authority
          // search do; there it steps back, not out of the dialog.
          if (
            event.target instanceof Element &&
            event.target.closest(
              '[data-glossary-name-form], [data-glossary-entry-searching]',
            )
          ) {
            event.preventDefault();
          }
        }}
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
        <DialogFooter>
          <DialogClose asChild>
            <Button>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
