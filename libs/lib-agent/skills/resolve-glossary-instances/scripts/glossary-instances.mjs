#!/usr/bin/env node
// Finds glossary-instance candidates in an unpacked work snapshot, and turns the
// accepted ones into apply-passage-edits ops. No dependencies.
//
//   node glossary-instances.mjs find <snapshot-dir> <out-dir> [--many 150]
//   node glossary-instances.mjs ops <out-dir> [--chunk 50]
//
// `find` writes <out-dir>/candidates.jsonl and <out-dir>/summary.json.
// `ops` reads those and the optional <out-dir>/decisions.json, and writes
// <out-dir>/ops-001.json, … each a JSON array of add-annotation edits.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SHY = '\u00ad';
const LETTER = '[\\p{L}\\p{M}\\p{N}]';
/** Passage types that are never glossed. */
const SKIP_TYPE = /Header$|^(acknowledgment|abbreviations)$/;
/** Annotations whose text is not glossed: cited titles and mantras. */
const SHELTER_TYPES = new Set(['inline-title', 'mantra']);

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
const byPassage = (rows) => {
  const map = new Map();
  for (const r of rows) {
    const range = { start: Number(r.start), end: Number(r.end) };
    map.set(r.passage, [...(map.get(r.passage) ?? []), range]);
  }
  return map;
};

/** A whole-word, case-insensitive match, with soft hyphens inside and an s/es plural. */
const formRegex = (form) => {
  const chars = [...form].map((ch) =>
    /\s/.test(ch) ? `[\\s${SHY}]+` : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  return new RegExp(
    `(?<!${LETTER}${SHY}*)${chars.join(`${SHY}*`)}(?:${SHY}*e?s)?(?!${SHY}*${LETTER})`,
    'giu',
  );
};

/** Plain lowercase single words, such as "lord" or "action", are often used in another sense. */
const isCommonWord = (form) => /^[a-z]+$/.test(form);

const find = (snap, out, many) => {
  const terms = jsonl(join(snap, 'raw/glossary.jsonl'));
  const passages = jsonl(join(snap, 'raw/passages.jsonl'));
  if (!passages.length) throw new Error(`No raw/passages.jsonl in ${snap}`);
  const info = new Map(
    tsv(join(snap, 'anchors.tsv')).map((r) => [r.anchor, r]),
  );
  const instances = tsv(join(snap, 'annotations/glossary-instances.tsv'));
  const existing = byPassage(instances);
  const other = jsonl(join(snap, 'annotations/annotations.jsonl'));
  const sheltered = byPassage(other.filter((a) => SHELTER_TYPES.has(a.type)));
  const foreign = byPassage(
    other.filter(
      (a) =>
        a.type === 'span' &&
        (a.content ?? []).some((c) => c['text-style'] === 'foreign'),
    ),
  );

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
  for (const row of instances) {
    if (stats.has(row.term)) stats.get(row.term).existing += 1;
  }
  const termFlags = new Map(terms.map((t) => [t.anchor, new Set()]));
  const skipped = {
    passageType: 0,
    title: 0,
    annotated: 0,
    sheltered: 0,
    shorter: 0,
  };
  const candidates = [];

  for (const p of passages) {
    const meta = info.get(p.anchor) ?? {};
    const hits = [];
    for (const f of forms) {
      for (const m of p.content.matchAll(f.re)) {
        hits.push({ ...f, start: m.index, end: m.index + m[0].length });
      }
    }
    // An unlabeled translation passage is the title line (or a lone marker).
    if (meta.type === 'translation' && !meta.label) {
      skipped.title += hits.length;
      continue;
    }
    if (SKIP_TYPE.test(meta.type ?? '')) {
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
        kept.push({ ...h, also: new Set(), overlap: false });
      } else if (clash.start === h.start && clash.end === h.end) {
        if (clash.term.uuid !== h.term.uuid) clash.also.add(h.term.anchor);
      } else {
        skipped.shorter += 1;
        // An overlap of equal length has no clear winner.
        if (clash.end - clash.start === h.end - h.start) clash.overlap = true;
      }
    }
    for (const k of kept.sort((a, b) => a.start - b.start)) {
      const flags = [];
      if (k.also.size || k.overlap) flags.push('ambiguous');
      if ((foreign.get(p.anchor) ?? []).some((r) => overlaps(r, k)))
        flags.push('foreign');
      if (meta.type === 'endnotes') flags.push('endnote');
      if (isCommonWord(k.form)) termFlags.get(k.term.anchor).add('common-word');
      candidates.push({
        id: `${p.anchor}:${k.start}`,
        passage: p.uuid,
        label: meta.label ?? null,
        start: k.start,
        end: k.end,
        text: p.content.slice(k.start, k.end),
        term: k.term.anchor,
        form: k.form,
        flags,
        ...(k.also.size ? { alsoMatches: [...k.also] } : {}),
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
  const count = (f) => candidates.filter((c) => c.flags.includes(f)).length;
  const summary = {
    snapshot: resolve(snap),
    terms: terms.length,
    passages: passages.length,
    candidates: candidates.length,
    ambiguous: count('ambiguous'),
    foreign: count('foreign'),
    endnotes: count('endnote'),
    flaggedTerms: [...stats.values()].filter((s) => s.flags.length).length,
    skipped,
    byTerm: [...stats.values()]
      .filter((s) => s.found)
      .sort((a, b) => b.found - a.found),
  };
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, 'candidates.jsonl'),
    candidates.map((c) => JSON.stringify(c)).join('\n') + '\n',
  );
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1));
  const { byTerm, ...head } = summary;
  console.log(JSON.stringify({ ...head, termsFound: byTerm.length }));
};

const ops = (out, chunk) => {
  const candidates = jsonl(join(out, 'candidates.jsonl'));
  const { snapshot } = JSON.parse(
    readFileSync(join(out, 'summary.json'), 'utf8'),
  );
  const terms = new Map(
    jsonl(join(snapshot, 'raw/glossary.jsonl')).map((t) => [t.anchor, t]),
  );
  const path = join(out, 'decisions.json');
  const d = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const dropTerms = new Set(d.dropTerms ?? []);
  const drop = new Set(d.drop ?? []);
  const pick = d.pick ?? {};
  // Decisions for candidates this run did not find no longer apply.
  const ids = new Set(candidates.map((c) => c.id));
  const unmatched = [
    ...[...drop, ...Object.keys(pick)].filter((id) => !ids.has(id)),
    ...[...dropTerms].filter((t) => !terms.has(t)),
  ];
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
  // Keep a passage's edits in one file: each call is all-or-nothing.
  const files = [];
  let batch = [];
  const flush = () => {
    const name = `ops-${String(files.length + 1).padStart(3, '0')}.json`;
    writeFileSync(join(out, name), JSON.stringify(batch));
    files.push({ file: name, edits: batch.length });
    batch = [];
  };
  for (const e of edits) {
    if (batch.length >= chunk && batch.at(-1).passageUuid !== e.passageUuid)
      flush();
    batch.push(e);
  }
  if (batch.length) flush();
  console.log(
    JSON.stringify({
      edits: edits.length,
      files,
      ...(unmatched.length ? { unmatched } : {}),
    }),
  );
};

const [command, a, b] = process.argv.slice(2);
if (command === 'find' && a && b) find(a, b, flag('many', 150));
else if (command === 'ops' && a) ops(a, Math.max(1, flag('chunk', 50)));
else {
  console.error(
    'usage: glossary-instances.mjs find <snapshot-dir> <out-dir> [--many N] | ops <out-dir> [--chunk N]',
  );
  process.exit(2);
}
