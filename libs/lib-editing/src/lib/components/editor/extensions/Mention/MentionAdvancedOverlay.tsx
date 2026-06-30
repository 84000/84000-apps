'use client';

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@eightyfourthousand/design-system';
import { MentionSearch } from './MentionSearch';
import type { MentionAdvancedPayload } from './Mention';

const EDITOR_UPDATE_DELAY_MS = 50;

/**
 * A single, stable React layer (mounted as a sibling of EditorContent) that
 * hosts the advanced mention picker. The inline `@` dropdown cannot host a
 * focusable work/toh field — focusing it closes the suggestion — so its
 * "Advanced" button hands off to this dialog, which owns its own focus and is
 * free to search any work. It inserts the chosen mention back at the position
 * the `@` trigger occupied.
 */
export const MentionAdvancedOverlay = ({ editor }: { editor: Editor }) => {
  const [payload, setPayload] = useState<MentionAdvancedPayload | null>(null);

  // Register the openAdvanced callback the suggestion list calls.
  useEffect(() => {
    const storage = editor.storage.mention;
    storage.openAdvanced = (next) => setPayload(next);
    return () => {
      storage.openAdvanced = undefined;
    };
  }, [editor]);

  const close = () => setPayload(null);

  return (
    <Dialog open={!!payload} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Insert mention</DialogTitle>
          <DialogDescription>
            Search any work for a passage, folio, glossary term, bibliography
            entry, or another work.
          </DialogDescription>
        </DialogHeader>
        {payload && (
          <MentionSearch
            initialQuery={payload.query}
            onSelect={({ entity, linkType, label, isSameWork }) => {
              const { pos } = payload;
              close();
              setTimeout(() => {
                editor
                  .chain()
                  .focus()
                  .setTextSelection(pos)
                  .setMention(entity, linkType, label, isSameWork)
                  .run();
              }, EDITOR_UPDATE_DELAY_MS);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
