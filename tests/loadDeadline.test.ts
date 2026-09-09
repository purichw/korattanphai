import { afterEach, expect, it, vi } from 'vitest';
import { LoadTimeoutError, withLoadDeadline } from '../src/data/loadDeadline';

afterEach(() => vi.useRealTimers());

it('settles stalled SDK promises even when they ignore cancellation', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const waiting = expect(withLoadDeadline(controller, () => new Promise(() => {}))).rejects.toBeInstanceOf(LoadTimeoutError);
  await vi.advanceTimersByTimeAsync(30_000);
  await waiting;
  expect(controller.signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('settles account cancellation immediately and clears the deadline', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const waiting = expect(withLoadDeadline(controller, () => new Promise(() => {}))).rejects.toThrow('Session changed');
  controller.abort(new Error('Session changed'));
  await waiting;
  expect(vi.getTimerCount()).toBe(0);
});
