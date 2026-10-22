import {
  collectionOf,
  inWitness,
  openCorpus,
  readSides,
  readTsv,
  readWitnesses,
} from './corpus';
import { join } from 'node:path';

export interface Extracted {
  /** The witness's sides, one per line as `[F.12.a] …`. */
  text: string;
  /** A one-line account of the witness and its range. */
  note: string;
  /** Other witnesses of the same Toh number that were not used. */
  others: string[];
}

const OPENING = /རྒྱ་གར་སྐད་དུ|rgya gar skad du/;
const OPENING_ALL = new RegExp(OPENING.source, 'g');

/**
 * One witness's folio range from a collection directory, trimmed at the
 * openings (rgya gar skad du) of the texts on either side.
 */
export function extract(dir: string, toh: string): Extracted {
  const place = collectionOf(dir);
  if (!place)
    throw new Error(
      `${dir} is not a collection directory of an eText download (etexts/text/<canon>/<siglum>).`,
    );
  const rows = readTsv(join(place.etexts, 'catalog', 'works.tsv')).filter(
    (w) =>
      w['collection'] === place.collection && w['toh'].split(' ').includes(toh),
  );
  if (!rows.length)
    throw new Error(`No ${toh} witness in ${place.collection}.`);
  const w = rows[0];
  // Positions come from the collection's witnesses, which place each range
  // in its folio run.
  const placed = readWitnesses(place.etexts, place.collection).find(
    (x) => x.siglum === w['siglum_number'],
  );
  if (!placed)
    throw new Error(
      `${w['siglum_number']} has no folio range (${w['boundary_status']}).`,
    );
  const [start, end] = [placed.from, placed.to];

  const lines: { ref: string; text: string }[] = [];
  for (const { vol, path } of openCorpus(dir).volumes) {
    if (vol === null || vol < start[0] || vol > end[0]) continue;
    for (const side of readSides(path)) {
      if (side.ord === null) continue;
      if (inWitness(placed, vol, side.ord))
        lines.push({ ref: side.ref, text: side.text });
    }
  }
  if (!lines.length)
    throw new Error(
      `No text for ${w['siglum_number']} in ${place.collection} vol. ${w['start_vol']}–${w['end_vol']}.`,
    );

  // Open at the first side's last rgya gar skad du (a short text before it
  // can open and close on that side), and close before the next text's on the
  // last side.
  const first = lines[0];
  const opens = [...first.text.matchAll(OPENING_ALL)].map(
    (m) => m.index as number,
  );
  const open = !opens.length
    ? -1
    : lines.length > 1
      ? opens[opens.length - 1]
      : opens[0];
  if (open > 0) first.text = first.text.slice(open);
  const last = lines[lines.length - 1];
  const close = last.text.slice(1).search(OPENING);
  if (close >= 0 && (lines.length > 1 || open >= 0))
    last.text = last.text.slice(0, close + 1).trimEnd();

  return {
    text: lines.map((l) => `[${l.ref}] ${l.text}`).join('\n') + '\n',
    note: `${w['siglum_number']} ${place.collection} vol. ${w['start_vol']} ${w['start_folio']}–${w['end_folio']} (${w['boundary_status']}): ${lines.length} sides`,
    others: rows.slice(1).map((r) => r['siglum_number']),
  };
}
