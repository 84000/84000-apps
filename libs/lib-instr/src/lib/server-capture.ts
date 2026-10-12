import { getInstrumentationClient } from './server-client';

export type ServerCaptureEvent = {
  event: string;
  /** A stable, non-sensitive id such as a user uuid; never an email or a token. */
  distinctId: string;
  properties?: Record<string, unknown>;
  /**
   * The id names no one in particular, so PostHog should not build a person
   * profile for it.
   */
  anonymous?: boolean;
};

export interface ServerCapture {
  /** Sends an event without waiting. Never throws. */
  capture: (event: ServerCaptureEvent) => void;
  /**
   * Resolves when every event captured so far has been sent or has failed, or
   * after `timeoutMs` (default 3s) if PostHog is slow, so an outage cannot
   * hold a function open on retries. Never rejects. A serverless function is
   * frozen once its response is sent, so run this after the response, e.g.
   * inside `after()`.
   */
  flush: (timeoutMs?: number) => Promise<void>;
}

/**
 * Captures server-side events on the shared PostHog client. Create one per
 * request: it tracks that request's in-flight sends so `flush` can wait on
 * them. The client is configured to send each event as it is captured, so
 * there is no batching to wait out; `flush` only covers the network call.
 *
 * Does nothing when PostHog is not configured. Analytics failures are
 * swallowed, so this is safe to call anywhere.
 */
export const createServerCapture = (): ServerCapture => {
  const pending = new Set<Promise<unknown>>();

  const capture = ({
    event,
    distinctId,
    properties,
    anonymous,
  }: ServerCaptureEvent) => {
    try {
      const client = getInstrumentationClient();
      if (!client) return;
      const sent = client
        .captureImmediate({
          distinctId,
          event,
          properties: {
            ...properties,
            ...(anonymous && { $process_person_profile: false }),
          },
        })
        .catch(() => undefined)
        .finally(() => pending.delete(sent));
      pending.add(sent);
    } catch {
      // Analytics must never break the caller.
    }
  };

  const flush = async (timeoutMs = 3000) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    });
    try {
      await Promise.race([Promise.allSettled([...pending]), timeout]);
    } finally {
      clearTimeout(timer);
    }
  };

  return { capture, flush };
};
