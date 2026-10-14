import { makeAnchors } from '@eightyfourthousand/lib-utils';
import type { DataClient } from '../types';
import {
  buildMatcher,
  matchGlossaryInstances,
  type GlossaryMatch,
} from './match';
import { readResolveInput, type ResolveInput } from './read';

/** A work's glossary matches, with what is needed to review and apply them. */
export interface GlossaryPlan {
  workUuid: string;
  input: ResolveInput;
  matches: GlossaryMatch[];
  /** Passage and term uuid to the anchor the work snapshot cites it by. */
  anchors: Map<string, string>;
  /** Milliseconds spent reading and matching. */
  timings: { readMs: number; matchMs: number };
}

/** Anchors computed exactly as the work snapshot computes them, over the same uuid sets. */
export const resolveAnchors = (input: ResolveInput): Map<string, string> =>
  new Map([
    ...makeAnchors(
      input.passages.map((p) => p.uuid),
      'p',
    ),
    ...makeAnchors(
      input.terms.map((t) => t.uuid),
      'g',
    ),
  ]);

/** Reads a work's draft and matches its glossary against it. */
export const planGlossaryInstances = async ({
  client,
  workUuid,
  now = () => Date.now(),
}: {
  client: DataClient;
  workUuid: string;
  now?: () => number;
}): Promise<{ data: GlossaryPlan } | { error: string }> => {
  const started = now();
  const read = await readResolveInput({ client, workUuid });
  if ('error' in read) return read;
  const readAt = now();
  const matches = matchGlossaryInstances(
    read.data,
    buildMatcher(read.data.terms),
  );
  return {
    data: {
      workUuid,
      input: read.data,
      matches,
      anchors: resolveAnchors(read.data),
      timings: { readMs: readAt - started, matchMs: now() - readAt },
    },
  };
};
