'use client';

import type { XmlFragment } from 'yjs';
import { Content, EditorContent } from '@tiptap/react';
import { useBlockEditor } from '../BlockEditor';
import { useEndNotesExtensions } from './hooks/useEndNotesExtensions';
import { EndNotesBubbleMenu } from './menu/EndNotesBubbleMenu';
import { GlossaryTermInstance } from '@data-access';
import { cn } from '@lib-utils';

export const EndNotesEditor = ({
  content,
  fragment,
  className,
  fetchGlossaryTerm,
  isEditable = true,
}: {
  content: Content;
  fragment?: XmlFragment;
  isEditable?: boolean;
  className?: string;
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
    <div className={cn('flex h-full', className)}>
      <div className="relative flex flex-col flex-1 h-full">
        <EditorContent className="flex-1" editor={editor} />
        <EndNotesBubbleMenu editor={editor} />
      </div>
    </div>
  );
};
