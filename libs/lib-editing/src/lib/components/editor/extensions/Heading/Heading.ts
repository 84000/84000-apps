import TiptapHeading from '@tiptap/extension-heading';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { HeadingView } from './HeadingView';

export const Heading = TiptapHeading.extend({
  addNodeView() {
    return ReactNodeViewRenderer(HeadingView);
  },
});

export default Heading;
