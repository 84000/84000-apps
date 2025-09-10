import { cn } from '@lib-utils';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { Button, Separator } from '@design-system';
import {
  BoldIcon,
  CaseUpperIcon,
  ItalicIcon,
  SubscriptIcon,
  SuperscriptIcon,
  UnderlineIcon,
} from 'lucide-react';
import { GlossarySelector } from '../../../TranslationEditor/menu/selectors/GlossarySelector';
import { LinkSelector } from '../../../TranslationEditor/menu/selectors/LinkSelector';

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
    onClick: (editor: Editor) => {
      editor.chain().focus().toggleBold().run();
    },
    isActive: (state: SelectorResult) => state.isBold,
  },
  {
    icon: ItalicIcon,
    onClick: (editor: Editor) => {
      editor.chain().focus().toggleItalic().run();
    },
    isActive: (state: SelectorResult) => state.isItalic,
  },
  {
    icon: UnderlineIcon,
    onClick: (editor: Editor) => {
      editor.chain().focus().toggleUnderline().run();
    },
    isActive: (state: SelectorResult) => state.isUnderline,
  },
  {
    icon: SubscriptIcon,
    onClick: (editor: Editor) => {
      editor.chain().focus().toggleSubscript().run();
    },
    isActive: (state: SelectorResult) => state.isSubscript,
  },
  {
    icon: SuperscriptIcon,
    onClick: (editor: Editor) => {
      editor.chain().focus().toggleSuperscript().run();
    },
    isActive: (state: SelectorResult) => state.isSuperscript,
  },
  {
    icon: CaseUpperIcon,
    onClick: (editor: Editor) => {
      editor.chain().focus().toggleSmallCaps().run();
    },
    isActive: (state: SelectorResult) => state.isSmallCaps,
  },
];

export const TextButtons = ({ editor }: { editor: Editor }) => {
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
              item.onClick(editor);
            }}
          >
            <item.icon
              className={cn('size-4', {
                'text-primary': item.isActive(editorState),
              })}
              strokeWidth={2.5}
            />
          </Button>
        );
      })}
      <Separator orientation="vertical" className="h-10" />
      <GlossarySelector editor={editor} />
      <LinkSelector editor={editor} />
    </>
  );
};
