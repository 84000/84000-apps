#!/usr/bin/env python3
"""Folio reference audit: compare a work's expected folios with its folio mentions.

Deterministic, read-only. Feed it the studio's own read results, saved as files:

    python3 folio_audit.py --folios F1.json [F2.json ...] --passages P1.json [P2.json ...]
                           [--sibling-toh toh82 ...] [--json]

--folios    every page of `get-translation-folios` for ONE Tohoku number, in page
            order. Each file is either the tool result as saved by the client (a
            JSON array of {type, text} items; trailing non-JSON notices are
            ignored) or the plain JSON object the tool returned. Folio `content`
            is not read, so an abridged {"toh": ..., "folios": [{uuid, volume,
            folio, side}, ...]} is enough.
--passages  every page of `get-translation-passages` for the work (all passage
            types, alignments off), in page order. Same two formats.
--sibling-toh  other Tohoku numbers the work is catalogued under. Mentions whose
            linkToh is one of these belong to that number's audit and are skipped.
--json      print the result as JSON instead of the human report.

Only zero-length `mention` annotations with linkType "folio" count as found.
"""
import argparse
import json
import sys
from collections import defaultdict


def load(path):
    with open(path, encoding='utf-8') as fh:
        data = json.load(fh)
    if isinstance(data, list):  # client-saved MCP result: [{type, text}, ...]
        for item in data:
            text = item.get('text', '') if isinstance(item, dict) else ''
            if text.lstrip().startswith('{'):
                return json.loads(text)
        sys.exit(f'{path}: no JSON object found in the saved tool result')
    return data


def label(f):
    return f"F.{f['folio']}.{f['side']}"


def audit(folio_pages, passage_pages, sibling_tohs=()):
    tohs = {p.get('toh') for p in folio_pages if p.get('toh')}
    if len(tohs) != 1:
        sys.exit(f'--folios must all come from one Tohoku number, got {sorted(tohs)}')
    toh = tohs.pop()
    folios = [f for p in folio_pages for f in p['folios']]
    idx = {f['uuid']: i for i, f in enumerate(folios)}
    if len(idx) != len(folios):
        sys.exit('duplicate folio uuids across --folios pages: a page was saved twice')

    passages = {}
    for page in passage_pages:
        for p in page['passages']:
            passages[p['uuid']] = p
    passages = sorted(passages.values(), key=lambda p: p['sort'])
    order = {p['uuid']: i for i, p in enumerate(passages)}
    first_tr = next((p for p in passages if p['type'] == 'translation'
                     and 'body-title' not in (p.get('xmlId') or '')), None)

    errors, warnings, found = [], [], []

    def flag(bucket, kind, msg, **ctx):
        bucket.append({'kind': kind, 'message': msg, **ctx})

    for p in passages:
        content = p['content']
        for a in p.get('annotations', []):
            if a.get('type') != 'mention' or a.get('linkType') != 'folio':
                continue
            if a.get('linkToh') in sibling_tohs:
                continue
            f = folios[idx[a['entity']]] if a.get('entity') in idx else None
            m = {
                'label': label(f) if f else None,
                'folioUuid': a.get('entity'),
                'annotationUuid': a['uuid'],
                'passageUuid': p['uuid'],
                'passageLabel': p.get('label') or '',
                'passageType': p['type'],
                'xmlId': p.get('xmlId'),
                'start': a['start'],
                'end': a['end'],
                'passageLength': len(content),
                'linkToh': a.get('linkToh'),
                'isSameWork': a.get('isSameWork'),
                'context': content[max(0, a['start'] - 60):a['start']] + '‖' + content[a['start']:a['start'] + 40],
            }
            found.append(m)
            where = f"{m['label'] or '?'} in passage {m['passageLabel'] or '(no label)'} @{m['start']}"
            ctx = {'passageUuid': m['passageUuid'], 'annotationUuid': m['annotationUuid']}
            if m['start'] != m['end']:
                flag(errors, 'malformed', f"{where}: not zero-length ({m['start']}–{m['end']}); not counted as found", **ctx)
                continue
            if f is None:
                flag(errors, 'foreign', f"mention in passage {m['passageLabel']} @{m['start']} points at folio "
                     f"{m['folioUuid']}, which is not a folio of {toh}", folioUuid=m['folioUuid'], **ctx)
                continue
            if m['linkToh'] != toh:
                flag(warnings, 'toh-field', f"{where}: linkToh is {m['linkToh']!r}, expected {toh!r}", **ctx)
            if m['isSameWork'] is not True:
                flag(warnings, 'same-work-field', f"{where}: isSameWork is {m['isSameWork']!r}, expected true", **ctx)
            if m['passageType'] != 'translation':
                flag(errors, 'outside-translation', f"{where}: sits in a '{m['passageType']}' passage", **ctx)
            if m['start'] == 0 and (first_tr is None or p['uuid'] != first_tr['uuid']):
                prev = next((q for q in reversed(passages[:order[p['uuid']]]) if q['type'] == 'translation'), None)
                target = prev and {'passageUuid': prev['uuid'], 'passageLabel': prev.get('label') or '',
                                   'offset': len(prev['content'])}
                flag(errors, 'offset-0', f"{where}: offset 0 is allowed only in the first translation passage "
                     f"({first_tr.get('label') if first_tr else '?'}); move to the end of the previous non-heading "
                     f"passage" + (f" — {target['passageLabel']} @{target['offset']}" if target else ''),
                     suggestedTarget=target, **ctx)

    valid = [m for m in found if m['start'] == m['end'] and m['label']]
    by_folio = defaultdict(list)
    for m in valid:
        by_folio[m['folioUuid']].append(m)

    missing = []
    for i, f in enumerate(folios):
        hits = by_folio.get(f['uuid'], [])
        if not hits:
            prev_m = next((by_folio[g['uuid']][-1] for g in reversed(folios[:i]) if by_folio.get(g['uuid'])), None)
            next_m = next((by_folio[g['uuid']][0] for g in folios[i + 1:] if by_folio.get(g['uuid'])), None)
            entry = {'label': label(f), 'folioUuid': f['uuid'], 'volume': f['volume'],
                     'previousFolio': folios[i - 1]['uuid'] if i > 0 else None,
                     'searchFrom': prev_m and {'label': prev_m['label'], 'passageUuid': prev_m['passageUuid'], 'passageLabel': prev_m['passageLabel'], 'offset': prev_m['start']},
                     'searchTo': next_m and {'label': next_m['label'], 'passageUuid': next_m['passageUuid'], 'passageLabel': next_m['passageLabel'], 'offset': next_m['start']}}
            lo = order.get(prev_m['passageUuid'], 0) if prev_m else 0
            hi = order.get(next_m['passageUuid'], len(passages) - 1) if next_m else len(passages) - 1
            entry['windowPassageUuids'] = [q['uuid'] for q in passages[lo:hi + 1]
                                           if q['type'] == 'translation' and 'body-title' not in (q.get('xmlId') or '')]
            missing.append(entry)
            flag(errors, 'missing', f"{label(f)} (vol. {f['volume']}) has no mention; search between "
                 f"{prev_m['label'] + ' (' + prev_m['passageLabel'] + ')' if prev_m else 'the start'} and "
                 f"{next_m['label'] + ' (' + next_m['passageLabel'] + ')' if next_m else 'the end'}", folioUuid=f['uuid'])
        elif len(hits) > 1:
            flag(errors, 'duplicate', f"{label(f)} has {len(hits)} mentions: " +
                 ', '.join(f"{h['passageLabel']}@{h['start']}" for h in hits),
                 folioUuid=f['uuid'], annotationUuids=[h['annotationUuid'] for h in hits])

    seq = [(idx[m['folioUuid']], m) for m in valid]
    for (pi, pm), (ci, cm) in zip(seq, seq[1:]):
        if ci < pi:
            flag(errors, 'out-of-order', f"{cm['label']} in passage {cm['passageLabel']} @{cm['start']} comes after "
                 f"{pm['label']} ({pm['passageLabel']} @{pm['start']})", passageUuid=cm['passageUuid'],
                 annotationUuid=cm['annotationUuid'])

    return {'toh': toh, 'expected': len(folios), 'found': found, 'missing': missing,
            'errors': errors, 'warnings': warnings,
            'firstTranslationPassage': first_tr and {'uuid': first_tr['uuid'], 'label': first_tr.get('label')},
            'passagesRead': len(passages)}


def report(r):
    out = [f"Folio reference audit — {r['toh']}",
           f"{r['expected']} folios expected · {len(r['found'])} folio mentions found · "
           f"{len(r['errors'])} errors · {len(r['warnings'])} warnings · {r['passagesRead']} passages read", '',
           'Mentions in reading order:']
    for m in r['found']:
        out.append(f"  {(m['label'] or '?'):<9} {m['passageLabel'] or '(no label)':<10} @{m['start']}/{m['passageLength']}  …{m['context']}…")
    for title, items in (('Errors', r['errors']), ('Warnings', r['warnings'])):
        out += ['', f'{title}:'] + ([f"  [{e['kind']}] {e['message']}" for e in items] or ['  none'])
    return '\n'.join(out)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--folios', nargs='+', required=True)
    ap.add_argument('--passages', nargs='+', required=True)
    ap.add_argument('--sibling-toh', nargs='+', default=[])
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    result = audit([load(p) for p in a.folios], [load(p) for p in a.passages], set(a.sibling_toh))
    print(json.dumps(result, ensure_ascii=False, indent=2) if a.json else report(result))
