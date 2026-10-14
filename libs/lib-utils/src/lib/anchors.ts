/**
 * Short, unique anchors for passages, glossary terms and bibliography entries, as
 * the work snapshot and the glossary resolver cite them.
 *
 * An anchor is `<prefix>-<first N hex digits of the uuid>`. N starts at
 * `MIN_ANCHOR_HEX`; only uuids that share a prefix get a longer one, so a single
 * collision never changes the anchors of the rest of the work. Within one call no anchor
 * is a prefix of another.
 */

export const MIN_ANCHOR_HEX = 8;
const MAX_ANCHOR_HEX = 32;

const hexOf = (uuid: string): string => uuid.replace(/-/g, '').toLowerCase();

/** Maps each uuid to its anchor. Duplicate uuids share one anchor. */
export const makeAnchors = (
  uuids: readonly string[],
  prefix: string,
): Map<string, string> => {
  const anchors = new Map<string, string>();
  const unique = [...new Set(uuids)];

  const assign = (group: string[], length: number) => {
    if (length >= MAX_ANCHOR_HEX || group.length === 1) {
      for (const uuid of group) {
        anchors.set(uuid, `${prefix}-${hexOf(uuid).slice(0, length)}`);
      }
      return;
    }
    const byPrefix = new Map<string, string[]>();
    for (const uuid of group) {
      const key = hexOf(uuid).slice(0, length);
      byPrefix.set(key, [...(byPrefix.get(key) ?? []), uuid]);
    }
    for (const members of byPrefix.values()) {
      if (members.length === 1) {
        anchors.set(
          members[0],
          `${prefix}-${hexOf(members[0]).slice(0, length)}`,
        );
      } else {
        assign(members, length + 1);
      }
    }
  };

  assign(unique, MIN_ANCHOR_HEX);
  return anchors;
};

/** The anchor a snapshot line starts with, e.g. `p-df68f324` from `[p-df68f324 1.2] …`. */
export const anchorOfLine = (line: string): string | null =>
  /^\[([a-z]-[0-9a-f]+)[\s\]]/.exec(line)?.[1] ?? null;
