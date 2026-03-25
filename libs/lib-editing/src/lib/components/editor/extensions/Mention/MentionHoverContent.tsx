import { Button } from '@eightyfourthousand/design-system';
import { Editor } from '@tiptap/core';
import { ChevronRightIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { InternalLinkInput } from '../InternalLink/InternalLinkInput';
import { useHoverCard } from '../../../shared/HoverCardProvider';
import type { MentionItem } from './Mention';

const EDITOR_UPDATE_DELAY_MS = 100;

/**
 * Find a mention node in the document that contains an item with the given UUID.
 */
function findMentionNodeByItemUuid(
  editor: Editor,
  itemUuid: string,
): { pos: number; node: ReturnType<Editor['state']['doc']['nodeAt']> } | undefined {
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
}: {
  uuid: string;
  entityType: string;
  entity: string;
  editor: Editor;
  anchor: HTMLElement;
}) => {
  const [isEditing, setIsEditingLocal] = useState(false);
  const { close, setIsEditing: setIsEditingContext } = useHoverCard();

  const setIsEditing = useCallback(
    (editing: boolean) => {
      setIsEditingLocal(editing);
      setIsEditingContext(editing);
    },
    [setIsEditingContext],
  );

  const deleteMention = useCallback(() => {
    setIsEditing(false);
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
  }, [editor, uuid, close, setIsEditing]);

  const updateMention = useCallback(
    (newType: string, newEntity: string) => {
      setIsEditing(false);
      close();

      setTimeout(() => {
        const found = findMentionNodeByItemUuid(editor, uuid);
        if (!found || !found.node) {
          console.warn('Mention node not found in the document.');
          return;
        }

        const { pos, node } = found;
        const items: MentionItem[] = (node.attrs.items || []).map(
          (item: MentionItem) =>
            item.uuid === uuid
              ? { ...item, entity: newEntity, linkType: newType }
              : item,
        );

        const { tr } = editor.state;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, items });
        editor.view.dispatch(tr);
      }, EDITOR_UPDATE_DELAY_MS);
    },
    [editor, uuid, close, setIsEditing],
  );

  return (
    <div className="flex justify-between gap-2 p-2 w-fit max-w-80">
      {isEditing ? (
        <InternalLinkInput
          type={entityType}
          uuid={entity}
          onSubmit={(type, entityVal) => {
            if (type && entityVal) {
              updateMention(type, entityVal);
            } else {
              deleteMention();
            }
            setIsEditing(false);
          }}
        />
      ) : (
        <>
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
            onClick={() => setIsEditing(true)}
          >
            <PencilIcon className="text-primary my-auto" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 [&_svg]:size-4"
            onClick={deleteMention}
          >
            <Trash2Icon className="text-destructive my-auto" />
          </Button>
        </>
      )}
    </div>
  );
};
