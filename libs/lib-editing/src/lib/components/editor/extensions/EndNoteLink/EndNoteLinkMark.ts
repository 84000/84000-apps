import { mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Mark as PMMark, MarkType } from '@tiptap/pm/model';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@eightyfourthousand/lib-utils';
import { createUpdateAttributes, registerEditorElement } from '../../util';
import { EndNoteLinkMarkSSR } from './EndNoteLinkMark.ssr';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    endNoteLink: {
      setEndNoteLink: (endNote: string, label?: string) => ReturnType;
      unsetEndNoteLink: () => ReturnType;
    };
  }
}

export const EndNoteLinkMark = EndNoteLinkMarkSSR.extend({
  addMarkView() {
    return (props) => {
      const isEditable = props.editor.isEditable;
      const className = isEditable
        ? 'end-note-link select-text'
        : 'end-note-link select-none';

      const dom = document.createElement('span');
      const contentDOM = document.createElement('span');
      dom.appendChild(contentDOM);

      // Define a visible default label when editable to indicate something
      // _should_ be there.
      const defaultLabel = isEditable ? '*' : '';
      const notes: [
        {
          uuid: string;
          location: string;
          toh?: string;
          endNote: string;
          label?: string;
        },
      ] = props.mark.attrs.notes || [];
      notes.sort((a, b) =>
        (a.label || defaultLabel).localeCompare(b.label || defaultLabel),
      );
      notes.forEach(
        (note: {
          uuid: string;
          location: string;
          toh?: string;
          endNote: string;
          label?: string;
        }) => {
          const { uuid, location, toh, endNote, label } = note;
          const isStart = location === 'start';

          const endnoteDOM = document.createElement('sup');
          const updateAttributes = createUpdateAttributes(endnoteDOM);
          const attributes = mergeAttributes(this.options.HTMLAttributes, {
            class: cn(className, toh, isStart ? 'me-0.75' : ''),
            type: this.name,
            endNote,
            uuid,
          });

          updateAttributes(attributes);

          // Register editor element for hover card detection in edit mode
          if (isEditable) {
            registerEditorElement(endnoteDOM, props.editor);
          }

          if (isStart) {
            dom.insertBefore(endnoteDOM, dom.firstChild);
          } else {
            dom.appendChild(endnoteDOM);
          }

          const itemLabel = label?.split('.').pop() || defaultLabel;
          endnoteDOM.textContent = itemLabel || defaultLabel;

          endnoteDOM.addEventListener('click', () => {
            if (!endNote) {
              return;
            }

            const query = new URLSearchParams(window.location.search);
            query.set('right', `open:endnotes:${endNote}`);
            window.history.pushState({}, '', `?${query.toString()}`);
          });
        },
      );

      return {
        dom,
        contentDOM,
      };
    };
  },

  addCommands() {
    return {
      setEndNoteLink:
        (endNote, label) =>
        ({ state, dispatch }) => {
          const { from, to, empty } = state.selection;
          const markType = state.schema.marks[this.name];
          if (!markType) return false;

          const newNote = { uuid: uuidv4(), endNote, label };
          const { tr } = state;

          if (empty) {
            // Cursor with no selection: append to stored/active marks
            const existing = markType.isInSet(
              state.storedMarks || state.doc.resolve(from).marks(),
            );
            const notes = existing
              ? [...(existing.attrs.notes || []), newNote]
              : [newNote];
            tr.addStoredMark(markType.create({ notes }));
            if (dispatch) dispatch(tr);
            return true;
          }

          // Only the end of the selection matters — the endnote
          // superscript renders there. Find the contiguous mark range
          // that contains `to` within the same parent block.
          const $to = state.doc.resolve(to);
          const parent = $to.parent;
          const parentStart = $to.start();

          let markFrom = -1;
          let markTo = -1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let existingMark: any = null;
          let found = false;

          parent.forEach((child, offset) => {
            if (found) return;

            const childStart = parentStart + offset;
            const childEnd = childStart + child.nodeSize;
            const mark = markType.isInSet(child.marks);

            if (mark && (markFrom === -1 || mark.eq(existingMark))) {
              // Same mark (type + attrs) — extend the contiguous range
              if (markFrom === -1) {
                markFrom = childStart;
                existingMark = mark;
              }
              markTo = childEnd;
            } else if (markFrom !== -1) {
              // End of a contiguous range (no mark, or different attrs)
              if (to > markFrom && to <= markTo) {
                found = true;
                return;
              }
              if (mark) {
                // Start a new range for a different endNoteLink mark
                markFrom = childStart;
                markTo = childEnd;
                existingMark = mark;
              } else {
                markFrom = -1;
                markTo = -1;
                existingMark = null;
              }
            } else if (mark) {
              markFrom = childStart;
              markTo = childEnd;
              existingMark = mark;
            }
          });

          const toIsInMark =
            existingMark && to > markFrom && to <= markTo;

          if (!toIsInMark) {
            // No existing mark at the end of the selection: create new
            tr.addMark(from, to, markType.create({ notes: [newNote] }));
          } else if (to === markTo) {
            // `to` is exactly at the end of the mark — append the new
            // note and keep the mark's original range unchanged.
            const existingNotes = existingMark.attrs.notes || [];
            tr.removeMark(markFrom, markTo, markType);
            tr.addMark(
              markFrom,
              markTo,
              markType.create({ notes: [...existingNotes, newNote] }),
            );
          } else {
            // `to` is in the middle of the mark — split. Left side
            // (up to `to`) gets only the new note, right side keeps
            // the original mark unchanged.
            tr.removeMark(markFrom, markTo, markType);
            tr.addMark(
              markFrom,
              to,
              markType.create({ notes: [newNote] }),
            );
            tr.addMark(to, markTo, existingMark);
          }

          if (dispatch) dispatch(tr);
          return true;
        },
      unsetEndNoteLink:
        () =>
        ({ chain }) => {
          return chain()
            .unsetMark(this.name)
            .resetAttributes(this.name, ['notes'])
            .run();
        },
    };
  },

  // When another inline mark (e.g. glossaryInstance) is applied to a sub-range
  // of an existing endNoteLink span, ProseMirror splits the text node and
  // preserves the endNoteLink mark on every resulting fragment. That causes
  // duplicate <sup> renders and duplicate exported annotations on save. This
  // plugin normalizes adjacent text fragments that carry the same endNoteLink
  // mark by keeping the mark only on the last fragment in each contiguous run.
  addProseMirrorPlugins() {
    const markName = this.name;
    return [
      new Plugin({
        key: new PluginKey('endNoteLinkDedup'),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) {
            return null;
          }

          const markType: MarkType | undefined = newState.schema.marks[markName];
          if (!markType) return null;

          // Collect textblock start positions impacted by any transaction.
          // Map each step's new range through the rest of the transaction chain
          // so the coords land in the final new-state doc.
          const impactedBlockPositions = new Set<number>();
          const docSize = newState.doc.content.size;

          const recordRange = (
            rawFrom: number,
            rawTo: number,
            startTrIdx: number,
            startStepIdx: number,
          ) => {
            let s = rawFrom;
            let e = rawTo;
            // Map through remaining steps in the originating transaction.
            const originMaps = transactions[startTrIdx].mapping.maps;
            for (let j = startStepIdx + 1; j < originMaps.length; j++) {
              s = originMaps[j].map(s, -1);
              e = originMaps[j].map(e, 1);
            }
            // Map through subsequent transactions.
            for (let later = startTrIdx + 1; later < transactions.length; later++) {
              s = transactions[later].mapping.map(s, -1);
              e = transactions[later].mapping.map(e, 1);
            }
            const from = Math.max(0, Math.min(s, docSize));
            const to = Math.max(from, Math.min(e, docSize));
            newState.doc.nodesBetween(from, to, (node, pos) => {
              if (node.isTextblock) {
                impactedBlockPositions.add(pos);
                return false;
              }
              return true;
            });
          };

          for (let tIdx = 0; tIdx < transactions.length; tIdx++) {
            const tr = transactions[tIdx];
            if (!tr.docChanged) continue;

            for (let i = 0; i < tr.steps.length; i++) {
              const step = tr.steps[i] as unknown as {
                from?: number;
                to?: number;
                pos?: number;
              };
              const stepMap = tr.mapping.maps[i];
              let recorded = false;

              // ReplaceStep / ReplaceAroundStep produce non-empty step maps;
              // use their newStart/newEnd.
              stepMap.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
                recordRange(newStart, newEnd, tIdx, i);
                recorded = true;
              });

              if (recorded) continue;

              // Mark steps (AddMarkStep / RemoveMarkStep) leave positions
              // unchanged so their step map is empty. Read the affected range
              // directly off the step.
              if (
                typeof step.from === 'number' &&
                typeof step.to === 'number'
              ) {
                recordRange(step.from, step.to, tIdx, i);
              } else if (typeof step.pos === 'number') {
                recordRange(step.pos, step.pos + 1, tIdx, i);
              }
            }
          }

          if (impactedBlockPositions.size === 0) return null;

          const tr = newState.tr;
          let changed = false;

          impactedBlockPositions.forEach((blockPos) => {
            const block = newState.doc.nodeAt(blockPos);
            if (!block || !block.isTextblock) return;

            // Walk direct children, grouping consecutive text nodes that share
            // an .eq() endNoteLink mark. For each run of length > 1, remove the
            // mark from all but the last fragment.
            let runStart = -1;
            let runEnd = -1;
            let runMark: PMMark | null = null;

            const flushRun = () => {
              if (runStart === -1 || runMark === null) return;
              if (runEnd <= runStart) return;
              let offset = blockPos + 1;
              for (let i = 0; i < runStart; i++) {
                offset += block.child(i).nodeSize;
              }
              for (let i = runStart; i < runEnd; i++) {
                const child = block.child(i);
                tr.removeMark(offset, offset + child.nodeSize, markType);
                offset += child.nodeSize;
                changed = true;
              }
            };

            for (let i = 0; i < block.childCount; i++) {
              const child = block.child(i);
              const mark = child.isText
                ? child.marks.find((m) => m.type === markType) ?? null
                : null;

              if (mark && runMark && mark.eq(runMark)) {
                runEnd = i;
              } else {
                flushRun();
                if (mark) {
                  runStart = i;
                  runEnd = i;
                  runMark = mark;
                } else {
                  runStart = -1;
                  runEnd = -1;
                  runMark = null;
                }
              }
            }
            flushRun();
          });

          return changed ? tr : null;
        },
      }),
    ];
  },
});
