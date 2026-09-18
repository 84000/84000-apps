import {
  DOMParser,
  DOMSerializer,
  Fragment,
  Slice,
  type Node as PMNode,
  type Schema,
} from '@tiptap/pm/model';

/**
 * One passage's contribution to a cross-passage selection.
 *
 * `from` and `to` are positions in that passage's own document; either may be
 * omitted to take the content through to that end. The first range in a
 * selection is trimmed at its head, the last at its tail, and everything
 * between is whole.
 */
export type PassageRange = {
  node: PMNode;
  from?: number;
  to?: number;
};

/**
 * The content of a cross-passage selection, as one slice.
 *
 * Per-passage documents have no shared coordinate space, so there is no single
 * `doc.slice(from, to)` to call — the slice is assembled from one per passage.
 * Openness comes from the ends that were actually cut: the first range's
 * `openStart` and the last range's `openEnd`. That is what makes a selection
 * starting mid-paragraph paste back as a continuation rather than as a new
 * block.
 */
export const crossPassageSlice = (ranges: PassageRange[]): Slice => {
  const slices = ranges.map(({ node, from, to }) =>
    node.slice(from ?? 0, to ?? node.content.size),
  );
  if (!slices.length) return Slice.empty;

  const content = slices.reduce(
    (all, slice) => all.append(slice.content),
    Fragment.empty,
  );
  return new Slice(
    content,
    slices[0].openStart,
    slices[slices.length - 1].openEnd,
  );
};

/**
 * The clipboard's HTML flavour for a slice.
 *
 * Deliberately plain: no `data-pm-slice`. Recording openness only pays off if
 * the paste side can clamp a parsed slice back down to it, and the function
 * that does that (`closeSlice`) is a prosemirror-view internal with no export.
 * `DOMParser.parseSlice` infers an open start anyway, which is exactly the
 * "continues the surviving head" behaviour a cross-passage paste wants — and
 * leaving the attribute off keeps the HTML clean for everything else that
 * reads this clipboard, the per-tab editor and external apps included.
 */
export const sliceToHTML = (schema: Schema, slice: Slice): string => {
  const container = document.createElement('div');
  container.appendChild(
    DOMSerializer.fromSchema(schema).serializeFragment(slice.content),
  );
  return container.innerHTML;
};

/** The clipboard's plain-text flavour, blocks separated as ProseMirror does. */
export const sliceToText = (slice: Slice): string =>
  slice.content.textBetween(0, slice.content.size, '\n\n');

/**
 * Read a pasted slice back out of HTML.
 *
 * Whatever wrote it: this path is reached for content copied from the stack,
 * from the per-tab editor and from outside the app alike, and `parseSlice`
 * treats all three the same — the schema's parse rules decide what survives.
 */
export const sliceFromHTML = (schema: Schema, html: string): Slice | null => {
  if (!html.trim()) return null;
  const container = document.createElement('div');
  container.innerHTML = html;
  const slice = DOMParser.fromSchema(schema).parseSlice(container, {
    preserveWhitespace: true,
  });
  return slice.content.size ? slice : null;
};

/**
 * A plain-text paste, as a slice.
 *
 * One text node, so a multi-line paste continues the head's last block rather
 * than becoming blocks of its own — the behaviour this path had when it took a
 * string, kept deliberately.
 */
export const sliceFromText = (schema: Schema, text: string): Slice | null =>
  text ? new Slice(Fragment.from(schema.text(text)), 0, 0) : null;
