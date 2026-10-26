/**
 * The URL an internal link navigates to. A link with a target entity goes to
 * that entity's page. An older link carries only its stored href; hashes
 * aren't passed to the api, so they become an `xmlId` query param that the
 * redirects resolve.
 */
export const internalLinkPath = ({
  href,
  type,
  entity,
}: {
  href?: string | null;
  type?: string | null;
  entity?: string | null;
}): string => {
  if (type && entity) {
    return `/entity/${type}/${entity}`;
  }
  return (href || '#').replace('#', '?xmlId=');
};
