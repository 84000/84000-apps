import StarterKit from '@tiptap/starter-kit';
import { Document } from '../extensions/Document';
import Heading from '../extensions/Heading/Heading';
import Paragraph from '../extensions/Paragraph/Paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import TranslationTitle from '../extensions/TranslationTitle/TranslationTitle';
import Translation from '../extensions/Translation/Translation';
import TranslationHeader from '../extensions/TranslationHeader/TranslationHeader';
import { SlashCommand } from '../extensions/SlashCommand/SlashCommand';
import { getSuggestion } from '../extensions/SlashCommand/Suggestions';
import { cn } from '@lib-utils';

export const useExtensions = () => {
  return {
    extensions: [
      Document,
      Heading,
      Paragraph,
      Placeholder.configure({
        placeholder: 'Type / for commands...',
        emptyEditorClass: cn('is-editor-empty text-gray-400'),
        emptyNodeClass: cn('is-empty text-gray-400'),
      }),
      SlashCommand.configure({
        suggestion: getSuggestion(),
      }),
      StarterKit.configure({
        document: false,
        heading: false,
        paragraph: false,
      }),
      Translation,
      TranslationHeader,
      TranslationTitle,
    ],
  };
};
