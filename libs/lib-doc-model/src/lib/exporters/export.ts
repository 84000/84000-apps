import type { Node, Mark } from '@tiptap/pm/model';

export type ExporterContext = {
  passageUuid: string;
  node: Node;
  parent: Node;
  root: Node;
  start: number;
  mark?: Mark;
  /**
   * Shared collector counting annotations the exporters had to skip
   * (unlocatable node/mark, missing uuid). A non-zero count marks the
   * passage's annotation set incomplete so the save path preserves rows it
   * would otherwise treat as deleted.
   */
  skipped?: { count: number };
};

export type Exporter<T> = (ctx: ExporterContext) => T | undefined;
