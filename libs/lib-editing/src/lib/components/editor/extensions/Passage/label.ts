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
