import type { PassageDocStore } from './doc-store';
import type { ContentChange } from './command-log';
import { withEndNoteLabels, withoutEndNoteLinks } from './end-note-links';
import type { Spine } from './spine';

/** Keeps the endnote links in a work's held passages in step with its spine. */
export class EndNoteLinkUpkeep {
  /** Each endnote's label as its links last showed it. */
  private endNoteLabels = new Map<string, string>();
  /** Passages whose endnote links have been numbered from the spine. */
  private numbered = new Set<string>();
  /** Passages already checked for links to deleted endnotes. */
  private unlinked = new Set<string>();

  private spine: Spine;
  private store: PassageDocStore;

  constructor(spine: Spine, store: PassageDocStore) {
    this.spine = spine;
    this.store = store;
  }

  /**
   * Take the links to deleted passages out of every other held passage, and
   * return the changes for the delete's command, so one undo puts both back.
   *
   * Passages that aren't held need nothing: the save deletes their links.
   */
  unlink(deleted: string[]): ContentChange[] {
    const gone = new Set(deleted);
    return this.store.held().flatMap((uuid) => {
      if (gone.has(uuid)) return [];
      const doc = this.store.ensure(uuid);
      const before = doc.toJSON();
      const after = withoutEndNoteLinks(before, gone);
      if (!after) return [];
      doc.replaceContent(after);
      return [{ uuid, before, after }];
    });
  }

  /**
   * Bring endnote links' numbers in line with the spine after endnotes were
   * renumbered. Only the links to endnotes whose label changed are touched.
   */
  readonly renumberLinks = () => {
    const changed = new Set<string>();
    this.spine.entries().forEach(({ uuid, type, label }) => {
      if (type !== 'endnotes' || this.endNoteLabels.get(uuid) === label) return;
      this.endNoteLabels.set(uuid, label);
      changed.add(uuid);
    });
    if (changed.size) this.numberLinks(this.store.held(), changed);
  };

  /**
   * Number the links in passages newly hydrated. One loaded from the server
   * shows the stored numbers, which unsaved renumbering may have moved on.
   */
  readonly numberNewPassages = () => {
    const held = new Set(this.store.held());
    // A document is adopted before it is seeded, so an empty one waits.
    const fresh = [...held].filter(
      (uuid) =>
        !this.numbered.has(uuid) &&
        (this.store.peek(uuid)?.content.length ?? 0) > 0,
    );
    this.numbered = new Set([
      ...[...this.numbered].filter((uuid) => held.has(uuid)),
      ...fresh,
    ]);
    if (fresh.length) this.numberLinks(fresh);
  };

  numberLinks(uuids: string[], only?: ReadonlySet<string>) {
    uuids.forEach((uuid) => {
      const doc = this.store.peek(uuid);
      if (!doc) return;
      const json = withEndNoteLabels(doc.toJSON(), (endNote) =>
        only && !only.has(endNote)
          ? undefined
          : this.spine.meta(endNote)?.label,
      );
      if (json) doc.adjust(json);
    });
  }

  /**
   * Take links to endnotes deleted since the last save out of passages loaded
   * after the delete: they come from the server with the link, and the save
   * that deletes the link rows would otherwise be undone by their next edit.
   */
  readonly unlinkLoadedPassages = () => {
    const held = new Set(this.store.held());
    const fresh = [...held].filter(
      (uuid) =>
        !this.unlinked.has(uuid) &&
        (this.store.peek(uuid)?.content.length ?? 0) > 0,
    );
    this.unlinked = new Set([
      ...[...this.unlinked].filter((uuid) => held.has(uuid)),
      ...fresh,
    ]);
    const deleted = new Set(this.spine.removedSinceSave());
    if (!deleted.size) return;
    fresh.forEach((uuid) => {
      const doc = this.store.peek(uuid);
      const json = doc && withoutEndNoteLinks(doc.toJSON(), deleted);
      if (json) doc.replaceContent(json);
    });
  };
}
