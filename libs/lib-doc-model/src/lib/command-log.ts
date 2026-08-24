import type { JSONContent } from '@tiptap/core';
import type {
  FocusTarget,
  LabelChange,
  PassageMeta,
  StructuralOpKind,
} from './types';

/** A passage's content before and after an operation. `null` means it did not exist. */
export type ContentChange = {
  uuid: string;
  before: JSONContent | null;
  after: JSONContent | null;
};

/** A passage added to or removed from the spine, with the position it held. */
export type SpineChange = {
  meta: PassageMeta;
  index: number;
};

/** A passage moved within the spine. */
export type MoveChange = {
  uuid: string;
  from: number;
  to: number;
};

/**
 * One structural operation, recorded as what it changed rather than as a
 * snapshot of the work.
 *
 * The difference matters at scale: a snapshot of the spine for a ten-thousand
 * passage work is ten thousand strings, and a command log of them is
 * unaffordable. A command holds only the passages it touched and the labels it
 * rewrote, so its size is set by the operation rather than by the work.
 *
 * Every field is bidirectional, which is what makes undo and redo the same
 * code read in two directions.
 */
export type StructuralCommand = {
  kind: StructuralOpKind;
  /** Passages whose content the operation replaced. */
  content: ContentChange[];
  /** Passages the operation added to the spine. */
  inserted: SpineChange[];
  /** Passages the operation removed from the spine. */
  removed: SpineChange[];
  /** Passages the operation moved. */
  moved: MoveChange[];
  /** Labels the operation's renumbering rewrote. */
  labels: LabelChange[];
  focusAfterUndo?: FocusTarget;
  focusAfterRedo?: FocusTarget;
};

/** A text edit, recorded only so undo can interleave it with structural ops. */
export type TextCommand = {
  kind: 'text';
  uuid: string;
};

export type Command = TextCommand | StructuralCommand;

const isText = (command: Command): command is TextCommand =>
  command.kind === 'text';

/**
 * The work's undo history.
 *
 * Two kinds of thing go in it. Text edits are recorded as a passage uuid only
 * — the edit itself lives in that passage's own Yjs `UndoManager`, and the log
 * just remembers whose turn it is. Structural operations are recorded in full,
 * because no single passage's history can hold a change that spans several
 * passages and the spine.
 *
 * Interleaving them in one log is the point: typing in passage 4, splitting
 * passage 7, then typing in passage 9 must undo in that order, not in three
 * separate orders.
 */
export class CommandLog {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private suppressed = false;

  /** Record an operation, discarding the redo branch. */
  push(command: Command) {
    if (this.suppressed) return;
    this.undoStack.push(command);
    this.redoStack = [];
  }

  /** How many operations can be undone. */
  get depth(): number {
    return this.undoStack.length;
  }

  /** How many operations can be redone. */
  get redoDepth(): number {
    return this.redoStack.length;
  }

  /** The operation undo would take next, without removing it. */
  peekUndo(): Command | null {
    return this.undoStack[this.undoStack.length - 1] ?? null;
  }

  /** The operation redo would take next, without removing it. */
  peekRedo(): Command | null {
    return this.redoStack[this.redoStack.length - 1] ?? null;
  }

  /** Take the next operation to undo. */
  popUndo(): Command | null {
    return this.undoStack.pop() ?? null;
  }

  /** Take the next operation to redo. */
  popRedo(): Command | null {
    return this.redoStack.pop() ?? null;
  }

  /** Put an undone operation on the redo stack. */
  pushRedo(command: Command) {
    this.redoStack.push(command);
  }

  /** Put a redone operation back on the undo stack. */
  pushUndo(command: Command) {
    this.undoStack.push(command);
  }

  /**
   * Run `fn` without recording anything.
   *
   * Undo and redo mutate documents, and those mutations would otherwise be
   * recorded as new operations — an undo that pushes an entry the next undo
   * would then take, which never terminates.
   */
  suppress<T>(fn: () => T): T {
    const previous = this.suppressed;
    this.suppressed = true;
    try {
      return fn();
    } finally {
      this.suppressed = previous;
    }
  }

  /** Whether recording is currently suppressed. */
  get isSuppressed(): boolean {
    return this.suppressed;
  }

  /** Drop a passage's text entries — used when its document is released. */
  forgetText(uuid: string) {
    this.undoStack = this.undoStack.filter(
      (command) => !(isText(command) && command.uuid === uuid),
    );
    this.redoStack = this.redoStack.filter(
      (command) => !(isText(command) && command.uuid === uuid),
    );
  }

  /** Discard the whole history. */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
