import {
  normalizeToh,
  type TohokuCatalogEntry,
} from '@eightyfourthousand/data-access';
import {
  locationForPassageType,
  type PanelName,
  type TabName,
} from '../shared/types';

/**
 * Selectors for the content links a static row draws.
 *
 * Mentions carry no `type` attribute, so they are matched on their class and
 * the same-work marker instead.
 */
export const STACK_LINK_SELECTOR = [
  '[type="glossaryInstance"]',
  '[type="endNoteLink"]',
  '[type="internalLink"]',
  'a.mention-link[data-same-work="true"]',
].join(', ');

/** Where a content link goes. */
export type StackLinkTarget =
  | {
      kind: 'panel';
      panel: PanelName;
      tab: TabName;
      hash: string;
      /** The toh scope the link names, when it names one. */
      toh?: TohokuCatalogEntry;
      /** Character range to highlight in the target passage. */
      highlight?: { start: string; end: string };
    }
  | { kind: 'external'; href: string };

const attr = (el: Element, name: string) => el.getAttribute(name) ?? undefined;

/**
 * Resolve a content link on a row that carries no editor.
 *
 * Static rows are plain HTML, so the per-view listeners that handle glossary
 * instances, endnote markers, internal links and mentions in a mounted editor
 * do not exist. This reads the same intent back out of the attributes the
 * `*.ssr` renderers emit, which is what makes those attributes a contract.
 *
 * Pure: it reports where the link goes and leaves navigating to the caller,
 * because the panels are React state and a link that only rewrote the URL
 * would be overwritten the next time that state synced.
 *
 * Returns null when the element is not a content link, or names a target this
 * cannot route — better to leave a link alone than to navigate somewhere
 * arbitrary.
 */
export const resolveStackLink = (
  target: EventTarget | null,
  { editable = false }: { editable?: boolean } = {},
): StackLinkTarget | null => {
  const el = (target instanceof Element ? target : null)?.closest(
    STACK_LINK_SELECTOR,
  );
  if (!el) return null;

  const type = attr(el, 'type');

  if (type === 'glossaryInstance') {
    const glossary = attr(el, 'glossary');
    return glossary
      ? { kind: 'panel', panel: 'right', tab: 'glossary', hash: glossary }
      : null;
  }

  if (type === 'endNoteLink') {
    const endNote = attr(el, 'endNote');
    return endNote
      ? { kind: 'panel', panel: 'right', tab: 'endnotes', hash: endNote }
      : null;
  }

  if (el.getAttribute('data-same-work') !== 'true') {
    // Cross-work links open in a new tab, as they do from a mounted editor.
    const href = attr(el, 'href');
    if (!href) return null;
    return { kind: 'external', href: editable ? `${href}?edit=true` : href };
  }

  const entity = attr(el, 'entity');
  if (!entity) return null;

  const toh = normalizeToh(attr(el, 'data-link-toh') ?? null);
  const start = attr(el, 'data-highlight-start');
  const end = attr(el, 'data-highlight-end');
  const highlight =
    start !== undefined && end !== undefined ? { start, end } : undefined;

  switch (attr(el, 'entity-type')) {
    case 'bibliography':
      return {
        kind: 'panel',
        panel: 'right',
        tab: 'bibliography',
        hash: entity,
        toh,
      };
    case 'glossary':
      return {
        kind: 'panel',
        panel: 'right',
        tab: 'glossary',
        hash: entity,
        toh,
      };
    case 'folio':
      return { kind: 'panel', panel: 'main', tab: 'source', hash: entity, toh };
    case 'passage': {
      const { panel, tab } = locationForPassageType(attr(el, 'data-subtype'));
      return { kind: 'panel', panel, tab, hash: entity, toh, highlight };
    }
    default:
      return null;
  }
};
