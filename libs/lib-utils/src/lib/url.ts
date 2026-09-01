const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export const safeHref = (
  href: string | null | undefined,
): string | undefined => {
  if (!href) return undefined;

  const trimmed = href.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed, 'https://placeholder.invalid');
    if (SAFE_PROTOCOLS.has(parsed.protocol.toLowerCase())) {
      return trimmed;
    }
  } catch {
    return undefined;
  }

  return undefined;
};

/**
 * Validates a `next` destination taken from the URL before it is used as a
 * redirect target.
 *
 * `proxy.ts` puts the requested path into `?next=` when it bounces a signed-out
 * visitor to `/login`, and `authCallback` redirects there once the session
 * exists. Anything reaching a redirect from the query string is attacker
 * controllable, so only a same-origin absolute path is accepted: a leading `/`
 * that is not followed by another `/` or a backslash. That is what separates
 * `/entity/work/...` from the protocol-relative `//evil.example` and the
 * `/\evil.example` form some browsers normalize the same way.
 */
export const safeNextPath = (
  next: string | null | undefined,
): string | null => {
  if (!next || !next.startsWith('/')) {
    return null;
  }

  if (next.startsWith('//') || next.startsWith('/\\')) {
    return null;
  }

  return next;
};
