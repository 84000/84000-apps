import type { Mark } from '@tiptap/pm/model';
import { v4 as uuidv4 } from 'uuid';
import { createMarkViewDom, registerEditorElement } from '../../util';
import { CommentMarkSSR, type CommentMarkSSROptions } from './CommentMark.ssr';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      /** Anchors a new mark on the selection to an existing thread root. */
      setComment: (args: { comment: string }) => ReturnType;
      /**
       * Removes every anchor pointing at `comment`, leaving the thread itself
       * alone — a thread outlives its anchors on purpose.
       */
      unsetComment: (args: { comment: string }) => ReturnType;
    };
  }
}

export const CommentMark = CommentMarkSSR.extend<CommentMarkSSROptions>({
  addMarkView() {
    return (props) => {
      const { dom } = createMarkViewDom({
        ...props,
        element: 'span',
        className: 'comment-mark',
      });

      const { comment, uuid, toh } = props.mark.attrs;

      if (toh) {
        dom.setAttribute('data-toh', toh);
      }
      if (comment) {
        dom.setAttribute('comment', comment);
      }
      if (uuid) {
        dom.setAttribute('uuid', uuid);
      }

      // The click that focuses a thread is delegated from `NavigationProvider`
      // rather than bound here, because most of a work renders as static HTML
      // with no mark view at all — a listener here would make only the passages
      // under an editor clickable. `type` is what that delegation matches on.
      dom.setAttribute('type', 'comment');
      registerEditorElement(dom, props.editor);

      return {
        dom,
        contentDOM: dom,
      };
    };
  },

  addCommands() {
    return {
      setComment:
        ({ comment }) =>
        ({ chain }) =>
          // `setMark` carries the attributes rather than a following
          // `updateAttributes`, which would rewrite every comment mark in the
          // range — and overlapping anchors are the ordinary case here.
          chain().setMark(this.name, { comment, uuid: uuidv4() }).run(),

      unsetComment:
        ({ comment }) =>
        ({ state, tr, dispatch }) => {
          // Matched on the mark instance rather than the type, so an
          // overlapping anchor on a different thread survives.
          const found: { from: number; to: number; mark: Mark }[] = [];

          state.doc.descendants((node, pos) => {
            if (!node.isText) {
              return true;
            }
            const mark = node.marks.find(
              (m) => m.type.name === this.name && m.attrs.comment === comment,
            );
            if (mark) {
              found.push({ from: pos, to: pos + node.nodeSize, mark });
            }
            return true;
          });

          if (!found.length) {
            return false;
          }

          if (dispatch) {
            found.forEach(({ from, to, mark }) =>
              tr.removeMark(from, to, mark),
            );
            dispatch(tr);
          }

          return true;
        },
    };
  },
});

export default CommentMark;
