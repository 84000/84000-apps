import { Button } from '@eightyfourthousand/design-system';
import { Editor } from '@tiptap/core';
import {
  ChevronRightIcon,
  PencilIcon,
  Trash2Icon,
  TypeIcon,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { HoverInputField } from '../HoverInputField';
import { MentionSearch } from './MentionSearch';
import type { MentionItem } from './Mention.ssr';

const EDITOR_UPDATE_DELAY_MS = 100;

type Mode = 'view' | 'pick' | 'rename';

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

  // The current custom override (`text`), read once when the card opens so the
  // rename field can be pre-filled.
  const [currentText] = useState(() => {
    const found = findMentionNodeByItemUuid(editor, uuid);
    const items: MentionItem[] = found?.node?.attrs.items || [];
    return items.find((item) => item.uuid === uuid)?.text ?? '';
  });

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

      setTimeout(() => {
        const found = findMentionNodeByItemUuid(editor, uuid);
        if (!found || !found.node) {
          console.warn('Mention node not found in the document.');
          return;
        }

        const { pos, node } = found;
        const items: MentionItem[] = (node.attrs.items || []).map(
          (item: MentionItem) => (item.uuid === uuid ? updater(item) : item),
        );

        const { tr } = editor.state;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, items });
        editor.view.dispatch(tr);
      }, EDITOR_UPDATE_DELAY_MS);
    },
    [editor, uuid, close, setMode],
  );

  const deleteMention = useCallback(() => {
    setMode('view');
    close();

    setTimeout(() => {
      const found = findMentionNodeByItemUuid(editor, uuid);
      if (!found || !found.node) {
        console.warn('Mention node not found in the document.');
        return;
      }

      const { pos, node } = found;
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
    }, EDITOR_UPDATE_DELAY_MS);
  }, [editor, uuid, close, setMode]);

  // Re-point the mention at a different entity. Clears the persisted custom
  // override (`text`) and seeds the transient `displayText` with the picker
  // label for immediate display; the canonical label resolves on load.
  const updateMention = useCallback(
    (newType: string, newEntity: string, displayText?: string) => {
      mutateItem((item) => ({
        ...item,
        entity: newEntity,
        linkType: newType,
        text: undefined,
        displayText,
      }));
    },
    [mutateItem],
  );

  // Set or clear the custom override label. Passing no value clears `text`,
  // returning the mention to its dynamically resolved label.
  const renameMention = useCallback(
    (value?: string) => {
      mutateItem((item) => ({ ...item, text: value || undefined }));
    },
    [mutateItem],
  );

  if (mode === 'pick') {
    return (
      <div className="flex justify-between gap-2 p-2 w-fit max-w-80">
        <MentionSearch
          onSelect={({ entity: newEntity, linkType, label }) => {
            updateMention(linkType, newEntity, label);
          }}
        />
      </div>
    );
  }

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
        {entity}
      </span>
      <span className="flex-grow" />
      <Button
        variant="ghost"
        size="icon"
        className="size-6 [&_svg]:size-4"
        title="Set custom label"
        onClick={() => setMode('rename')}
      >
        <TypeIcon className="text-primary my-auto" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 [&_svg]:size-4"
        title="Change reference"
        onClick={() => setMode('pick')}
      >
        <PencilIcon className="text-primary my-auto" />
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
