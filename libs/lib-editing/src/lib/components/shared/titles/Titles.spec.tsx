import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Titles as TitlesData } from '@eightyfourthousand/data-access';
import { Titles } from './Titles';

const mockSaveWorkTitles = jest.fn();

jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => ({}),
  saveWorkTitles: (args: unknown) => mockSaveWorkTitles(args),
}));

// Radix's Select relies on pointer capture, scrollIntoView, and ResizeObserver,
// none of which jsdom implements. Without these the dropdown never opens and
// the type/language pickers cannot be exercised at all.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
  global.ResizeObserver = class {
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  };
});

const TITLES: TitlesData = [
  {
    uuid: 'title-1',
    title: 'The Perfection of Wisdom',
    language: 'en',
    type: 'mainTitle',
  },
  {
    uuid: 'title-2',
    title: 'Toh 12',
    language: 'en',
    type: 'toh',
  },
];

// This project does not load jest-dom, so element state is read directly.
const saveButton = () =>
  screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;

const titleInputs = () =>
  screen.getAllByPlaceholderText('Enter title') as HTMLInputElement[];

const openDialog = async (
  props: Partial<React.ComponentProps<typeof Titles>> = {},
) => {
  const onTitlesSaved = jest.fn();
  render(
    <Titles
      titles={TITLES}
      canEdit
      workUuid="work-1"
      onTitlesSaved={onTitlesSaved}
      {...props}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Edit titles' }));
  await screen.findByRole('dialog');
  return { onTitlesSaved };
};

describe('Titles edit dialog', () => {
  beforeEach(() => {
    mockSaveWorkTitles.mockReset();
    mockSaveWorkTitles.mockResolvedValue({
      inserted: 0,
      updated: 0,
      deleted: 0,
    });
  });

  it('does not offer the pencil when the user may not edit', () => {
    render(<Titles titles={TITLES} workUuid="work-1" />);
    expect(screen.queryByRole('button', { name: 'Edit titles' })).toBeNull();
  });

  it('shows one row per title, not one per language', async () => {
    await openDialog();
    expect(titleInputs().map((input) => input.value)).toEqual([
      'The Perfection of Wisdom',
      'Toh 12',
    ]);
  });

  it('updates an existing title', async () => {
    const { onTitlesSaved } = await openDialog();

    await userEvent.clear(titleInputs()[0]);
    await userEvent.type(titleInputs()[0], 'The Noble Perfection of Wisdom');
    await userEvent.click(saveButton());

    await waitFor(() => expect(mockSaveWorkTitles).toHaveBeenCalled());
    const { titles, original, workUuid } = mockSaveWorkTitles.mock.calls[0][0];
    expect(workUuid).toBe('work-1');
    expect(original).toEqual(TITLES);
    expect(titles[0]).toEqual({
      uuid: 'title-1',
      title: 'The Noble Perfection of Wisdom',
      language: 'en',
      type: 'mainTitle',
    });
    expect(onTitlesSaved).toHaveBeenCalledWith(titles);
  });

  it('adds a title', async () => {
    await openDialog();

    await userEvent.click(screen.getByRole('button', { name: /add title/i }));
    expect(titleInputs()).toHaveLength(3);

    await userEvent.type(titleInputs()[2], 'Prajñāpāramitā');
    await userEvent.click(saveButton());

    await waitFor(() => expect(mockSaveWorkTitles).toHaveBeenCalled());
    const { titles } = mockSaveWorkTitles.mock.calls[0][0];
    expect(titles).toHaveLength(3);
    expect(titles[2]).toMatchObject({
      title: 'Prajñāpāramitā',
      type: 'mainTitle',
      language: 'en',
    });
    // A new row carries a client-minted UUID so it can be inserted by key.
    expect(titles[2].uuid).toEqual(expect.any(String));
    expect(titles[2].uuid).not.toBe('');
  });

  it('removes a title', async () => {
    await openDialog();

    await userEvent.click(
      screen.getByRole('button', { name: /remove Toh 12 title/i }),
    );
    expect(titleInputs()).toHaveLength(1);

    await userEvent.click(saveButton());

    await waitFor(() => expect(mockSaveWorkTitles).toHaveBeenCalled());
    const { titles, original } = mockSaveWorkTitles.mock.calls[0][0];
    expect(titles.map((t: { uuid: string }) => t.uuid)).toEqual(['title-1']);
    expect(original).toHaveLength(2);
  });

  it('changes a title type', async () => {
    await openDialog();

    // Each row contributes a type picker then a language picker, so the second
    // row's type picker is the third combobox.
    const typePickerForSecondRow = screen.getAllByRole('combobox')[2];
    await userEvent.click(typePickerForSecondRow);
    await userEvent.click(screen.getByRole('option', { name: 'Short code' }));
    await userEvent.click(saveButton());

    await waitFor(() => expect(mockSaveWorkTitles).toHaveBeenCalled());
    const { titles } = mockSaveWorkTitles.mock.calls[0][0];
    expect(titles[1].type).toBe('shortcode');
  });

  it('refuses to save a blank title and keeps the dialog open', async () => {
    await openDialog();

    await userEvent.clear(titleInputs()[0]);
    await userEvent.click(saveButton());

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(mockSaveWorkTitles).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('surfaces a rejected write instead of reporting success', async () => {
    mockSaveWorkTitles.mockResolvedValue({
      inserted: 0,
      updated: 0,
      deleted: 0,
      error: 'new row violates row-level security policy',
    });
    const { onTitlesSaved } = await openDialog();

    await userEvent.clear(titleInputs()[0]);
    await userEvent.type(titleInputs()[0], 'Renamed');
    await userEvent.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('row-level security policy');
    expect(onTitlesSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('discards edits when the dialog is cancelled', async () => {
    await openDialog();

    await userEvent.clear(titleInputs()[0]);
    await userEvent.type(titleInputs()[0], 'Discarded');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Edit titles' }));
    await screen.findByRole('dialog');

    expect(titleInputs()[0].value).toBe('The Perfection of Wisdom');
    expect(mockSaveWorkTitles).not.toHaveBeenCalled();
  });
});
