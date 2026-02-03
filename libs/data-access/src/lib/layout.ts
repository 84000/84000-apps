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
  console.log(contentType);
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
  console.log(baseUrl.toString());
  return baseUrl.toString();
};
