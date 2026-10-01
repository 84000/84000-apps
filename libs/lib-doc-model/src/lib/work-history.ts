import type { CommandLog, StructuralCommand } from './command-log';
import type { PassageDocStore } from './doc-store';
import type { EndNoteLinkUpkeep } from './end-note-link-upkeep';
import type { Spine } from './spine';
import type { FocusTarget, LabelChange } from './types';

/** Records a work's commands and replays them for undo and redo. */
export class WorkHistory {
  private spine: Spine;
  private store: PassageDocStore;
  private log: CommandLog;
  private links: EndNoteLinkUpkeep;
  private notify: () => void;

  constructor(options: {
    spine: Spine;
    store: PassageDocStore;
    log: CommandLog;
    links: EndNoteLinkUpkeep;
    notify: () => void;
  }) {
    this.spine = options.spine;
    this.store = options.store;
    this.log = options.log;
    this.links = options.links;
    this.notify = options.notify;
  }

  /** Push a structural command onto the log. */
  record(command: StructuralCommand) {
    this.log.push(command);
    // Typing next follows the command in the log, so it mustn't join the
    // stack item of typing before it.
    command.content.forEach(({ uuid }) =>
      this.store.peek(uuid)?.undoManager.stopCapturing(),
    );
  }

  /** See `WorkDocument.undo`. */
  undo(): FocusTarget | null | undefined {
    while (this.log.depth) {
      const command = this.log.popUndo();
      if (!command) return null;

      if (command.kind !== 'text') {
        this.log.suppress(() => this.applyInverse(command));
        this.log.pushRedo(command);
        this.notify();
        return command.focusAfterUndo;
      }

      const doc = this.store.peek(command.uuid);
      if (doc?.undo()) {
        this.log.pushRedo(command);
        this.notify();
        return { uuid: command.uuid, where: 'end' };
      }
      // The passage was released, taking its text history with it. Drop the
      // entry and try the one before it rather than swallowing the undo.
    }
    return null;
  }

  /** See `WorkDocument.redo`. */
  redo(): FocusTarget | null | undefined {
    while (this.log.redoDepth) {
      const command = this.log.popRedo();
      if (!command) return null;

      if (command.kind !== 'text') {
        this.log.suppress(() => this.applyForward(command));
        this.log.pushUndo(command);
        this.notify();
        return command.focusAfterRedo;
      }

      const doc = this.store.peek(command.uuid);
      // Yjs reports the redone edit as a new one, which isn't one to log.
      if (doc && this.log.suppress(() => doc.redo())) {
        this.log.pushUndo(command);
        this.notify();
        return { uuid: command.uuid, where: 'end' };
      }
    }
    return null;
  }

  /**
   * Replay a command in the direction it was originally applied.
   *
   * Order is load bearing: passages leave the spine before the surviving
   * passages take their merged content, and join it before theirs is written,
   * so no intermediate state has content without a position or the reverse.
   */
  private applyForward(command: StructuralCommand) {
    this.spine.remove(
      command.removed.map((change) => change.meta.uuid),
      { renumber: false, deleted: true },
    );
    [...command.inserted]
      .sort((a, b) => a.index - b.index)
      .forEach((change) =>
        this.spine.insert(change.meta, change.index, { renumber: false }),
      );
    command.moved.forEach((move) =>
      this.spine.move(move.uuid, move.to, { renumber: false }),
    );
    command.content.forEach((change) => {
      if (change.after === null) return;
      this.store.ensure(change.uuid).replaceContent(change.after);
    });
    this.applyLabels(command.labels, 'to');
    this.links.numberLinks(command.content.map(({ uuid }) => uuid));
    this.markRestoredDirty();
  }

  /** Replay a command backwards. The mirror of `applyForward`. */
  private applyInverse(command: StructuralCommand) {
    this.spine.remove(
      command.inserted.map((change) => change.meta.uuid),
      { renumber: false, deleted: true },
    );
    [...command.removed]
      .sort((a, b) => a.index - b.index)
      .forEach((change) =>
        this.spine.insert(change.meta, change.index, { renumber: false }),
      );
    [...command.moved]
      .reverse()
      .forEach((move) =>
        this.spine.move(move.uuid, move.from, { renumber: false }),
      );
    command.content.forEach((change) => {
      if (change.before === null) return;
      this.store.ensure(change.uuid).replaceContent(change.before);
    });
    this.applyLabels(command.labels, 'from');
    this.links.numberLinks(command.content.map(({ uuid }) => uuid));
    this.markRestoredDirty();
  }

  /**
   * A passage put back after a save deleted it may hold exactly the content
   * it had, so nothing marks it edited, yet the server no longer has it.
   */
  private markRestoredDirty() {
    this.spine
      .restoredSinceSave()
      .forEach((uuid) => this.store.peek(uuid)?.markDirty());
  }

  private applyLabels(changes: LabelChange[], side: 'from' | 'to') {
    this.spine.applyLabels(
      changes.map((change) => ({ uuid: change.uuid, label: change[side] })),
    );
  }
}
