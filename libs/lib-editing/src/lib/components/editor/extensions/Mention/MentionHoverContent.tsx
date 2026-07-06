import { Button } from '@eightyfourthousand/design-system';
import { Editor } from '@tiptap/core';
import { ChevronRightIcon, Trash2Icon, TypeIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { HoverInputField } from '../HoverInputField';
import type { MentionItem } from './Mention.ssr';

type Mode = 'view' | 'rename';

/**
 * Find a mention node in the document that contains an item with the given UUID.
 */
function findMentionNodeByItemUuid(
  editor: Editor,
  itemUuid: string,
):
  | { pos: number; node: ReturnType<Editor['state']['doc']['nodeAt']> }
  | undefined {
  const { doc } = editor.state;
  let result: { pos: number; node: ReturnType<typeof doc.nodeAt> } | undefined;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (node.type.name === 'mention') {
      const items: MentionItem[] = node.attrs.items || [];
      if (items.some((item) => item.uuid === itemUuid)) {
        result = { pos, node };
        return false;
      }
    }
    return true;
  });

  return result;
}

/**
 * Locate the mention node containing the item and apply an edit to it. The
 * node is re-found by uuid at dispatch time, so positions are always fresh —
 * no need to defer past the hover card closing.
 */
function withMentionNode(
  editor: Editor,
  itemUuid: string,
  fn: (
    pos: number,
    node: NonNullable<ReturnType<Editor['state']['doc']['nodeAt']>>,
  ) => void,
) {
  if (editor.isDestroyed) {
    return;
  }

  const found = findMentionNodeByItemUuid(editor, itemUuid);
  if (!found?.node) {
    console.warn('Mention node not found in the document.');
    return;
  }

  fn(found.pos, found.node);
}

/**
 * Hover card for an existing mention. Editing is intentionally limited to two
 * actions: overriding the display text (the persisted `text` property) and
 * deleting. Re-pointing a mention at a different entity is not supported —
 * delete and re-insert instead.
 */
export const MentionHoverContent = ({
  uuid,
  entityType,
  entity,
  editor,
  close,
  setHoverCardEditing,
}: {
  uuid: string;
  entityType: string;
  entity: string;
  editor: Editor;
  anchor: HTMLElement;
  close: () => void;
  setHoverCardEditing: (isEditing: boolean) => void;
}) => {
  const [mode, setModeLocal] = useState<Mode>('view');

  // Snapshot the item once when the card opens — the custom override (`text`)
  // pre-fills the rename field, and text/displayText drive the label shown.
  const [item] = useState<MentionItem | undefined>(() => {
    const found = findMentionNodeByItemUuid(editor, uuid);
    const items: MentionItem[] = found?.node?.attrs.items || [];
    return items.find((i) => i.uuid === uuid);
  });
  const currentText = item?.text ?? '';
  // Prefer the display text; fall back to the entity UUID only when unresolved.
  const displayLabel = item?.text || item?.displayText || entity;

  const setMode = useCallback(
    (next: Mode) => {
      setModeLocal(next);
      setHoverCardEditing(next !== 'view');
    },
    [setHoverCardEditing],
  );

  const mutateItem = useCallback(
    (updater: (item: MentionItem) => MentionItem) => {
      setMode('view');
      close();

      withMentionNode(editor, uuid, (pos, node) => {
        const items: MentionItem[] = (node.attrs.items || []).map(
          (item: MentionItem) => (item.uuid === uuid ? updater(item) : item),
        );

        const { tr } = editor.state;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, items });
        editor.view.dispatch(tr);
      });
    },
    [editor, uuid, close, setMode],
  );

  const deleteMention = useCallback(() => {
    setMode('view');
    close();

    withMentionNode(editor, uuid, (pos, node) => {
      const items: MentionItem[] = (node.attrs.items || []).filter(
        (item: MentionItem) => item.uuid !== uuid,
      );

      const { tr } = editor.state;
      if (items.length === 0) {
        // Delete the entire node
        tr.delete(pos, pos + node.nodeSize);
      } else {
        // Update items array without deleted item
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, items });
      }
      editor.view.dispatch(tr);
    });
  }, [editor, uuid, close, setMode]);

  // Set or clear the custom override label. Passing no value clears `text`,
  // returning the mention to its dynamically resolved label.
  const renameMention = useCallback(
    (value?: string) => {
      mutateItem((item) => ({ ...item, text: value || undefined }));
    },
    [mutateItem],
  );

  if (mode === 'rename') {
    return (
      <div className="flex justify-between gap-2 p-2 w-fit max-w-80">
        <HoverInputField
          type="mention"
          attr="text"
          valueRef={currentText}
          placeholder="Custom label (leave empty to reset)…"
          onSubmit={(value) => renameMention(value)}
        />
      </div>
    );
  }

  return (
    <div className="flex justify-between gap-2 p-2 w-fit max-w-80">
      <span className="text-primary text-sm my-auto">{entityType}</span>
      <ChevronRightIcon className="my-auto size-4" />
      <span className="truncate text-muted-foreground text-sm my-auto">
        {displayLabel}
      </span>
      <span className="flex-grow" />
      <Button
        variant="ghost"
        size="icon"
        className="size-6 [&_svg]:size-4"
        title="Edit display text"
        onClick={() => setMode('rename')}
      >
        <TypeIcon className="text-primary my-auto" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 [&_svg]:size-4"
        title="Remove mention"
        onClick={deleteMention}
      >
        <Trash2Icon className="text-destructive my-auto" />
      </Button>
    </div>
  );
};
