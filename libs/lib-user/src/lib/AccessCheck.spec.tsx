import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  AccessCheckFailed,
  AccessCheckLoading,
  SLOW_ACCESS_CHECK_MS,
} from './AccessCheck';

describe('AccessCheckLoading', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('says so when the check runs long', () => {
    jest.useFakeTimers();
    render(<AccessCheckLoading />);
    expect(screen.getByRole('status').textContent).toContain(
      'Checking your access',
    );

    act(() => {
      jest.advanceTimersByTime(SLOW_ACCESS_CHECK_MS);
    });
    expect(screen.getByRole('status').textContent).toContain(
      'taking longer than usual',
    );
  });
});

describe('AccessCheckFailed', () => {
  it('offers a retry and a logout', () => {
    const onRetry = jest.fn();
    const onLogout = jest.fn();
    render(<AccessCheckFailed onRetry={onRetry} onLogout={onLogout} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
