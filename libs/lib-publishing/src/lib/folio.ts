/**
 * Folio side labels in 84000 style: `F.12.a`. Every layer that writes folio
 * references uses these, so a label in one file matches the same side in another.
 */

/** A folio side's label, or '' when the folio or side is missing. */
export const folioLabel = (
  folio: number | null | undefined,
  side: string | null | undefined,
): string => (folio == null || !side ? '' : `F.${folio}.${side}`);

/** A side's text on one line: its own line breaks joined by a single space. */
export const joinSideLines = (content: string | null | undefined): string =>
  (content ?? '').replace(/\s*[\r\n]+\s*/g, ' ').trim();

const LABEL = /^F\.(\d+)\.([a-z]+)$/;

/** The folio and side of a label `folioLabel` writes; null for anything else. */
export const parseFolioLabel = (
  label: string,
): { folio: number; side: string } | null => {
  const match = LABEL.exec(label.trim());
  return match ? { folio: Number(match[1]), side: match[2] } : null;
};
