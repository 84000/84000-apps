'use client';

import { createContext } from 'react';
import { Editor } from '@tiptap/react';
import { TriangleAlertIcon } from 'lucide-react';
import { Doc, XmlFragment } from 'yjs';
import type { Work } from '@eightyfourthousand/data-access';
import { type ReplacedPassage } from '@eightyfourthousand/client-graphql';
import { toast } from '@eightyfourthousand/design-system';
import { type DirtyStore } from './hooks/useDirtyStore';

/** What a save did: nothing to save, saved, or failed. */
export type SaveOutcome = 'none' | 'saved' | 'failed';

/** A second editing surface that saves alongside the paginated editors. */
export type SaveHandler = {
  save: () => Promise<SaveOutcome>;
  /** Whether it holds changes the last save did not write. */
  isDirty: () => boolean;
  /** Take in passages the server rewrote, such as by a replace. */
  applyReplaced?: (passages: ReplacedPassage[]) => void;
  /** Delete an endnote and its links, if the handler holds the endnotes. */
  deleteEndnote?: (uuid: string) => Promise<boolean>;
  /** Take a comment thread's anchors off every passage the handler holds. */
  removeCommentAnchors?: (comment: string) => void;
};

/** What the editor context offers its consumers. */
export interface EditorContextState {
  doc?: Doc;
  work: Work;
  dirtyStore: DirtyStore;
  canEdit(): Promise<boolean>;
  /**
   * Whether the user may make administrative changes to the work — those that
   * bypass the publishing workflow and go live immediately, such as editing
   * titles. A stricter bar than `canEdit`.
   */
  canAdminister(): Promise<boolean>;
  applyReplacedPassages: (passages: ReplacedPassage[]) => Promise<void>;
  /**
   * Delete an endnote through the passage stack. False when the stack doesn't
   * hold the endnotes, so the caller edits the paginated editors instead.
   */
  deleteEndnote: (uuid: string) => Promise<boolean>;
  /**
   * Take a comment thread's anchors off the passages the stack holds,
   * including those not drawn.
   */
  removeCommentAnchors: (comment: string) => void;
  getFragment: (builder: string) => XmlFragment;
  setDoc: (doc: Doc) => void;
  getEditor: (key: string) => Editor | undefined;
  setEditor: (key: string, editor?: Editor) => void;
  refreshEditorBaseline: (key: string) => void;
  save: () => Promise<void>;
  /**
   * Save something else alongside the paginated editors, or stop with null.
   *
   * The passage stack materializes rows from its own documents rather than
   * from a TipTap editor, and this provider cannot call into it — the stack
   * sits behind a dynamic boundary so its `@tiptap/y-tiptap` imports stay out
   * of the server bundle. So the stack registers instead.
   */
  registerSaveHandler: (handler: SaveHandler | null) => void;
  startObserving: (builder: string) => void;
  stopObserving: (builder: string) => void;
  setNavigating: (
    navigating: boolean,
    resetLastObservedUuids?: boolean,
    fragment?: XmlFragment,
  ) => void;
  isNavigating: () => boolean;
}

export const EditorContext = createContext<EditorContextState>({
  work: {
    uuid: '',
    title: '',
    section: '',
    pages: 0,
    publicationDate: new Date(),
    publicationVersion: '0.0.0',
    restriction: false,
    toh: [],
  },
  dirtyStore: {
    isDirty: false,
    listeners: new Set(),
    subscribe: () => () => {
      // No-op cleanup - safe for useSyncExternalStore in reader mode
    },
    setDirty: () => {
      // No-op when outside provider (reader mode)
    },
    getSnapshot: () => false,
  },
  canEdit: async () => false,
  canAdminister: async () => false,
  registerSaveHandler: () => {
    // No-op when outside provider (reader mode)
  },
  applyReplacedPassages: async () => {
    // No-op when outside provider
  },
  deleteEndnote: async () => false,
  removeCommentAnchors: () => undefined,
  getFragment: () => {
    throw Error('Not implemented');
  },
  setDoc: () => {
    throw Error('Not implemented');
  },
  getEditor: () => undefined,
  setEditor: () => {
    throw Error('Not implemented');
  },
  refreshEditorBaseline: () => {
    // No-op when outside provider
  },
  save: async () => {
    toast('Unable to save.', {
      icon: <TriangleAlertIcon className="size-4 text-warning" />,
    });
  },
  startObserving: () => {
    throw Error('Not implemented');
  },
  stopObserving: () => {
    throw Error('Not implemented');
  },
  setNavigating: () => {
    // No-op when outside provider
  },
  isNavigating: () => false,
});
