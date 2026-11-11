import {
  elements,
  parseXml,
  textOf,
  type XmlElement,
  type XmlNode,
} from './xml';
import { readZip } from './zip';

/** One problem a check found, or one listed change. */
export interface Finding {
  /** `reject-all`, `accept-all`, `minimal`, `space`, `comments`, `parts` or `change`. */
  check: string;
  /** The package part: `document`, `endnotes`, `footnotes`, `header1` … */
  part: string;
  /** `paragraph 412`, `endnote 21`, `endnote 21, paragraph 2`; empty for the part. */
  where: string;
  problem: string;
  /** The text around the place, `[` `]` marking it; `↵` is a line break, `→` a tab. */
  context: string;
}

export interface CheckResult {
  findings: Finding[];
  /** Revisions by the author checked, and by anyone else. */
  revisions: { author: number; others: number };
}

type Mode = 'reject' | 'accept';

/** One position in a paragraph: a character, or a break, tab, note reference … */
interface Atom {
  kind: string;
  value: string;
  format: string;
}

interface Paragraph {
  where: string;
  props: string;
  atoms: Atom[];
  merge: boolean;
}

const REVISIONS = new Set([
  'w:ins',
  'w:del',
  'w:moveFrom',
  'w:moveTo',
  'w:rPrChange',
  'w:pPrChange',
]);

/** Markers with no bearing on the text: comment ranges, bookmarks, proofing. */
const IGNORED = new Set([
  'w:bookmarkStart',
  'w:bookmarkEnd',
  'w:commentRangeStart',
  'w:commentRangeEnd',
  'w:commentReference',
  'w:proofErr',
  'w:permStart',
  'w:permEnd',
  'w:moveFromRangeStart',
  'w:moveFromRangeEnd',
  'w:moveToRangeStart',
  'w:moveToRangeEnd',
  'w:lastRenderedPageBreak',
]);

/** Elements whose content is a paragraph's runs, passed through as they are. */
const WRAPPERS = new Set(['w:smartTag', 'w:customXml', 'w:sdtContent']);

const NOTE_TYPES = new Set([
  'separator',
  'continuationSeparator',
  'continuationNotice',
]);

const ignoredAttr = (name: string, element: string) =>
  /^(w:)?rsid/.test(name) ||
  name === 'w14:paraId' ||
  name === 'w14:textId' ||
  (name === 'w:id' && REVISIONS.has(element));

/** An element as a string, with attributes sorted and rsids dropped. */
function canonical(node: XmlNode): string {
  if (typeof node === 'string') return node;
  const attrs = Object.keys(node.attrs)
    .filter((a) => !ignoredAttr(a, node.name))
    .sort()
    .map((a) => ` ${a}="${node.attrs[a]}"`)
    .join('');
  return `<${node.name}${attrs}>${node.children.map(canonical).join('')}</${node.name}>`;
}

const isMarker = (parent: XmlElement | null) =>
  !!parent && /Pr$/.test(parent.name);

/** `w:ins` or `w:del` when the author inserted or deleted the paragraph mark. */
function markRevision(p: XmlElement, author: string): string | undefined {
  const props = elements(p, 'w:pPr')[0];
  const mark = props && elements(props, 'w:rPr')[0];
  return mark
    ? elements(mark).find(
        (m) =>
          (m.name === 'w:ins' || m.name === 'w:del') &&
          m.attrs['w:author'] === author,
      )?.name
    : undefined;
}

/**
 * The document as it reads with every revision by `author` rejected or
 * accepted. Other authors' revisions are left as they are.
 */
function view(el: XmlElement, mode: Mode, author: string): XmlElement {
  const ours = (e: XmlElement) => e.attrs['w:author'] === author;
  const transform = (
    node: XmlNode,
    parent: XmlElement | null,
    inDel: boolean,
  ): XmlNode[] => {
    if (typeof node === 'string') return [node];
    const children = (e: XmlElement, del = inDel) =>
      e.children.flatMap((c) => transform(c, e, del));
    if (ours(node) && !isMarker(parent)) {
      if (node.name === 'w:ins' || node.name === 'w:moveTo')
        return mode === 'reject' ? [] : children(node);
      if (node.name === 'w:del' || node.name === 'w:moveFrom')
        return mode === 'accept' ? [] : children(node, true);
    }
    if (inDel && node.name === 'w:delText')
      return [{ ...node, name: 'w:t', children: children(node) }];
    if (inDel && node.name === 'w:delInstrText')
      return [{ ...node, name: 'w:instrText', children: children(node) }];
    if (node.name === 'w:rPr') {
      const change = elements(node, 'w:rPrChange').find(ours);
      if (change && mode === 'reject') {
        const old = elements(change, 'w:rPr')[0];
        // A paragraph mark's own revision markers stay with it.
        const marks = elements(node).filter(
          (c) => c.name === 'w:ins' || c.name === 'w:del',
        );
        return [{ ...node, children: [...marks, ...(old?.children ?? [])] }];
      }
      if (change)
        return [
          { ...node, children: node.children.filter((c) => c !== change) },
        ];
    }
    if (node.name === 'w:pPr') {
      const change = elements(node, 'w:pPrChange').find(ours);
      if (change) {
        const kept = elements(node).filter(
          (c) => c.name === 'w:rPr' || c.name === 'w:sectPr',
        );
        const props =
          mode === 'reject'
            ? [...(elements(change, 'w:pPr')[0]?.children ?? []), ...kept]
            : node.children.filter((c) => c !== change);
        return [
          {
            ...node,
            children: props.flatMap((c) => transform(c, node, inDel)),
          },
        ];
      }
    }
    if (node.name === 'w:tr') {
      const rowProps = elements(node, 'w:trPr')[0];
      const marks = rowProps ? elements(rowProps).filter(ours) : [];
      const dropped = mode === 'reject' ? 'w:ins' : 'w:del';
      if (marks.some((m) => m.name === dropped)) return [];
    }
    if (node.name === 'w:p') {
      const mark = markRevision(node, author);
      const merges = mark === (mode === 'reject' ? 'w:ins' : 'w:del');
      const p = { ...node, children: children(node) };
      return [merges ? { ...p, attrs: { ...p.attrs, '#merge': '1' } } : p];
    }
    // Revision markers of the author's (a paragraph mark's, a row's) go.
    if (ours(node) && isMarker(parent) && REVISIONS.has(node.name)) return [];
    return [{ ...node, children: children(node) }];
  };
  return transform(el, null, false)[0] as XmlElement;
}

function runAtoms(run: XmlElement, out: Atom[]) {
  const props = elements(run, 'w:rPr')[0];
  const format = props && props.children.length ? canonical(props) : '';
  for (const c of elements(run)) {
    if (c.name === 'w:rPr' || IGNORED.has(c.name)) continue;
    const chars = (kind: string) => {
      for (const ch of textOf(c)) out.push({ kind, value: ch, format });
    };
    if (c.name === 'w:t') chars('t');
    else if (c.name === 'w:delText') chars('delText');
    else if (c.name === 'w:instrText') chars('instrText');
    else if (c.name === 'w:delInstrText') chars('delInstrText');
    else out.push({ kind: c.name, value: canonical(c), format });
  }
}

function contentAtoms(el: XmlElement, out: Atom[]) {
  for (const c of elements(el)) {
    if (c.name === 'w:pPr' || IGNORED.has(c.name)) continue;
    if (c.name === 'w:r') runAtoms(c, out);
    else if (WRAPPERS.has(c.name)) contentAtoms(c, out);
    else if (c.name === 'w:sdt')
      contentAtoms(elements(c, 'w:sdtContent')[0] ?? c, out);
    else if (
      c.name === 'w:hyperlink' ||
      c.name === 'w:fldSimple' ||
      REVISIONS.has(c.name)
    ) {
      // Kept revisions by others, links and simple fields bracket their runs.
      out.push({
        kind: `<${c.name}>`,
        value: canonical({ ...c, children: [] }),
        format: '',
      });
      contentAtoms(c, out);
      out.push({ kind: `</${c.name}>`, value: '', format: '' });
    } else out.push({ kind: c.name, value: canonical(c), format: '' });
  }
}

function paragraphProps(p: XmlElement): string {
  const props = elements(p, 'w:pPr')[0];
  if (!props) return '';
  return canonical({
    ...props,
    children: props.children.filter(
      (c) => typeof c !== 'string' && c.name !== 'w:rPr',
    ),
  });
}

/** Every paragraph of a part, in order, not descending into a paragraph. */
function collect(el: XmlElement, out: XmlElement[]) {
  for (const c of elements(el)) {
    if (c.name === 'w:p') out.push(c);
    else collect(c, out);
  }
}

/** A part's paragraphs, in order, each with where it is and its note. */
function locate(
  root: XmlElement,
  part: string,
): { el: XmlElement; where: string; group: number }[] {
  const groups: { label: string; ps: XmlElement[] }[] = [];
  if (part === 'footnotes' || part === 'endnotes') {
    const note = part.slice(0, -1);
    let n = 0;
    for (const el of elements(root)) {
      if (NOTE_TYPES.has(el.attrs['w:type'] ?? '')) continue;
      const ps: XmlElement[] = [];
      collect(el, ps);
      groups.push({ label: `${note} ${++n}`, ps });
    }
  } else {
    const ps: XmlElement[] = [];
    collect(root, ps);
    groups.push({ label: '', ps });
  }
  return groups.flatMap(({ label, ps }, group) =>
    ps.map((el, i) => {
      const n = `paragraph ${i + 1}`;
      const where = !label ? n : ps.length > 1 ? `${label}, ${n}` : label;
      return { el, where, group };
    }),
  );
}

/** A part's paragraphs as atoms, a paragraph whose mark is gone merged into the next. */
function paragraphs(root: XmlElement, part: string): Paragraph[] {
  const out: (Paragraph & { group: number })[] = [];
  for (const { el, where, group } of locate(root, part)) {
    const atoms: Atom[] = [];
    contentAtoms(el, atoms);
    const paragraph = {
      where,
      group,
      props: paragraphProps(el),
      atoms,
      merge: el.attrs['#merge'] === '1',
    };
    const previous = out[out.length - 1];
    if (previous?.merge && previous.group === group)
      out[out.length - 1] = {
        ...paragraph,
        where: previous.where,
        atoms: [...previous.atoms, ...atoms],
      };
    else out.push(paragraph);
  }
  return out;
}

const SHOWN: Record<string, string> = {
  'w:br': '↵',
  'w:cr': '↵',
  'w:tab': '→',
  'w:footnoteReference': '[n]',
  'w:endnoteReference': '[n]',
};

const show = (a: Atom) =>
  a.kind === 't' || a.kind === 'delText' ? a.value : (SHOWN[a.kind] ?? '');

function describe(a: Atom | undefined): string {
  if (!a) return 'the end of the paragraph';
  if (a.kind === 't') return `"${a.value}"`;
  const named: Record<string, string> = {
    'w:br': 'a line break',
    'w:cr': 'a line break',
    'w:tab': 'a tab',
    'w:footnoteReference': 'a footnote reference',
    'w:endnoteReference': 'an endnote reference',
    'w:fldChar': 'a field character',
    instrText: 'field code text',
  };
  return named[a.kind] ?? a.kind.replace(/^w:/, '');
}

function context(atoms: Atom[], at: number): string {
  const before = atoms.slice(0, at).map(show).join('').slice(-40);
  const after = atoms
    .slice(at, at + 40)
    .map(show)
    .join('')
    .slice(0, 40);
  return `${before}[]${after}`;
}

const atomKey = (a: Atom) => `${a.kind}\u0001${a.value}\u0001${a.format}`;
const STRUCTURE = new Set(['t', 'delText']);
const count = (atoms: Atom[], kinds: string[]) =>
  atoms.filter((a) => kinds.includes(a.kind)).length;

/** How a paragraph of the view differs from the original's, or null. */
function difference(
  original: Paragraph,
  other: Paragraph,
  structureOnly: boolean,
): { problem: string; context: string } | null {
  const pick = (p: Paragraph) =>
    structureOnly ? p.atoms.filter((a) => !STRUCTURE.has(a.kind)) : p.atoms;
  const key = structureOnly
    ? (a: Atom) => `${a.kind}\u0001${a.value}`
    : atomKey;
  const [a, b] = [pick(original), pick(other)];
  let i = 0;
  while (i < a.length && i < b.length && key(a[i]) === key(b[i])) i++;
  const breaks = (p: Paragraph) => count(p.atoms, ['w:br', 'w:cr']);
  const notes = ['w:footnoteReference', 'w:endnoteReference'];
  const tallies = [
    ['line breaks', breaks(original), breaks(other)],
    ['tabs', count(original.atoms, ['w:tab']), count(other.atoms, ['w:tab'])],
    [
      'note references',
      count(original.atoms, notes),
      count(other.atoms, notes),
    ],
  ]
    .filter(([, x, y]) => x !== y)
    .map(([what, x, y]) => `${what}: ${x} in the original, ${y} here`);
  let problem: string;
  if (i === a.length && i === b.length) {
    if (original.props === other.props) return null;
    problem = 'paragraph properties differ';
  } else if (
    !structureOnly &&
    a[i] &&
    b[i] &&
    a[i].kind === b[i].kind &&
    a[i].value === b[i].value
  )
    problem = `formatting differs at ${describe(a[i])}`;
  else problem = `expected ${describe(a[i])}, found ${describe(b[i])}`;
  // Report the position in the full paragraph, not the structural subset.
  const at = a[i] ? original.atoms.indexOf(a[i]) : original.atoms.length;
  return {
    problem: [problem, ...tallies].join('; '),
    context: context(original.atoms, at),
  };
}

function compare(
  check: string,
  part: string,
  original: Paragraph[],
  other: Paragraph[],
  structureOnly: boolean,
): Finding[] {
  const findings: Finding[] = [];
  const add = (where: string, problem: string, ctx: string) =>
    findings.push({ check, part, where, problem, context: ctx });
  if (original.length !== other.length) {
    let i = 0;
    while (
      i < original.length &&
      i < other.length &&
      !difference(original[i], other[i], structureOnly)
    )
      i++;
    const first = original[i] ?? original[original.length - 1];
    add(
      first?.where ?? '',
      `${original.length} paragraphs in the original, ${other.length} here; the first that differs is this one`,
      first ? context(first.atoms, 0) : '',
    );
    return findings;
  }
  original.forEach((p, i) => {
    const d = difference(p, other[i], structureOnly);
    if (d) add(p.where, d.problem, d.context);
  });
  return findings;
}

type Change = 'same' | 'ins' | 'del' | 'format';

interface Item {
  ch: string;
  change: Change;
}

const OBJECT = '\uFFFC';
const isWordChar = (ch: string | undefined) =>
  !!ch && /[\p{L}\p{M}\p{N}'’]/u.test(ch);
const stripMarks = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');

/** The paragraph's text as items, each marked with the author's change to it. */
function items(
  el: XmlElement,
  author: string,
  change: Change,
  out: Item[],
  spaces: XmlElement[],
) {
  for (const c of elements(el)) {
    if (c.name === 'w:pPr' || c.name === 'w:rPr' || IGNORED.has(c.name))
      continue;
    const ours = c.attrs['w:author'] === author;
    if (ours && (c.name === 'w:ins' || c.name === 'w:moveTo'))
      items(c, author, 'ins', out, spaces);
    else if (ours && (c.name === 'w:del' || c.name === 'w:moveFrom'))
      items(c, author, 'del', out, spaces);
    else if (c.name === 'w:r') {
      const props = elements(c, 'w:rPr')[0];
      const formatted =
        change === 'same' &&
        !!props &&
        elements(props, 'w:rPrChange').some(
          (r) => r.attrs['w:author'] === author,
        );
      const runChange = formatted ? 'format' : change;
      for (const child of elements(c)) {
        if (child.name === 'w:rPr' || IGNORED.has(child.name)) continue;
        if (child.name === 'w:t' || child.name === 'w:delText') {
          const text = textOf(child);
          if (/^\s|\s$/.test(text) && child.attrs['xml:space'] !== 'preserve')
            spaces.push(child);
          for (const ch of text) out.push({ ch, change: runChange });
        } else if (child.name === 'w:br' || child.name === 'w:cr')
          out.push({ ch: '↵', change: runChange });
        else if (child.name === 'w:tab')
          out.push({ ch: '→', change: runChange });
        else if (
          child.name !== 'w:instrText' &&
          child.name !== 'w:delInstrText'
        )
          out.push({ ch: OBJECT, change: runChange });
      }
    } else items(c, author, change, out, spaces);
  }
}

/** Why a tracked change is wider than the change, or null when it is not. */
function widerThanChange(
  deleted: string,
  inserted: string,
  before: string,
  after: string,
): string | null {
  const d = Array.from(deleted);
  const n = Array.from(inserted);
  const inner = (t: string) => t.split(/\s+/).slice(1, -1).filter(Boolean);
  const kept = inner(deleted).filter((w) => inner(inserted).includes(w));
  if (kept.length)
    return `keeps unchanged text inside the change ("${kept.join('", "')}")`;
  if (!d.length || !n.length) return null;
  let p = 0;
  while (p < d.length && p < n.length && d[p] === n[p]) p++;
  let s = 0;
  while (
    s < d.length - p &&
    s < n.length - p &&
    d[d.length - 1 - s] === n[n.length - 1 - s]
  )
    s++;
  if (!p && !s) return null;
  const dCore = d.slice(p, d.length - s).join('');
  const nCore = n.slice(p, n.length - s).join('');
  const only = `track only "${dCore}" → "${nCore}"`;
  const shared = [d.slice(0, p).join(''), d.slice(d.length - s).join('')]
    .filter(Boolean)
    .map((t) => `"${t}"`)
    .join(' and ');
  const reason =
    deleted.toLowerCase() === inserted.toLowerCase()
      ? 'a change of case'
      : stripMarks(deleted) === stripMarks(inserted)
        ? 'a diacritic'
        : !Array.from(dCore + nCore).some(isWordChar)
          ? 'a space or punctuation mark'
          : Array.from(dCore + nCore).length === 1
            ? 'a single letter'
            : null;
  if (reason) return `tracks unchanged ${shared} with ${reason}; ${only}`;
  const wholeWord =
    !/\s/.test(deleted) &&
    !/\s/.test(inserted) &&
    isWordChar(d[0]) &&
    isWordChar(d[d.length - 1]) &&
    isWordChar(n[0]) &&
    isWordChar(n[n.length - 1]) &&
    !isWordChar(Array.from(before).pop()) &&
    !isWordChar(Array.from(after)[0]);
  if (!wholeWord)
    return `tracks unchanged ${shared} and is not one whole word; ${only}, or the whole word`;
  return null;
}

/** The author's changes in one paragraph of the tracked file, as findings. */
function changesIn(
  p: XmlElement,
  where: string,
  part: string,
  author: string,
): { minimal: Finding[]; spaces: Finding[]; listed: Finding[] } {
  const list: Item[] = [];
  const spaceless: XmlElement[] = [];
  items(p, author, 'same', list, spaceless);
  const minimal: Finding[] = [];
  const listed: Finding[] = [];
  const text = (from: number, to: number) =>
    list
      .slice(Math.max(0, from), Math.max(0, to))
      .filter((i) => i.change !== 'del')
      .map((i) => i.ch)
      .join('');
  let i = 0;
  while (i < list.length) {
    if (list[i].change === 'same') {
      i++;
      continue;
    }
    const start = i;
    const kind = list[i].change === 'format' ? 'format' : 'text';
    while (
      i < list.length &&
      list[i].change !== 'same' &&
      (list[i].change === 'format') === (kind === 'format')
    )
      i++;
    const group = list.slice(start, i);
    const before = text(start - 40, start);
    const after = text(i, i + 40);
    const pick = (c: Change) =>
      group
        .filter((g) => g.change === c)
        .map((g) => g.ch)
        .join('');
    const deleted = pick('del');
    const inserted = kind === 'format' ? pick('format') : pick('ins');
    const shown =
      kind === 'format'
        ? `formatting of "${inserted}"`
        : `"${deleted}" → "${inserted}"`;
    const ctx = `${before}[${shown}]${after}`;
    listed.push({ check: 'change', part, where, problem: shown, context: ctx });
    if (kind === 'format') continue;
    const firstIns = group.findIndex((g) => g.change === 'ins');
    if (firstIns >= 0 && group.slice(firstIns).some((g) => g.change === 'del'))
      minimal.push({
        check: 'minimal',
        part,
        where,
        problem:
          'an insertion stands between two parts of one deletion; put the whole deletion first',
        context: ctx,
      });
    const wider = widerThanChange(deleted, inserted, before, after);
    if (wider)
      minimal.push({
        check: 'minimal',
        part,
        where,
        problem: wider,
        context: ctx,
      });
  }
  const spaces = spaceless.map((t) => ({
    check: 'space',
    part,
    where,
    problem: `<${t.name}> begins or ends with a space but has no xml:space="preserve"`,
    context: `[${textOf(t)}]`,
  }));
  return { minimal, spaces, listed };
}

const hasOurRevision = (el: XmlElement, author: string): boolean =>
  elements(el).some(
    (c) =>
      (REVISIONS.has(c.name) && c.attrs['w:author'] === author) ||
      hasOurRevision(c, author),
  );

function countRevisions(
  el: XmlElement,
  author: string,
  tally: CheckResult['revisions'],
) {
  for (const c of elements(el)) {
    if (REVISIONS.has(c.name))
      tally[c.attrs['w:author'] === author ? 'author' : 'others']++;
    countRevisions(c, author, tally);
  }
}

function hasComment(el: XmlElement): boolean {
  return elements(el).some(
    (c) =>
      c.name === 'w:commentRangeStart' ||
      c.name === 'w:commentReference' ||
      hasComment(c),
  );
}

/** The parts checked: the body, the notes, the headers and footers. */
const CHECKED =
  /^word\/(document|footnotes|endnotes|header\d*|footer\d*)\.xml$/;

/**
 * Check a tracked-changes copy of a Word file against the file it was made
 * from: rejecting the author's revisions gives the original, structure and
 * formatting included; accepting them keeps every line break, tab and note
 * reference; and each tracked change covers only the text that changes.
 */
export function checkTracked(
  originalDocx: Buffer,
  trackedDocx: Buffer,
  author = 'Claude',
  listChanges = false,
): CheckResult {
  const original = readZip(originalDocx);
  const tracked = readZip(trackedDocx);
  const findings: Finding[] = [];
  const revisions = { author: 0, others: 0 };
  const parts = [...original.keys()].filter((k) => CHECKED.test(k)).sort();
  for (const path of parts) {
    const part = path.replace(/^word\/|\.xml$/g, '');
    const originalXml = original.get(path);
    const trackedXml = tracked.get(path);
    if (!originalXml) continue;
    if (!trackedXml) {
      findings.push({
        check: 'parts',
        part,
        where: '',
        problem: 'missing from the tracked file',
        context: '',
      });
      continue;
    }
    const before = parseXml(originalXml.toString('utf8'));
    const after = parseXml(trackedXml.toString('utf8'));
    countRevisions(after, author, revisions);
    const base = paragraphs(before, part);
    findings.push(
      ...compare(
        'reject-all',
        part,
        base,
        paragraphs(view(after, 'reject', author), part),
        false,
      ),
      ...compare(
        'accept-all',
        part,
        base,
        paragraphs(view(after, 'accept', author), part),
        true,
      ),
    );
    const listed: Finding[] = [];
    for (const { el, where } of locate(after, part)) {
      if (!hasOurRevision(el, author)) continue;
      const r = changesIn(el, where, part, author);
      findings.push(...r.minimal, ...r.spaces);
      listed.push(...r.listed);
    }
    if (listChanges) findings.push(...listed);
    if ((part === 'endnotes' || part === 'footnotes') && hasComment(after))
      for (const note of elements(after).filter(hasComment))
        findings.push({
          check: 'comments',
          part,
          where: `${part.slice(0, -1)} id ${note.attrs['w:id']}`,
          problem:
            'a comment is anchored inside a note; anchor it on the note reference in the main text',
          context: '',
        });
  }
  return { findings, revisions };
}
