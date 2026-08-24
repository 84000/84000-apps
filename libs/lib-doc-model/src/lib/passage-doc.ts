import type { JSONContent } from '@tiptap/core';
import { Node as PMNode, Schema } from '@tiptap/pm/model';
import {
  prosemirrorToYXmlFragment,
  yXmlFragmentToProseMirrorRootNode,
} from 'y-prosemirror';
import {
  Doc,
  UndoManager,
  XmlFragment,
  applyUpdate,
  encodeStateAsUpdate,
  transact,
} from 'yjs';
import type { Passage } from '@eightyfourthousand/data-access';
import { passageFromNode } from './passage';

/** Yjs key for a passage's content fragment. */
const CONTENT_KEY = 'content';

/**
 * Transaction origin for structural operations and their replay.
 *
 * Structural work is undone through the command log, atomically across the
 * documents and the spine it touched, so it must stay out of any single
 * passage's text history. Keeping it on its own origin is how: the
 * `UndoManager` tracks the text origins and ignores this one.
 */
export const STRUCTURAL_ORIGIN = 'doc-model-structural';

/**
 * Transaction origin for updates arriving from the server or another client.
 *
 * Remote updates are neither undoable locally nor dirty — they are already on
 * the server by definition — so both the undo manager and the dirty flag
 * exclude them.
 */
export const REMOTE_ORIGIN = 'doc-model-remote';

const EMPTY_PARAGRAPH: JSONContent = { type: 'paragraph' };

export type PassageDocOptions = {
  uuid: string;
  workUuid: string;
  /**
   * The ProseMirror schema this passage's content conforms to.
   *
   * Injected rather than built here: the browser binds these documents to
   * TipTap editors with node views, and a route handler renders them
   * headlessly, and the two extension sets differ. The doc model only needs
   * *a* schema, so it takes one.
   */
  schema: Schema;
  /** An existing Yjs doc to adopt, e.g. one restored from local storage. */
  doc?: Doc;
  /**
   * Transaction origins that count as user text edits — tracked by the undo
   * manager and marked dirty.
   *
   * Defaults to `null`, the origin Yjs gives a transaction with none, which is
   * what a direct write produces. A TipTap consumer passes `ySyncPluginKey` so
   * that edits made through the editor binding are tracked.
   */
  textOrigins?: Set<unknown>;
};

/**
 * One passage's document: its content, and the annotations carried on that
 * content as marks and node attributes.
 *
 * There is no separate annotation store. Annotations *are* the marks and
 * attributes in the content — that is how the exporters read them, and giving
 * them a second home would mean two things to keep in step across a merge.
 * `toPassage()` is where they become rows again.
 *
 * A document is created on demand and released when it leaves the visible
 * window, so a work's memory cost is bounded by the window rather than by the
 * work. Nothing here reaches for a browser API: the same class backs the
 * editor stack and the server-side write path.
 */
export class PassageDoc {
  readonly uuid: string;
  readonly workUuid: string;
  readonly doc: Doc;
  readonly content: XmlFragment;
  readonly undoManager: UndoManager;

  private schema: Schema;
  private dirty = false;
  private textOrigins: Set<unknown>;
  private listeners = new Set<() => void>();
  private nodeCache: PMNode | null = null;

  constructor(options: PassageDocOptions) {
    this.uuid = options.uuid;
    this.workUuid = options.workUuid;
    this.schema = options.schema;
    this.doc = options.doc ?? new Doc();
    this.content = this.doc.getXmlFragment(CONTENT_KEY);
    this.textOrigins = options.textOrigins ?? new Set([null]);

    this.undoManager = new UndoManager(this.content, {
      trackedOrigins: this.textOrigins,
    });

    this.doc.on('update', this.onUpdate);
    this.content.observeDeep(this.onContentChanged);
  }

  // ------------------------------------------------------------- content

  /**
   * Fill an empty document from row content.
   *
   * Seeding happens outside the undo manager's history — created before it,
   * so the initial state is not something the user can undo their way behind.
   */
  seed(content: JSONContent[]) {
    if (this.content.length > 0) return;
    const node = this.parse({
      type: 'doc',
      content: content.length ? content : [EMPTY_PARAGRAPH],
    });
    transact(
      this.doc,
      () => prosemirrorToYXmlFragment(node, this.content),
      STRUCTURAL_ORIGIN,
    );
    this.undoManager.clear();
    // Seeding writes to the document, which set the dirty flag on the way
    // past. The content came from the server, so it is not a local edit —
    // and clearing the flag has to be announced, or an observer that saw the
    // write go by is left believing the passage is unsynced.
    this.dirty = false;
    this.notify();
  }

  /** The content as a ProseMirror node. Cached until the fragment changes. */
  toNode(): PMNode {
    if (!this.nodeCache) {
      this.nodeCache = yXmlFragmentToProseMirrorRootNode(
        this.content,
        this.schema,
      );
    }
    return this.nodeCache;
  }

  /** The content as ProseMirror JSON. */
  toJSON(): JSONContent {
    return this.toNode().toJSON();
  }

  /** The passage's plain text — what the full-text index and rows store. */
  get text(): string {
    return this.toNode().textContent;
  }

  /**
   * Replace the whole content, as a structural change.
   *
   * Used by split, merge and cross-passage delete, which compute new content
   * for a passage rather than editing it in place. The write carries
   * `STRUCTURAL_ORIGIN`, so it does not enter this passage's text history.
   */
  replaceContent(json: JSONContent) {
    const node = this.parse(json);
    transact(
      this.doc,
      () => {
        this.content.delete(0, this.content.length);
        prosemirrorToYXmlFragment(node, this.content);
      },
      STRUCTURAL_ORIGIN,
    );
  }

  /** Materialize this passage's row, given the identity held in the spine. */
  toPassage(identity: {
    label: string;
    sort: number;
    type: Passage['type'];
    toh?: Passage['toh'];
  }): Passage {
    return passageFromNode(this.toNode(), this.workUuid, {
      uuid: this.uuid,
      ...identity,
    });
  }

  // ---------------------------------------------------------------- sync

  /** The document's full state, for persisting a snapshot. */
  encode(): Uint8Array {
    return encodeStateAsUpdate(this.doc);
  }

  /**
   * Apply an update from the server or another client.
   *
   * Applied under `REMOTE_ORIGIN` so it neither dirties this document nor
   * lands in the local undo history.
   */
  applyRemote(update: Uint8Array) {
    applyUpdate(this.doc, update, REMOTE_ORIGIN);
  }

  /**
   * Whether this document holds local edits not yet sent to the server.
   *
   * This is the per-passage replacement for scanning a whole work's fragment
   * for changed passages: a passage knows it is dirty because its own document
   * was written to, and a work with ten thousand passages costs nothing to ask.
   */
  get isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Clear the dirty flag, after the caller has sent this document's state and
   * had it acknowledged.
   */
  markSynced() {
    if (!this.dirty) return;
    this.dirty = false;
    this.notify();
  }

  // ------------------------------------------------------------- history

  /** Undo the last text edit in this passage. Structural ops are not here. */
  undo(): boolean {
    if (!this.undoManager.undoStack.length) return false;
    this.undoManager.undo();
    return true;
  }

  /** Redo the last undone text edit in this passage. */
  redo(): boolean {
    if (!this.undoManager.redoStack.length) return false;
    this.undoManager.redo();
    return true;
  }

  // --------------------------------------------------------- observation

  /** Observe content or dirty-state changes. Returns an unsubscribe. */
  observe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Release the document.
   *
   * The undo manager is destroyed with it: a released passage's text history
   * is gone, which is the trade the windowed model makes. Structural history
   * survives in the command log, which does not hold documents.
   */
  destroy() {
    this.doc.off('update', this.onUpdate);
    this.content.unobserveDeep(this.onContentChanged);
    this.undoManager.destroy();
    this.listeners.clear();
    this.doc.destroy();
  }

  // ------------------------------------------------------------- private

  private onUpdate = (_update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_ORIGIN) return;
    if (this.dirty) return;
    this.dirty = true;
    this.notify();
  };

  private onContentChanged = () => {
    this.nodeCache = null;
    this.notify();
  };

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private parse(json: JSONContent): PMNode {
    try {
      return PMNode.fromJSON(this.schema, json);
    } catch (error) {
      console.error(`failed to parse content for passage ${this.uuid}`, error);
      return PMNode.fromJSON(this.schema, {
        type: 'doc',
        content: [EMPTY_PARAGRAPH],
      });
    }
  }
}
