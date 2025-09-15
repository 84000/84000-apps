'use client';

import type { XmlFragment } from 'yjs';
import { Content, EditorContent } from '@tiptap/react';
import { useBlockEditor } from '../BlockEditor';
import { useEndNotesExtensions } from './hooks/useEndNotesExtensions';
import { EndNotesBubbleMenu } from './menu/EndNotesBubbleMenu';
import { GlossaryTermInstance } from '@data-access';

export const EndNotesEditor = ({
  content,
  fragment,
  fetchGlossaryTerm,
  isEditable = true,
}: {
  content: Content;
  fragment?: XmlFragment;
  isEditable?: boolean;
  fetchGlossaryTerm?: (
    uuid: string,
  ) => Promise<GlossaryTermInstance | undefined>;
}) => {
  const { extensions } = useEndNotesExtensions({ fragment, fetchGlossaryTerm });
  const { editor } = useBlockEditor({
    extensions,
    content,
    isEditable,
  });

  return (
    <div className="flex flex-col w-full xl:px-32 lg:px-16 md:px-8 px-4 py-(--header-height)">
      <div className="relative flex flex-col flex-1 h-full">
        <EditorContent className="flex-1" editor={editor} />
        <EndNotesBubbleMenu editor={editor} />
      </div>
    </div>
  );
};
