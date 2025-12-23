import { cn } from '@lib-utils';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  BoldIcon,
  CaseUpperIcon,
  ItalicIcon,
  SubscriptIcon,
  SuperscriptIcon,
  UnderlineIcon,
} from 'lucide-react';
import { Button, Separator } from '@design-system';
import { LinkSelector } from './LinkSelector';
import { MantraSelector } from './MantraSelector';
import { EndNoteSelector } from './EndNoteSelector';
import { GlossarySelector } from './GlossarySelector';

interface SelectorResult {
  isBold: boolean;
  isItalic: boolean;
  isSmallCaps: boolean;
  isSubscript: boolean;
  isSuperscript: boolean;
  isUnderline: boolean;
}

const items = [
  {
    icon: BoldIcon,
    onClick: (editor: Editor, state: SelectorResult) =>
      state.isBold
        ? editor.chain().focus().unsetBold().run()
        : editor.chain().focus().setBold().run(),
    isActive: (state: SelectorResult) => state.isBold,
  },
  {
    icon: ItalicIcon,
    onClick: (editor: Editor, state: SelectorResult) =>
      state.isItalic
        ? editor.chain().focus().unsetItalic().run()
        : editor.chain().focus().setItalic().run(),
    isActive: (state: SelectorResult) => state.isItalic,
  },
  {
    icon: UnderlineIcon,
    onClick: (editor: Editor, state: SelectorResult) =>
      state.isUnderline
        ? editor.chain().focus().unsetUnderline().run()
        : editor.chain().focus().setUnderline().run(),
    isActive: (state: SelectorResult) => state.isUnderline,
  },
  {
    icon: SubscriptIcon,
    onClick: (editor: Editor, state: SelectorResult) =>
      state.isSubscript
        ? editor.chain().focus().unsetSubscript().run()
        : editor.chain().focus().setSubscript().run(),
    isActive: (state: SelectorResult) => state.isSubscript,
  },
  {
    icon: SuperscriptIcon,
    onClick: (editor: Editor, state: SelectorResult) =>
      state.isSuperscript
        ? editor.chain().focus().unsetSuperscript().run()
        : editor.chain().focus().setSuperscript().run(),
    isActive: (state: SelectorResult) => state.isSuperscript,
  },
  {
    icon: CaseUpperIcon,
    onClick: (editor: Editor, state: SelectorResult) =>
      state.isSmallCaps
        ? editor.chain().focus().unsetSmallCaps().run()
        : editor.chain().focus().setSmallCaps().run(),
    isActive: (state: SelectorResult) => state.isSmallCaps,
  },
];

export const TranslationTextButtons = ({ editor }: { editor: Editor }) => {
  const editorState = useEditorState<SelectorResult>({
    editor,
    selector: (instance) => ({
      isBold: instance.editor.isActive('bold'),
      isItalic: instance.editor.isActive('italic'),
      isUnderline: instance.editor.isActive('underline'),
      isSmallCaps: instance.editor.isActive('smallCaps'),
      isSubscript: instance.editor.isActive('subscript'),
      isSuperscript: instance.editor.isActive('superscript'),
    }),
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
              item.onClick(editor, editorState);
            }}
          >
            <item.icon
              className={cn(
                'size-4',
                item.isActive(editorState)
                  ? 'text-foreground'
                  : 'text-muted-foreground',
              )}
              strokeWidth={2.5}
            />
          </Button>
        );
      })}
      <MantraSelector editor={editor} />
      <Separator orientation="vertical" className="h-10" />
      <GlossarySelector editor={editor} />
      <LinkSelector editor={editor} />
      <EndNoteSelector editor={editor} />
    </>
  );
};
