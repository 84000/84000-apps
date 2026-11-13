import type {
  DataClient,
  GlossaryEntry,
} from '@eightyfourthousand/data-access';

import {
  GlossaryEntryPanelState,
  saveGlossaryEntryPanelChange,
} from './glossary-entry-panel';

const mockSave = jest.fn();
const mockRead = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  saveGlossaryEntry: (args: unknown) => mockSave(args),
  getGlossaryEntry: (args: unknown) => mockRead(args),
}));

const client = {} as DataClient;

const entry = (overrides: Partial<GlossaryEntry> = {}): GlossaryEntry => ({
  uuid: 'e1',
  workUuid: 'w1',
  authorityUuid: 'a1',
  definition: '<p>A god.</p>',
  definitionRend: null,
  glossMode: 'match',
  names: [],
  ...overrides,
});

beforeEach(() => {
  mockSave.mockReset();
  mockRead.mockReset();
});

describe('GlossaryEntryPanelState', () => {
  it('opens on an entry and closes', () => {
    const panel = new GlossaryEntryPanelState();
    const listener = jest.fn();
    panel.subscribe(listener);
    panel.open('e1');
    expect(panel.get()).toBe('e1');
    panel.close();
    expect(panel.get()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('saveGlossaryEntryPanelChange', () => {
  it('saves the change against the entry as read', async () => {
    const saved = entry({ glossMode: 'marked' });
    mockSave.mockResolvedValue({ success: true, entries: [saved] });
    const before = entry();
    const outcome = await saveGlossaryEntryPanelChange({
      client,
      before,
      after: { glossMode: 'marked' },
    });
    expect(outcome).toEqual({ status: 'saved', entry: saved });
    expect(mockSave).toHaveBeenCalledWith({
      client,
      workUuid: 'w1',
      before,
      after: { glossMode: 'marked' },
    });
  });

  it('is a conflict with the stored entry when the save is stale', async () => {
    const theirs = entry({ definitionRend: 'overrideWithStandard' });
    mockSave.mockResolvedValue({
      success: false,
      reason: 'stale',
      error: 'changed',
    });
    mockRead.mockResolvedValue({ status: 'found', entry: theirs });
    expect(
      await saveGlossaryEntryPanelChange({
        client,
        before: entry(),
        after: { definitionRend: 'appendWithStandard' },
      }),
    ).toEqual({ status: 'conflict', theirs });
  });

  it('is a conflict with nothing when the entry was deleted', async () => {
    mockSave.mockResolvedValue({
      success: false,
      reason: 'not-found',
      error: 'gone',
    });
    mockRead.mockResolvedValue({ status: 'not-found' });
    expect(
      await saveGlossaryEntryPanelChange({
        client,
        before: entry(),
        after: { glossMode: 'marked' },
      }),
    ).toEqual({ status: 'conflict', theirs: null });
  });

  it('is saved when an unknown outcome reads back as the change', async () => {
    const stored = entry({ glossMode: 'marked' });
    mockSave.mockResolvedValue({
      success: false,
      reason: 'failed',
      error: 'timeout',
      outcomeUnknown: true,
    });
    mockRead.mockResolvedValue({ status: 'found', entry: stored });
    expect(
      await saveGlossaryEntryPanelChange({
        client,
        before: entry(),
        after: { glossMode: 'marked' },
      }),
    ).toEqual({ status: 'saved', entry: stored });
  });

  it('fails with the reason otherwise', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockSave.mockResolvedValue({
      success: false,
      reason: 'forbidden',
      error: 'Not allowed',
      outcomeUnknown: false,
    });
    expect(
      await saveGlossaryEntryPanelChange({
        client,
        before: entry(),
        after: { glossMode: 'marked' },
      }),
    ).toEqual({ status: 'failed', error: 'Not allowed' });
    expect(mockRead).not.toHaveBeenCalled();
  });
});
