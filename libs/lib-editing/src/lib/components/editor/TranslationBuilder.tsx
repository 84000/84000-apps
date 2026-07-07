'use client';

import type { TranslationRenderer } from '../shared/types';
import { useEffect, useRef, useState } from 'react';
import type { XmlFragment } from 'yjs';
import { useEditorState } from './EditorProvider';
import { TranslationEditor } from './TranslationEditor';
import { TranslationSkeleton, useNavigation } from '../shared';
import { PaginationProvider } from './PaginationProvider';
import {
  removeAllEndnoteLinksForPassage,
  syncEndnoteLinkLabelsAcrossEditors,
} from './extensions/EndNoteLink/endnote-utils';
import {
  collectPassageUuidsByType,
  diffPassageUuidsByType,
} from './endnote-tracking';

const ENDNOTE_SYNC_DEBOUNCE_MS = 150;

export const TranslationBuilder = ({
  content,
  name,
  className,
  filter,
  panel,
  hasMoreAfter,
}: TranslationRenderer) => {
  const [fragment, setFragment] = useState<XmlFragment>();
  const [isObserving, setIsObserving] = useState(false);
  const [isEditable, setIsEditable] = useState(false);

  const {
    canEdit,
    setEditor,
    getEditor,
    startObserving,
    stopObserving,
    getFragment,
    isNavigating,
  } = useEditorState();

  const { uuid } = useNavigation();

  // Track known passage UUIDs by passage type so we can detect deletions
  // (backspace, merge, etc.) and clean up related marks in other editors.
  // This ref is independent of the Y.js observer's knownUuidsRef, which
  // can be cleared during navigation.
  const passageUuidsByTypeRef = useRef<Record<string, Set<string>>>({});
  const debouncedSyncRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const baselineInvalidatedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const isEditable = await canEdit();

      setIsEditable(isEditable);
      if (isEditable) {
        setFragment(getFragment(name));
      }
    })();
  }, [name, canEdit, getFragment]);

  useEffect(() => {
    return () => {
      if (debouncedSyncRef.current) {
        clearTimeout(debouncedSyncRef.current);
      }
      setEditor(name, undefined);
      stopObserving(name);
    };
  }, [name, setEditor, stopObserving]);

  return content && fragment ? (
    <PaginationProvider
      uuid={uuid}
      panel={panel}
      tab={name}
      filter={filter}
      content={content}
      fragment={fragment}
      isEditable={isEditable}
      hasMoreAfter={hasMoreAfter}
      onCreate={({ editor }) => {
        setEditor(name, editor);
        if (!isObserving) {
          setIsObserving(true);
          startObserving(name);
        }

        if (name === 'endnotes') {
          // Initialize known passage UUIDs grouped by type
          passageUuidsByTypeRef.current = collectPassageUuidsByType(
            editor.state.doc,
          );

          // All traversal and diffing happens here, at most once per debounce
          // window — a burst of keystrokes collapses to one diff against the
          // pre-burst baseline, which by construction accumulates every
          // addition and deletion since the last flush.
          const flushEndnotesSync = () => {
            debouncedSyncRef.current = undefined;
            if (editor.isDestroyed) {
              return;
            }

            // Diffing a half-replaced doc would report mass false deletions
            // and strip endnote links from the other editors; retry after
            // navigation settles and refresh the baseline without diffing.
            if (isNavigating()) {
              baselineInvalidatedRef.current = true;
              debouncedSyncRef.current = setTimeout(
                flushEndnotesSync,
                ENDNOTE_SYNC_DEBOUNCE_MS,
              );
              return;
            }

            const currentByType = collectPassageUuidsByType(editor.state.doc);
            const skipDiff = baselineInvalidatedRef.current;
            baselineInvalidatedRef.current = false;
            const prevByType = passageUuidsByTypeRef.current;
            passageUuidsByTypeRef.current = currentByType;
            if (skipDiff) {
              return;
            }

            const { deletedByType, hasAdded } = diffPassageUuidsByType(
              prevByType,
              currentByType,
            );

            const deletedEndnotes = deletedByType['endnotes'] ?? [];
            if (deletedEndnotes.length) {
              const frontEditor = getEditor('front');
              const translationEditor = getEditor('translation');
              for (const uuid of deletedEndnotes) {
                if (frontEditor)
                  removeAllEndnoteLinksForPassage(frontEditor, uuid);
                if (translationEditor)
                  removeAllEndnoteLinksForPassage(translationEditor, uuid);
              }
            }

            if (Object.keys(deletedByType).length > 0 || hasAdded) {
              syncEndnoteLinkLabelsAcrossEditors(editor, getEditor);
            }
          };

          // O(1) per keystroke: record whether the baseline went stale and
          // (re)arm the timer; the doc traversals run in the flush.
          const handleEndnotesUpdate = () => {
            if (isNavigating()) {
              baselineInvalidatedRef.current = true;
            }
            if (debouncedSyncRef.current) {
              clearTimeout(debouncedSyncRef.current);
            }
            debouncedSyncRef.current = setTimeout(
              flushEndnotesSync,
              ENDNOTE_SYNC_DEBOUNCE_MS,
            );
          };

          editor.on('update', handleEndnotesUpdate);
          editor.on('destroy', () => {
            editor.off('update', handleEndnotesUpdate);
          });
        }
      }}
    >
      <TranslationEditor className={className} />
    </PaginationProvider>
  ) : (
    <TranslationSkeleton />
  );
};
