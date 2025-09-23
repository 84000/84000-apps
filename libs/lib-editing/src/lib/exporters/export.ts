import type { Node, Mark } from '@tiptap/pm/model';

export type ExporterContext = {
  node: Node;
  parent: Node;
  root: Node;
  start: number;
  mark?: Mark;
};

export type Exporter<T> = (ctx: ExporterContext) => T | undefined;
