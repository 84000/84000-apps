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
