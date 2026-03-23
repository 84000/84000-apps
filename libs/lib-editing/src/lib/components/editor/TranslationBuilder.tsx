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

  // Track known passage UUIDs by passage type so we can detect deletions
  // (backspace, merge, etc.) and clean up related marks in other editors.
  // This ref is independent of the Y.js observer's knownUuidsRef, which
  // can be cleared during navigation.
  const passageUuidsByTypeRef = useRef<Record<string, Set<string>>>({});
  const debouncedSyncRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingDeletedByTypeRef = useRef<Record<string, Set<string>>>({});

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
          // Initialize known passage UUIDs grouped by type
          const byType: Record<string, Set<string>> = {};
          const doc = editor.state.doc;
          for (let i = 0; i < doc.childCount; i++) {
            const child = doc.child(i);
            if (child.type.name === 'passage' && child.attrs.uuid) {
              const pType = (child.attrs.type as string) || 'unknown';
              (byType[pType] ??= new Set()).add(child.attrs.uuid);
            }
          }
          passageUuidsByTypeRef.current = byType;

          editor.on('update', () => {
            // Collect current passage UUIDs grouped by type (cheap)
            const currentByType: Record<string, Set<string>> = {};
            const doc = editor.state.doc;
            for (let i = 0; i < doc.childCount; i++) {
              const child = doc.child(i);
              if (child.type.name === 'passage' && child.attrs.uuid) {
                const pType = (child.attrs.type as string) || 'unknown';
                (currentByType[pType] ??= new Set()).add(child.attrs.uuid);
              }
            }

            // Detect deleted and added passages per type (skip during
            // navigation to avoid false positives from content replacement)
            const deletedByType: Record<string, string[]> = {};
            let hasAdded = false;
            if (!isNavigating()) {
              const prevByType = passageUuidsByTypeRef.current;
              for (const pType of Object.keys(prevByType)) {
                const prev = prevByType[pType];
                const curr = currentByType[pType];
                prev.forEach((uuid) => {
                  if (!curr?.has(uuid)) {
                    (deletedByType[pType] ??= []).push(uuid);
                  }
                });
              }
              if (!hasAdded) {
                outer: for (const pType of Object.keys(currentByType)) {
                  const prev = prevByType[pType];
                  for (const uuid of currentByType[pType]) {
                    if (!prev?.has(uuid)) {
                      hasAdded = true;
                      break outer;
                    }
                  }
                }
              }
            }

            // Always update the baseline so the next diff is accurate
            passageUuidsByTypeRef.current = currentByType;

            const hasDeleted = Object.keys(deletedByType).length > 0;

            // Accumulate deletions and debounce the expensive sync work
            // so rapid keystrokes don't trigger multiple full traversals
            for (const [pType, uuids] of Object.entries(deletedByType)) {
              const pending = (pendingDeletedByTypeRef.current[pType] ??=
                new Set());
              for (const uuid of uuids) {
                pending.add(uuid);
              }
            }

            if (hasDeleted || hasAdded) {
              if (debouncedSyncRef.current) {
                clearTimeout(debouncedSyncRef.current);
              }
              debouncedSyncRef.current = setTimeout(() => {
                const pendingEndnotes =
                  pendingDeletedByTypeRef.current['endnotes'];
                if (pendingEndnotes?.size) {
                  const frontEditor = getEditor('front');
                  const translationEditor = getEditor('translation');
                  for (const uuid of pendingEndnotes) {
                    if (frontEditor)
                      removeAllEndnoteLinksForPassage(frontEditor, uuid);
                    if (translationEditor)
                      removeAllEndnoteLinksForPassage(translationEditor, uuid);
                  }
                }
                pendingDeletedByTypeRef.current = {};
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
