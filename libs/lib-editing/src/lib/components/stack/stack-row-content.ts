import type {
  PassageDoc,
  WorkDocument,
} from '@eightyfourthousand/lib-doc-model';
import type { UndoManager } from 'yjs';

import { renderTranslationHTML } from '../reader/translation-html';
import type { PassageStackControllerOptions } from './PassageStackController';

/**
 * Rough characters per rendered line, for unmeasured row height estimates.
 *
 * Fitted against measured rows. It follows the column width, so a host far
 * narrower than the editor's will under-estimate.
 */
const CHARS_PER_LINE = 77;
/** One line of rendered passage text, in pixels. */
const LINE_HEIGHT_PX = 28;
/** A row is never shorter than this, however little text it holds. */
const MIN_CONTENT_PX = 60;

/**
 * Fallback height for a passage whose size is entirely unknown.
 *
 * Roughly the median measured row, so a screenful of unknown rows occupies
 * about the space the real ones will. A short guess here is not conservative:
 * the placeholder is what the virtualizer measures, so every row collapses to
 * it and a screenful of labels ends up stacked at the top.
 */
const UNKNOWN_ROW_PX = 112;

/**
 * What a stack view draws for a row without a live editor: its static HTML and
 * its height estimate, kept current by bookkeeping on each hydrated document.
 */
export class StackRowContent {
  private readonly work: WorkDocument;
  private readonly spineFeed?: PassageStackControllerOptions['spineFeed'];
  private readonly bump: () => void;

  private charCounts = new Map<string, number>();
  private staticHTML = new Map<string, string>();
  /** Per-hydrated-document teardown: content observer + undo bookkeeping. */
  private wiring = new Map<string, () => void>();

  constructor(host: {
    work: WorkDocument;
    spineFeed?: PassageStackControllerOptions['spineFeed'];
    charCounts?: Iterable<readonly [string, number]>;
    bump: () => void;
  }) {
    this.work = host.work;
    this.spineFeed = host.spineFeed;
    this.bump = host.bump;
    if (host.charCounts) {
      this.charCounts = new Map(host.charCounts);
    }
  }

  /**
   * Just the text column, for sizing a placeholder inside an existing row.
   *
   * The placeholder is what the virtualizer measures, so this has to be the
   * row's best guess and not a token height — a short placeholder is not a
   * pessimistic estimate that gets corrected, it *becomes* the row's height
   * until the passage hydrates.
   */
  estimateContentHeight = (uuid: string) => {
    const count = this.contentLength(uuid);
    if (count === undefined) return UNKNOWN_ROW_PX;
    return Math.max(
      MIN_CONTENT_PX,
      Math.ceil(count / CHARS_PER_LINE) * LINE_HEIGHT_PX,
    );
  };

  /** Characters of text, from a hydrated document or the spine's read. */
  private contentLength = (uuid: string) =>
    this.charCounts.get(uuid) ?? this.spineFeed?.contentLength?.(uuid);

  /**
   * Whether the row's height is a real measure of *this* passage or the
   * generic fallback.
   *
   * A skeleton drawn at a known size can imitate the text it stands in for; one
   * drawn at a guess should not pretend to, or it reads as content that failed
   * to load rather than content still arriving.
   */
  hasSizeFor = (uuid: string) => this.contentLength(uuid) !== undefined;

  /**
   * Static HTML for a row that doesn't carry a live editor, or null when the
   * passage has not been hydrated.
   *
   * Null is not an error state — outside the hydration window there is
   * genuinely no content to draw, and the row shows a skeleton at its
   * estimated height instead. The prototype never had this case because it
   * held every passage in memory, which is exactly what does not scale.
   *
   * Rendered through the reader's own renderer, not the stack's schema set.
   * Static rendering needs the `*.ssr` variant of every extension whose
   * interactive form draws through a React node view, plus the `endNoteLink`
   * mark mapping — rendering with the schema set silently dropped endnote
   * markers from every static row while the editor showed them. The schema set
   * is for parsing; this is for drawing, and they are not the same list.
   *
   * Cached per passage because the render is not cheap and a row re-renders on
   * every controller bump. Invalidated by `wire`'s content observer.
   */
  getStaticHTML = (uuid: string): string | null => {
    const cached = this.staticHTML.get(uuid);
    if (cached !== undefined) return cached;

    const doc = this.work.store.peek(uuid);
    if (!doc) return null;

    const html =
      renderTranslationHTML({ content: doc.toJSON() }) ?? `<p>${doc.text}</p>`;
    this.staticHTML.set(uuid, html);
    return html;
  };

  /**
   * Attach the controller's per-document bookkeeping, once per document.
   *
   * Two jobs. Content changes invalidate the cached static HTML and the row's
   * height estimate. And a text edit taken by the passage's own `UndoManager`
   * has to be announced to the command log, or Mod-Z would skip straight past
   * typing to the last structural op — `WorkDocument.recordTextEdit` exists
   * for exactly this and nothing in the model calls it.
   */
  wire(doc: PassageDoc) {
    if (this.wiring.has(doc.uuid)) return;
    const uuid = doc.uuid;

    this.charCounts.set(uuid, doc.text.length);

    const unobserve = doc.observe(() => {
      this.staticHTML.delete(uuid);
      this.charCounts.set(uuid, doc.text.length);
      this.bump();
    });

    const onStackItem = ({ type }: { type: 'undo' | 'redo' }) => {
      // A redo-stack item is the inverse produced by an undo, not a new edit.
      if (type !== 'undo') return;
      this.work.recordTextEdit(uuid);
    };
    doc.undoManager.on('stack-item-added', onStackItem);

    // The y-undo plugin destroys whatever UndoManager it is handed when its
    // editor unmounts, but this one belongs to the document and has to
    // outlive every mount — otherwise typing, scrolling away and scrolling
    // back would silently lose that passage's history. `PassageDoc.destroy`
    // tears down the Yjs types it observes, so the neutered call leaks
    // nothing.
    const manager = doc.undoManager as UndoManager & { destroy: () => void };
    manager.destroy = () => undefined;

    this.wiring.set(uuid, () => {
      unobserve();
      doc.undoManager.off('stack-item-added', onStackItem);
    });
  }

  /** Drop bookkeeping for documents the store has released. */
  reconcileWiring() {
    [...this.wiring.keys()].forEach((uuid) => {
      if (this.work.store.has(uuid)) return;
      this.wiring.get(uuid)?.();
      this.wiring.delete(uuid);
      this.staticHTML.delete(uuid);
      // The passage's text history went with its document; the command log
      // would otherwise stall on entries it can no longer replay.
      this.work.log.forgetText(uuid);
    });
  }

  /** Tear down every document's bookkeeping. */
  unwireAll() {
    this.wiring.forEach((teardown) => teardown());
    this.wiring.clear();
  }
}
