'use client';

import { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  ScrollArea,
  Separator,
  ScrollBar,
} from '@eightyfourthousand/design-system';
import { useRef } from 'react';
import { CommentSelector } from './selectors/CommentSelector';
import { ForeignSelector } from './selectors/ForeignSelector';
import { GlossarySelector } from './selectors/GlossarySelector';
import { LinkSelector } from './selectors/LinkSelector';
import { MentionSelector } from './selectors/MentionSelector';
import { InlineMarkButtons } from './selectors/TranslationTextButtons';
import { useDismissBubbleMenu } from './useDismissBubbleMenu';

/** The formatting a bibliography entry takes: inline marks, and comments. */
export const BibliographyBubbleMenu = ({
  editor,
}: {
  editor: Editor | null;
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  useDismissBubbleMenu(editor, menuRef);

  if (!editor) {
    return null;
  }

  return (
    <BubbleMenu
      ref={menuRef}
      editor={editor}
      appendTo={() => document.body}
      options={{
        placement: 'top',
        offset: 6,
      }}
      shouldShow={({ editor, state }) =>
        editor.isEditable && !state.selection.empty
      }
    >
      <ScrollArea className="max-w-[90vw] rounded-md border bg-popover shadow-xl z-50">
        <div className="flex">
          <InlineMarkButtons editor={editor} />
          <ForeignSelector editor={editor} />
          <Separator orientation="vertical" className="h-10" />
          <GlossarySelector editor={editor} />
          <MentionSelector editor={editor} />
          <LinkSelector editor={editor} />
          <CommentSelector editor={editor} entityType="bibliography" />
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </BubbleMenu>
  );
};
