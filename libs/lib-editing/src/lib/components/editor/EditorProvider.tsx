'use client';

import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Work } from '@eightyfourthousand/data-access';
import {
  createGraphQLClient,
  hasPermission,
  type ReplacedPassage,
} from '@eightyfourthousand/client-graphql';
import { Toaster } from '@eightyfourthousand/design-system';
import { NavigationProvider } from '../shared';
import { useDirtyStore } from './hooks/useDirtyStore';
import { EditorContext, type SaveHandler } from './editor-context';
import { useSaveLifecycle } from './useSaveLifecycle';
import {
  readReadOnlyPreference,
  writeReadOnlyPreference,
} from './read-only-preference';

export { EditorContext } from './editor-context';
export type {
  SaveHandler,
  SaveOutcome,
  SaveReport,
  UnconfirmedSave,
} from './editor-context';

interface EditorContextProps {
  work: Work;
  children: React.ReactNode;
}

/**
 * The editor's state and save lifecycle for one work.
 *
 * A save whose outcome is unknown can replace everything below with a fresh
 * session, which reads the work from the server again. The toaster sits
 * outside it so the notice explaining why survives.
 */
export const EditorContextProvider = ({
  work,
  children,
}: EditorContextProps) => {
  const [session, setSession] = useState(0);
  const reload = useCallback(() => setSession((n) => n + 1), []);

  return (
    <>
      <EditorSession key={session} work={work} reload={reload}>
        {children}
      </EditorSession>
      <Toaster />
    </>
  );
};

const EditorSession = ({
  work,
  reload,
  children,
}: EditorContextProps & { reload: () => void }) => {
  const client = createGraphQLClient();

  const isSavingRef = useRef(false);

  // Store for dirty state with subscription support
  const dirtyStore = useDirtyStore();

  // A failed check reads as "no": the editor opens read-only rather than
  // waiting on an answer that never comes.
  const canEdit = useCallback(
    () =>
      hasPermission({ client, permission: 'EDITOR_EDIT' }).catch(() => false),
    [client],
  );

  const canAdminister = useCallback(
    () =>
      hasPermission({ client, permission: 'EDITOR_ADMIN' }).catch(() => false),
    [client],
  );

  const saveHandlerRef = useRef<SaveHandler | null>(null);

  const deleteEndnote = useCallback(
    async (uuid: string) =>
      (await saveHandlerRef.current?.deleteEndnote?.(uuid)) ?? false,
    [],
  );

  const removeCommentAnchors = useCallback(
    (comment: string) =>
      saveHandlerRef.current?.removeCommentAnchors?.(comment),
    [],
  );

  const applyReplacedPassages = useCallback(
    async (passages: ReplacedPassage[]) => {
      if (passages.length === 0) {
        return;
      }
      saveHandlerRef.current?.applyReplaced?.(passages);
    },
    [],
  );

  const registerSaveHandler = useCallback((handler: SaveHandler | null) => {
    saveHandlerRef.current = handler;
  }, []);

  const { save } = useSaveLifecycle({
    client,
    work,
    isSavingRef,
    saveHandlerRef,
    dirtyStore,
    reload,
  });

  const [editPermitted, setEditPermitted] = useState<boolean>();
  useEffect(() => {
    let active = true;
    canEdit().then((permitted) => {
      if (active) setEditPermitted(permitted);
    });
    return () => {
      active = false;
    };
  }, [canEdit]);

  const [readOnlyChosen, setReadOnlyChosenState] = useState(
    readReadOnlyPreference,
  );
  const setReadOnlyChosen = useCallback(
    async (next: boolean) => {
      // Remembered first, so a save that reloads the session opens it as
      // chosen.
      writeReadOnlyPreference(next);
      // The live editors unmount when the stack turns read-only. Their edits
      // live in the work and survive that, but save them while the user is
      // still looking at an editor.
      if (next && dirtyStore.getSnapshot()) {
        await save();
      }
      setReadOnlyChosenState(next);
    },
    [dirtyStore, save],
  );

  const readOnly = editPermitted !== true || readOnlyChosen;

  return (
    <EditorContext.Provider
      value={{
        work,
        dirtyStore,
        canEdit,
        canAdminister,
        readOnly,
        editPermitted,
        readOnlyChosen,
        setReadOnlyChosen,
        applyReplacedPassages,
        deleteEndnote,
        removeCommentAnchors,
        save,
        registerSaveHandler,
      }}
    >
      {/*
        Cards are drawn either way; their edit actions only while the stack is
        editable too.
      */}
      <NavigationProvider
        uuid={work.uuid}
        initialToh={work.toh[0]}
        editable={!readOnly}
        hoverCards
        commentsPanel
      >
        {children}
      </NavigationProvider>
    </EditorContext.Provider>
  );
};

export const useEditorState = () => useContext(EditorContext);
