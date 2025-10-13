import { cn } from '@lib-utils';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { Button } from '@design-system';
import {
  ArrowDownToLineIcon,
  ArrowUpToLineIcon,
  IndentIcon,
} from 'lucide-react';

interface SelectorResult {
  hasIndent: boolean;
  hasLeadingSpace: boolean;
  hasTrailer: boolean;
}

const items = [
  {
    icon: ArrowUpToLineIcon,
    onClick: (editor: Editor) => {
      editor.chain().focus().toggleLeadingSpace().run();
    },
    isActive: (state: { hasLeadingSpace: boolean }) => state.hasLeadingSpace,
  },
  {
    icon: ArrowDownToLineIcon,
    onClick: (editor: Editor) => {
      editor.chain().focus().toggleTrailer().run();
    },
    isActive: (state: { hasTrailer: boolean }) => state.hasTrailer,
  },
  {
    icon: IndentIcon,
    onClick: (editor: Editor) => {
      editor.chain().focus().toggleIndent().run();
    },
    isActive: (state: { hasIndent: boolean }) => state.hasIndent,
  },
];

export const ParagraphButtons = ({ editor }: { editor: Editor }) => {
  const editorState = useEditorState<SelectorResult>({
    editor,
    selector: (instance) => {
      const atts = {
        hasIndent: !!instance.editor.getAttributes('paragraph')['hasIndent'],
        hasLeadingSpace:
          !!instance.editor.getAttributes('paragraph')['hasLeadingSpace'],

        hasTrailer:
          !!instance.editor.getAttributes('paragraph')['hasTrailer'] ||
          !!instance.editor.getAttributes('lineGroup')['hasTrailer'] ||
          !!instance.editor.getAttributes('heading')['hasTrailer'],
      };
      return atts;
    },
  });

  return (
    <>
      {items.map((item, i) => {
        return (
          <Button
            key={i}
            variant="ghost"
            size="icon"
            className="rounded-none flex-shrink-0"
            onClick={() => {
              item.onClick(editor);
            }}
          >
            <item.icon
              className={cn(
                'size-4',
                item.isActive(editorState)
                  ? 'text-primary'
                  : 'text-muted-foreground',
              )}
              strokeWidth={2.5}
            />
          </Button>
        );
      })}
    </>
  );
};
