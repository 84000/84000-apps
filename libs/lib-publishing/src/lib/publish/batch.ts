/**
 * Publishing a batch of works.
 *
 * The list handling lives here rather than in the CLI so it is testable and so a second
 * caller — a queue worker, an admin action — cannot re-derive it slightly differently.
 * `node-scripts` has no test target by design; this library does.
 */

export interface WorkRequest {
  /** Tohoku number or work uuid. */
  work: string;
  /** Explicit version label; otherwise patch-bumped from history. */
  version?: string;
  notes?: string;
  /**
   * What to call the work in output, when `work` is not the readable form.
   *
   * `--all-published` identifies works by uuid, because `works.toh` holds a joined list for
   * a multi-toh work (`toh145,toh847`) and resolution matches the column whole. The uuid is
   * unambiguous; this keeps the log readable anyway.
   */
  label?: string;
}

export interface BatchOutcome {
  ok: boolean;
  message: string;
}

export interface BatchSummary {
  succeeded: string[];
  failed: { work: string; message: string }[];
}

/**
 * Parses a `--file` payload: either a plain list of works, or objects carrying a per-work
 * version and notes.
 *
 * The object form exists because a version label is unique per work, so one shared
 * `--version` cannot serve a list.
 */
export const parseWorkList = (contents: string): WorkRequest[] => {
  const parsed: unknown = JSON.parse(contents);

  if (!Array.isArray(parsed)) {
    throw new Error(
      'Expected a JSON array of works, either ["toh1", ...] or [{ "work": "toh1" }, ...].',
    );
  }

  return parsed.map((entry, index) => {
    if (typeof entry === 'string') {
      return { work: entry };
    }
    if (
      entry &&
      typeof entry === 'object' &&
      typeof (entry as WorkRequest).work === 'string'
    ) {
      const { work, version, notes } = entry as WorkRequest;
      return { work, version, notes };
    }
    throw new Error(
      `Entry ${index} is neither a work string nor an object with a "work" property.`,
    );
  });
};

/** Drops duplicates, keeping the first occurrence and its per-work settings. */
export const dedupeRequests = (requests: WorkRequest[]): WorkRequest[] => {
  const seen = new Set<string>();
  return requests.filter((request) => {
    if (seen.has(request.work)) return false;
    seen.add(request.work);
    return true;
  });
};

/**
 * Splits a list into what still needs publishing and what a previous run already did.
 *
 * This is the resume guard, and it reads published state rather than a progress file so it
 * cannot disagree with reality. Publishing is not idempotent — every run writes a new
 * version row and an immutable artifact that cannot be cleanly removed — so re-running a
 * batch that died partway through must not republish what already succeeded.
 *
 * Reading `publishedAt` also gets the ambiguous crash-mid-work case right for free: if the
 * pointer flip committed, the work is skipped; if it did not, the work is untouched and gets
 * republished.
 */
export const partitionBySince = ({
  requests,
  published,
  since,
}: {
  requests: WorkRequest[];
  /** Live published state, keyed by either uuid or toh — whichever the caller asked with. */
  published: { uuid: string; toh: string | null; publishedAt: string | null }[];
  since: Date;
}): { todo: WorkRequest[]; skipped: WorkRequest[] } => {
  const publishedAtByKey = new Map<string, string | null>();
  for (const entry of published) {
    publishedAtByKey.set(entry.uuid, entry.publishedAt);
    if (entry.toh) publishedAtByKey.set(entry.toh, entry.publishedAt);
  }

  const todo: WorkRequest[] = [];
  const skipped: WorkRequest[] = [];

  for (const request of requests) {
    const publishedAt = publishedAtByKey.get(request.work);
    if (publishedAt && new Date(publishedAt) >= since) {
      skipped.push(request);
    } else {
      todo.push(request);
    }
  }

  return { todo, skipped };
};

/**
 * Runs `each` over every request in order, collecting outcomes.
 *
 * One work failing never aborts the batch: the works are independent, and stopping early on
 * a bulk run discards the progress already made without making anything safer. A thrown
 * error is recorded like a returned failure for the same reason.
 *
 * Sequential on purpose — `snapshot_work_version` takes locks, so there is nothing to gain
 * from racing it.
 */
export const runBatch = async ({
  requests,
  each,
  onStart,
}: {
  requests: WorkRequest[];
  each: (request: WorkRequest) => Promise<BatchOutcome>;
  onStart?: (request: WorkRequest, index: number, total: number) => void;
}): Promise<BatchSummary> => {
  const summary: BatchSummary = { succeeded: [], failed: [] };

  for (const [index, request] of requests.entries()) {
    onStart?.(request, index, requests.length);

    let outcome: BatchOutcome;
    try {
      outcome = await each(request);
    } catch (error) {
      outcome = {
        ok: false,
        message: `${request.work}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    if (outcome.ok) {
      summary.succeeded.push(request.work);
    } else {
      summary.failed.push({ work: request.work, message: outcome.message });
    }
  }

  return summary;
};
