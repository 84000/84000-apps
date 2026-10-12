import { createServerCapture } from './server-capture';
import { getInstrumentationClient } from './server-client';

jest.mock('./server-client', () => ({
  getInstrumentationClient: jest.fn(),
}));

const mockedClient = jest.mocked(getInstrumentationClient);

const fakeClient = (captureImmediate: jest.Mock) =>
  ({ captureImmediate }) as unknown as ReturnType<
    typeof getInstrumentationClient
  >;

describe('createServerCapture', () => {
  afterEach(() => jest.resetAllMocks());

  it('does nothing when PostHog is not configured', async () => {
    mockedClient.mockReturnValue(undefined);
    const { capture, flush } = createServerCapture();

    expect(() => capture({ event: 'e', distinctId: 'u' })).not.toThrow();
    await expect(flush()).resolves.toBeUndefined();
  });

  it('sends the event with its properties', () => {
    const send = jest.fn().mockResolvedValue(undefined);
    mockedClient.mockReturnValue(fakeClient(send));

    createServerCapture().capture({
      event: 'mcp_tool_call',
      distinctId: 'user-1',
      properties: { tool_name: 'get-passage' },
    });

    expect(send).toHaveBeenCalledWith({
      distinctId: 'user-1',
      event: 'mcp_tool_call',
      properties: { tool_name: 'get-passage' },
    });
  });

  it('keeps anonymous ids from building a person profile', () => {
    const send = jest.fn().mockResolvedValue(undefined);
    mockedClient.mockReturnValue(fakeClient(send));

    createServerCapture().capture({
      event: 'e',
      distinctId: 'anonymous-1',
      anonymous: true,
    });

    expect(send.mock.calls[0][0].properties).toEqual({
      $process_person_profile: false,
    });
  });

  it('flush waits for sends in flight', async () => {
    let finish: () => void = () => undefined;
    const send = jest.fn(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    mockedClient.mockReturnValue(fakeClient(send));
    const { capture, flush } = createServerCapture();

    capture({ event: 'e', distinctId: 'u' });
    let flushed = false;
    const waiting = flush().then(() => (flushed = true));
    await Promise.resolve();
    expect(flushed).toBe(false);

    finish();
    await waiting;
    expect(flushed).toBe(true);
  });

  it('swallows a failed send, and one that throws synchronously', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementationOnce(() => {
        throw new Error('boom');
      });
    mockedClient.mockReturnValue(fakeClient(send));
    const { capture, flush } = createServerCapture();

    expect(() => {
      capture({ event: 'e', distinctId: 'u' });
      capture({ event: 'e', distinctId: 'u' });
    }).not.toThrow();
    await expect(flush()).resolves.toBeUndefined();
  });
});
