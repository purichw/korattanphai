import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useUnsavedChanges } from '../src/admin/useUnsavedChanges';

it('blocks dirty navigation/unload until a durable save explicitly permits departure', () => {
  const blocked = vi.fn();
  const { result, unmount } = renderHook(() => useUnsavedChanges(true, blocked));
  const navigate = () => window.dispatchEvent(new Event('ktp:before-navigation', { cancelable: true }));
  expect(navigate()).toBe(false);
  expect(blocked).toHaveBeenCalledOnce();
  expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false);
  act(() => result.current());
  expect(navigate()).toBe(true);
  expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
  unmount();
  expect(navigate()).toBe(true);
});

it('keeps clean screens unchanged and removes the guard after cancellation', () => {
  const { rerender, unmount } = renderHook(({ dirty }) => useUnsavedChanges(dirty, vi.fn()), { initialProps: { dirty: false } });
  const navigate = () => window.dispatchEvent(new Event('ktp:before-navigation', { cancelable: true }));
  expect(navigate()).toBe(true);
  rerender({ dirty: true });
  expect(navigate()).toBe(false);
  rerender({ dirty: false });
  expect(navigate()).toBe(true);
  unmount();
});
