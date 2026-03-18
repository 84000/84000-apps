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

export const TranslationBuilder = ({
  content,
  name,
  className,
  filter,
  panel,
}: TranslationRenderer) => {
  const [fragment, setFragment] = useState<XmlFragment>();
  const [isObserving, setIsObserving] = useState(false);
  const [isEditable, setIsEditable] = useState(false);

  const {
    canEdit,
    setEditor,
    getEditor,
    startObserving,
    getFragment,
    isNavigating,
  } = useEditorState();

  const { uuid } = useNavigation();

  // Track known passage UUIDs for the endnotes editor so we can detect
  // deletions (backspace, merge, etc.) and clean up endnote link marks
  // in the front/translation editors. This ref is independent of the
  // Y.js observer's knownUuidsRef, which can be cleared during navigation.
  const endnotePassageUuidsRef = useRef<Set<string>>(new Set());
  const debouncedSyncRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingDeletedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const isEditable = await canEdit();

      setIsEditable(isEditable);
      if (isEditable) {
        setFragment(getFragment(name));
      }
    })();
  }, [name, canEdit, getFragment]);

  return content && fragment ? (
    <PaginationProvider
      uuid={uuid}
      panel={panel}
      tab={name}
      filter={filter}
      content={content}
      fragment={fragment}
      isEditable={isEditable}
      onCreate={({ editor }) => {
        editor.commands.setDebug(true);
        setEditor(name, editor);
        if (!isObserving) {
          setIsObserving(true);
          startObserving(name);
        }

        if (name === 'endnotes') {
          // Initialize known passage UUIDs from the editor's current state
          const uuids = new Set<string>();
          const doc = editor.state.doc;
          for (let i = 0; i < doc.childCount; i++) {
            const child = doc.child(i);
            if (child.type.name === 'passage' && child.attrs.uuid) {
              uuids.add(child.attrs.uuid);
            }
          }
          endnotePassageUuidsRef.current = uuids;

          editor.on('update', () => {
            // Collect current passage UUIDs (cheap — always keep baseline accurate)
            const currentUuids = new Set<string>();
            const doc = editor.state.doc;
            for (let i = 0; i < doc.childCount; i++) {
              const child = doc.child(i);
              if (child.type.name === 'passage' && child.attrs.uuid) {
                currentUuids.add(child.attrs.uuid);
              }
            }

            // Detect deleted and added passages (skip during navigation to
            // avoid false positives from content replacement)
            const deleted: string[] = [];
            let hasAdded = false;
            if (!isNavigating()) {
              endnotePassageUuidsRef.current.forEach((uuid) => {
                if (!currentUuids.has(uuid)) {
                  deleted.push(uuid);
                }
              });
              if (!hasAdded) {
                currentUuids.forEach((uuid) => {
                  if (!endnotePassageUuidsRef.current.has(uuid)) {
                    hasAdded = true;
                  }
                });
              }
            }

            // Always update the baseline so the next diff is accurate
            endnotePassageUuidsRef.current = currentUuids;

            // Accumulate deletions and debounce the expensive sync work
            // so rapid keystrokes don't trigger multiple full traversals
            for (const uuid of deleted) {
              pendingDeletedRef.current.add(uuid);
            }

            if (deleted.length > 0 || hasAdded) {
              if (debouncedSyncRef.current) {
                clearTimeout(debouncedSyncRef.current);
              }
              debouncedSyncRef.current = setTimeout(() => {
                if (pendingDeletedRef.current.size > 0) {
                  const frontEditor = getEditor('front');
                  const translationEditor = getEditor('translation');
                  for (const uuid of pendingDeletedRef.current) {
                    if (frontEditor)
                      removeAllEndnoteLinksForPassage(frontEditor, uuid);
                    if (translationEditor)
                      removeAllEndnoteLinksForPassage(translationEditor, uuid);
                  }
                  pendingDeletedRef.current.clear();
                }
                syncEndnoteLinkLabelsAcrossEditors(editor, getEditor);
              }, 150);
            }
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
