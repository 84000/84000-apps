#!/usr/bin/env node
// Finds glossary-instance candidates in an unpacked work snapshot, and turns the
// accepted ones into apply-passage-edits ops. No dependencies.
//
//   node glossary-instances.mjs find <snapshot-dir> <out-dir> [--many 150]
//   node glossary-instances.mjs ops <out-dir> [--chunk 200]
//
// `find` writes <out-dir>/candidates.jsonl and <out-dir>/summary.json.
// `ops` reads those and the optional <out-dir>/decisions.json, and writes
// <out-dir>/ops-001.json, … each a JSON array of add-annotation edits.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SHY = '­';
const LETTER = '[\\p{L}\\p{M}\\p{N}]';
/** Passage types that are never glossed. */
const SKIP_TYPE = /Header$|^(acknowledgment|abbreviations)$/;
/** Annotations whose text is not glossed: cited titles and mantras. */
const SHELTER_TYPES = new Set(['inline-title']);
const SHELTER_STYLES = new Set(['mantra']);
const styled = (a, style) =>
  a.type === 'span' && (a.content ?? []).some((c) => c['text-style'] === style);

const lines = (path) =>
  existsSync(path)
    ? readFileSync(path, 'utf8').split('\n').filter(Boolean)
    : [];
const jsonl = (path) => lines(path).map((l) => JSON.parse(l));
const tsv = (path) => {
  const [head, ...rows] = lines(path).map((l) => l.split('\t'));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
};
const flag = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? Number(process.argv[at + 1]) : fallback;
};
const overlaps = (a, b) => a.start < b.end && b.start < a.end;

/** One regex source per English form: soft hyphens anywhere, s/es plurals inside. */
const formSource = (form) =>
  [...form]
    .map((ch) =>
      /\s/.test(ch)
        ? `[\\s${SHY}]+`
        : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + `${SHY}*`,
    )
    .join('');
const formRegex = (form) =>
  new RegExp(
    `(?<!${LETTER}|${SHY})${formSource(form)}(?:e?s)?(?!${LETTER})`,
    'giu',
  );

/** Plain lowercase single words, such as "lord" or "action", are often used in another sense. */
const isCommonWord = (form) => /^[a-z]+$/.test(form);

const find = (snap, out, many) => {
  const terms = jsonl(join(snap, 'raw/glossary.jsonl'));
  const passages = jsonl(join(snap, 'raw/passages.jsonl'));
  if (!passages.length) throw new Error(`No raw/passages.jsonl in ${snap}`);
  const info = new Map(
    tsv(join(snap, 'anchors.tsv')).map((r) => [r.anchor, r]),
  );
  const byPassage = (rows) => {
    const map = new Map();
    for (const r of rows) {
      const range = { start: Number(r.start), end: Number(r.end) };
      map.set(r.passage, [...(map.get(r.passage) ?? []), range]);
    }
    return map;
  };
  const existing = byPassage(
    tsv(join(snap, 'annotations/glossary-instances.tsv')),
  );
  const other = jsonl(join(snap, 'annotations/annotations.jsonl'));
  const sheltered = byPassage(
    other.filter(
      (a) =>
        SHELTER_TYPES.has(a.type) ||
        [...SHELTER_STYLES].some((style) => styled(a, style)),
    ),
  );
  const foreign = byPassage(other.filter((a) => styled(a, 'foreign')));

  const forms = [];
  for (const t of terms) {
    const names = [t.english, ...(t.alternatives ?? '').split(/,\s+/)]
      .map((f) => (f ?? '').replaceAll(SHY, '').trim())
      .filter(Boolean);
    for (const form of new Set(names.map((f) => f.toLowerCase()))) {
      const original = names.find((f) => f.toLowerCase() === form);
      forms.push({ term: t, form: original, re: formRegex(original) });
    }
  }

  const stats = new Map(
    terms.map((t) => [
      t.anchor,
      { term: t.anchor, english: t.english, existing: 0, found: 0, flags: [] },
    ]),
  );
  for (const rows of [...tsv(join(snap, 'annotations/glossary-instances.tsv'))])
    if (stats.has(rows.term)) stats.get(rows.term).existing += 1;
  const skipped = { passageType: 0, annotated: 0, sheltered: 0, shorter: 0 };
  const termFlags = new Map(terms.map((t) => [t.anchor, new Set()]));
  const candidates = [];

  for (const p of passages) {
    const meta = info.get(p.anchor) ?? {};
    const title = meta.type === 'translation' && !meta.label;
    const hits = [];
    for (const f of forms) {
      for (const m of p.content.matchAll(f.re)) {
        hits.push({ ...f, start: m.index, end: m.index + m[0].length });
      }
    }
    if (SKIP_TYPE.test(meta.type ?? '') || title) {
      skipped.passageType += hits.length;
      continue;
    }
    hits.sort(
      (a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start,
    );
    const kept = [];
    for (const h of hits) {
      if ((existing.get(p.anchor) ?? []).some((r) => overlaps(r, h))) {
        skipped.annotated += 1;
        continue;
      }
      if ((sheltered.get(p.anchor) ?? []).some((r) => overlaps(r, h))) {
        skipped.sheltered += 1;
        continue;
      }
      const clash = kept.find((k) => overlaps(k, h));
      if (!clash) {
        kept.push({ ...h, others: [] });
      } else if (clash.end - clash.start > h.end - h.start) {
        skipped.shorter += 1;
      } else if (
        clash.term.uuid !== h.term.uuid &&
        !clash.others.some((o) => o.term.uuid === h.term.uuid)
      ) {
        clash.others.push(h);
      }
    }
    for (const k of kept.sort((a, b) => a.start - b.start)) {
      const flags = [];
      if (k.others.length) flags.push('ambiguous');
      if ((foreign.get(p.anchor) ?? []).some((r) => overlaps(r, k)))
        flags.push('foreign');
      if (isCommonWord(k.form)) termFlags.get(k.term.anchor).add('common-word');
      candidates.push({
        id: candidates.length + 1,
        passage: p.uuid,
        anchor: p.anchor,
        label: meta.label ?? null,
        start: k.start,
        end: k.end,
        text: p.content.slice(k.start, k.end),
        term: k.term.anchor,
        form: k.form,
        flags,
        ...(k.others.length
          ? { alsoMatches: k.others.map((o) => o.term.anchor) }
          : {}),
        context: p.content
          .slice(Math.max(0, k.start - 60), k.end + 60)
          .replaceAll(SHY, ''),
      });
      stats.get(k.term.anchor).found += 1;
    }
  }

  for (const s of stats.values()) {
    if (s.found > many) termFlags.get(s.term).add('many-hits');
    s.flags = [...termFlags.get(s.term)];
  }
  const termById = new Map(terms.map((t) => [t.anchor, t]));
  const summary = {
    snapshot: snap,
    terms: terms.length,
    passages: passages.length,
    candidates: candidates.length,
    flagged: candidates.filter((c) => c.flags.length).length,
    flaggedTerms: [...stats.values()].filter((s) => s.flags.length).length,
    skipped,
    byTerm: [...stats.values()]
      .filter((s) => s.found)
      .sort((a, b) => b.found - a.found),
    unfound: [...stats.values()]
      .filter((s) => !s.found && !s.existing)
      .map((s) => `${s.term} ${termById.get(s.term)?.english ?? ''}`.trim()),
  };
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, 'candidates.jsonl'),
    candidates.map((c) => JSON.stringify(c)).join('\n') + '\n',
  );
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1));
  writeFileSync(join(out, 'terms.json'), JSON.stringify(terms));
  const { byTerm, unfound, ...head } = summary;
  console.log(
    JSON.stringify({
      ...head,
      termsFound: byTerm.length,
      unfound: unfound.length,
    }),
  );
};

const ops = (out, chunk) => {
  const candidates = jsonl(join(out, 'candidates.jsonl'));
  const terms = new Map(
    JSON.parse(readFileSync(join(out, 'terms.json'), 'utf8')).map((t) => [
      t.anchor,
      t,
    ]),
  );
  const path = join(out, 'decisions.json');
  const d = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const dropTerms = new Set(d.dropTerms ?? []);
  const drop = new Set(d.drop ?? []);
  const pick = d.pick ?? {};
  const edits = [];
  for (const c of candidates) {
    const anchor = pick[c.id] ?? c.term;
    if (drop.has(c.id) || dropTerms.has(anchor) || anchor === 'none') continue;
    const t = terms.get(anchor);
    if (!t) throw new Error(`Candidate ${c.id}: unknown term ${anchor}`);
    edits.push({
      op: 'add-annotation',
      passageUuid: c.passage,
      kind: 'glossary-instance',
      start: c.start,
      end: c.end,
      text: c.text,
      data: { glossary: t.uuid, authority: t.authority },
    });
  }
  // Keep a passage's edits in one chunk: each call is all-or-nothing.
  const files = [];
  let batch = [];
  const flush = () => {
    if (!batch.length) return;
    const name = `ops-${String(files.length + 1).padStart(3, '0')}.json`;
    writeFileSync(join(out, name), JSON.stringify(batch));
    files.push({ file: name, edits: batch.length });
    batch = [];
  };
  for (const e of edits) {
    const last = batch[batch.length - 1];
    if (batch.length >= chunk && last?.passageUuid !== e.passageUuid) flush();
    batch.push(e);
  }
  flush();
  console.log(JSON.stringify({ edits: edits.length, files }));
};

const [command, a, b] = process.argv.slice(2);
if (command === 'find' && a && b) find(a, b, flag('many', 150));
else if (command === 'ops' && a) ops(a, flag('chunk', 200));
else {
  console.error(
    'usage: glossary-instances.mjs find <snapshot-dir> <out-dir> [--many N] | ops <out-dir> [--chunk N]',
  );
  process.exit(2);
}
