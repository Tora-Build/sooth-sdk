import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pollWhileVisible } from '../../src/react/visibility.js';

let hidden = false;
const setHidden = (value: boolean) => {
  hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('pollWhileVisible', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls while visible, skips hidden ticks and loads once when shown again', () => {
    const load = vi.fn();
    const stop = pollWhileVisible(load, 1_000);
    vi.advanceTimersByTime(2_000);
    expect(load).toHaveBeenCalledTimes(2);
    setHidden(true);
    vi.advanceTimersByTime(5_000);
    expect(load).toHaveBeenCalledTimes(2);
    setHidden(false);
    expect(load).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(1_000);
    expect(load).toHaveBeenCalledTimes(4);
    stop();
  });

  it('does not load on show when no tick was skipped', () => {
    const load = vi.fn();
    const stop = pollWhileVisible(load, 1_000);
    setHidden(true);
    setHidden(false);
    expect(load).not.toHaveBeenCalled();
    stop();
  });

  it('stops polling and listening when stopped', () => {
    const load = vi.fn();
    const stop = pollWhileVisible(load, 1_000);
    stop();
    vi.advanceTimersByTime(3_000);
    setHidden(true);
    vi.advanceTimersByTime(3_000);
    setHidden(false);
    expect(load).not.toHaveBeenCalled();
  });
});
