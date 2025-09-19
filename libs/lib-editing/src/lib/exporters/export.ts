import type { Node, Mark } from '@tiptap/pm/model';

export type ExporterContext = {
  node: Node;
  parent: Node;
  mark?: Mark;
};

export type Exporter<T> = (ctx: ExporterContext) => T | undefined;
