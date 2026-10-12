const mockPostHog = jest.fn();
jest.mock('posthog-node', () => ({ PostHog: mockPostHog }));

const load = async () => {
  jest.resetModules();
  return import('./server-client');
};

describe('getInstrumentationClient', () => {
  const env = { ...process.env };
  beforeEach(() => {
    mockPostHog.mockClear();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });

  it('builds one client and reuses it', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'key';
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://posthog.example';
    const { getInstrumentationClient } = await load();

    expect(getInstrumentationClient()).toBe(getInstrumentationClient());
    expect(mockPostHog).toHaveBeenCalledTimes(1);
  });

  it('returns nothing and warns once when PostHog is not configured', async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    const { getInstrumentationClient } = await load();

    expect(getInstrumentationClient()).toBeUndefined();
    expect(getInstrumentationClient()).toBeUndefined();
    expect(console.warn).toHaveBeenCalledTimes(2); // key and host, once each
    expect(mockPostHog).not.toHaveBeenCalled();
  });
});
