import { render, screen } from '@testing-library/react';
import type { Imprint } from '@eightyfourthousand/data-access';

import { BodyPanel } from './BodyPanel';
import type { TitlesRenderer } from './types';

const IMPRINT = { toh: 'toh8', mainTitles: { en: 'From the imprint' } };

jest.mock('../editor', () => ({}));
jest.mock('./NavigationProvider', () => ({
  useNavigation: () => ({
    panels: { main: { open: true, tab: 'front' } },
    imprint: IMPRINT,
    showOuterContent: true,
    updatePanel: jest.fn(),
    setHasTranslationContent: jest.fn(),
  }),
}));
jest.mock('./SourceReader', () => ({ SourceReader: () => null }));
jest.mock('./TranslationPlaceholder', () => ({
  TranslationPlaceholder: () => null,
}));
jest.mock('./Imprint', () => ({
  Imprint: () => <p>the imprint block</p>,
}));
jest.mock('./titles', () => ({
  TitleDetails: () => <p>the title details</p>,
}));
jest.mock('./hooks/useScrollPositionRestore', () => ({
  findScrollParent: () => null,
  usePassageAnchorRestore: () => ({ current: null }),
  recordPassageAnchor: jest.fn(),
  recordScrollPosition: jest.fn(),
  useScrollPositionRestore: jest.fn(),
}));

const renderPanel = (withImprint?: boolean) => {
  const renderTitles = jest.fn(({ imprint }: TitlesRenderer) => (
    <h1>
      {(imprint as Imprint | undefined)?.mainTitles?.en ?? 'titles alone'}
    </h1>
  ));
  render(
    <BodyPanel
      titles={[]}
      body={[]}
      renderTitles={renderTitles}
      renderTranslation={() => <></>}
      translationState="unpublished"
      withImprint={withImprint}
    />,
  );
  return renderTitles;
};

describe('BodyPanel imprint', () => {
  it('shows the imprint in the titles and below them by default', () => {
    const renderTitles = renderPanel();

    expect(renderTitles).toHaveBeenCalledWith(
      expect.objectContaining({ imprint: IMPRINT }),
    );
    expect(screen.getByText('From the imprint')).toBeTruthy();
    expect(screen.getByText('the imprint block')).toBeTruthy();
    expect(screen.getByText('the title details')).toBeTruthy();
  });

  it('shows the titles alone without the imprint, even when it was read', () => {
    const renderTitles = renderPanel(false);

    expect(renderTitles).toHaveBeenCalled();
    for (const [params] of renderTitles.mock.calls) {
      expect(params.imprint).toBeUndefined();
    }
    expect(screen.getByText('titles alone')).toBeTruthy();
    expect(screen.queryByText('From the imprint')).toBeNull();
    expect(screen.queryByText('the imprint block')).toBeNull();
    expect(screen.queryByText('the title details')).toBeNull();
  });
});

describe('BodyPanel tab strip', () => {
  it('sizes the tabs compactly below sm and restores the default from sm up', () => {
    renderPanel();

    // The strip shares the toolbar row with the action buttons, so on a
    // phone it must fit the room between them (no clipped "Source").
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Front',
      'Translation',
      'Source',
    ]);
    for (const tab of tabs) {
      expect(tab.className).toContain('text-xs');
      expect(tab.className).toContain('sm:text-sm');
      expect(tab.className).toContain('px-0.5');
      expect(tab.className).toContain('sm:px-1');
    }
    expect(screen.getByRole('tablist').className).toContain('gap-0.5');
    expect(screen.getByRole('tablist').className).toContain('sm:gap-3');
  });
});
