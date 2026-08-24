/**
 * Passage labels.
 *
 * A label is a dotted numeric path — `"1"`, `"1.5"`, `"2.3.1"`. These are pure
 * string functions with no editor dependency, which is why they live here
 * rather than beside the TipTap Passage extension they used to sit in: the
 * per-passage document model and the server-side write path both renumber
 * labels, and neither can import an editor.
 */

/**
 * Increment the numeric component of a passage label at the given depth.
 * If depth is -1 (default), increments the last component.
 *
 * Examples:
 *   incrementLabel("1.5")      → "1.6"
 *   incrementLabel("3")        → "4"
 *   incrementLabel("1.5", 0)   → "2.5"
 */
export const incrementLabel = (label: string, depth = -1) => {
  const labelParts: (string | number)[] = ((label as string) || '').split('.');
  const index = depth === -1 ? labelParts.length - 1 : depth;
  const toIncrement = `${labelParts[index]}` || '0';
  const newVal = Number.parseInt(toIncrement) + 1;
  labelParts[index] = newVal;

  return labelParts.join('.');
};

/**
 * Decrement the numeric component of a passage label at the given depth.
 * If depth is -1 (default), decrements the last component.
 * Guards against going below 0.
 *
 * Examples:
 *   decrementLabel("1.5")      → "1.4"
 *   decrementLabel("3")        → "2"
 *   decrementLabel("1.0")      → "1.0"  (clamped at 0)
 *   decrementLabel("1.5", 0)   → "0.5"
 */
export const decrementLabel = (label: string, depth = -1) => {
  const labelParts: (string | number)[] = ((label as string) || '').split('.');
  const index = depth === -1 ? labelParts.length - 1 : depth;
  const toDecrement = `${labelParts[index]}` || '0';
  const newVal = Math.max(0, Number.parseInt(toDecrement) - 1);
  labelParts[index] = newVal;

  return labelParts.join('.');
};

/**
 * Renumber the run of labels that follows `anchorIndex`, returning only the
 * ones that changed.
 *
 * The run is the sequence of labels at the anchor's own depth sharing the
 * anchor's parent prefix. Deeper labels are skipped over (a sub-numbered
 * passage keeps its number while its siblings shift around it); a shallower
 * label, or one under a different parent, ends the run — the anchor's sequence
 * does not reach past it.
 *
 * Renumbering also stops as soon as a label already holds the value it would
 * be given, because from there on the rest of the run is already consistent.
 * That early exit is what keeps a split near the top of a thousand-passage
 * work from rewriting every label below it.
 *
 * Returns a sparse map of index → new label rather than a whole list, so the
 * caller writes only the entries that moved.
 */
export const renumberLabelsFrom = (
  labels: string[],
  anchorIndex: number,
): Map<number, string> => {
  const changed = new Map<number, string>();
  const anchor = labels[anchorIndex];
  if (!anchor) return changed;

  const parts = anchor.split('.');
  const depth = parts.length;
  const prefix = depth > 1 ? `${parts.slice(0, -1).join('.')}.` : '';

  let expected = incrementLabel(anchor);
  for (let i = anchorIndex + 1; i < labels.length; i++) {
    const label = labels[i];
    if (!label) continue;

    const labelDepth = label.split('.').length;
    // Shallower means we have left the anchor's sequence entirely.
    if (labelDepth < depth) break;
    // Deeper means a child of the passage above; it renumbers with its own
    // parent, not with this run.
    if (labelDepth > depth) continue;
    if (prefix && !label.startsWith(prefix)) break;
    if (label === expected) break;

    changed.set(i, expected);
    expected = incrementLabel(expected);
  }

  return changed;
};
