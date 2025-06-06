import { cn } from '@lib-utils';
import Placeholder from '@tiptap/extension-placeholder';

export default Placeholder.configure({
  placeholder: 'Type / for commands...',
  emptyEditorClass: cn('is-editor-empty text-gray-400'),
  emptyNodeClass: cn('is-empty text-gray-400'),
  includeChildren: true,
});
