import {
  PANEL_FOR_CONTENT_SECTION,
  PanelContentType,
  TAB_FOR_CONTENT_SECTION,
  VARIANT_TABS_FOR_TAB,
} from './types';

export const panelAndTabForContentType = (
  contentType: PanelContentType,
  desiredTab?: string,
): { panel: string; tab: string } => {
  const section = contentType.replace('Header', '');
  const panel = PANEL_FOR_CONTENT_SECTION[section] || 'main';
  const defaultTab = TAB_FOR_CONTENT_SECTION[section] || 'translation';
  const variantTabs = VARIANT_TABS_FOR_TAB[section] || [];
  const tab =
    desiredTab && variantTabs.includes(desiredTab) ? desiredTab : defaultTab;

  return { panel, tab };
};

export const urlForPanelContent = ({
  location,
  hash,
  contentType,
}: {
  location: Location;
  hash: string;
  contentType?: PanelContentType;
}): string => {
  const { href, search } = location;
  const baseUrl = new URL(href);
  const searchParams = new URLSearchParams(search);

  if (!contentType) {
    baseUrl.hash = `#${hash}`;
    return baseUrl.toString();
  }
  const { panel, tab } = panelAndTabForContentType(contentType);
  searchParams.set(panel, `open:${tab}:${hash}`);
  baseUrl.search = searchParams.toString();
  return baseUrl.toString();
};

export const urlForEntity = ({
  location,
  uuid,
  contentType,
}: {
  location: Location;
  uuid: string;
  contentType?: PanelContentType;
}): string => {
  const { href, search, host } = location;
  const searchParams = new URLSearchParams(search);

  if (!contentType) {
    const baseUrl = new URL(href);
    baseUrl.hash = `#${uuid}`;
    return baseUrl.toString();
  }

  const entityType =
    contentType === 'compare'
      ? 'translation'
      : contentType.replace('Header', '');
  const baseUrl = new URL(`${host}/entity/${entityType}/${uuid}`);
  baseUrl.search = searchParams.toString();
  return baseUrl.toString();
};
