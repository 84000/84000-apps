import { Passage } from '@data-access';
import {
  useBlockEditor,
  useTranslationExtensions,
  TranslationEditorContent,
} from '@lib-editing';
import { EditorContent } from '@tiptap/react';
import { TranslationBubbleMenu } from 'libs/lib-editing/src/lib/components/editor/menus';

export const SandboxTranslationEditor = ({
  content,
  fetchEndNote,
}: {
  content: TranslationEditorContent;
  fetchEndNote: (uuid: string) => Promise<Passage>;
}) => {
  const { extensions } = useTranslationExtensions({
    fetchEndNote,
  });

  const { editor } = useBlockEditor({
    extensions,
    content,
  });
  return (
    <div className="flex h-full">
      <div className="relative flex flex-col flex-1 h-full">
        <EditorContent className="flex-1" editor={editor} />
        {/* <TranslationBubbleMenu editor={editor} /> */}
      </div>
    </div>
  );
};
