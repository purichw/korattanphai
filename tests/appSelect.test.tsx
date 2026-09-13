import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppSelect } from '../src/components/AppSelect';

afterEach(cleanup);
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
// jsdom has no scrolling layout; real menu scrolling is covered by browser QA.
beforeAll(() => Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }));
afterAll(() => {
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});
const options = [{ value: 'a', label: 'First' }, { value: 'b', label: 'Second' }];

it('keeps Escape local only while the custom listbox is open', () => {
  const parentEscape = vi.fn();
  render(<div onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) parentEscape(); }}>
    <AppSelect ariaLabel="Choice" value="a" options={options} onChange={vi.fn()} />
  </div>);
  const trigger = screen.getByRole('combobox');
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(parentEscape).not.toHaveBeenCalled();
  expect(trigger).toHaveFocus();
  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(parentEscape).toHaveBeenCalledOnce();
});

it('returns focus from the mobile close control without scrolling', () => {
  render(<AppSelect ariaLabel="Choice" value="a" options={options} onChange={vi.fn()} />);
  const trigger = screen.getByRole('combobox');
  fireEvent.click(trigger);
  const close = screen.getByRole('button', { name: 'ปิดตัวเลือก' });
  close.focus();
  const focus = vi.spyOn(trigger, 'focus');
  fireEvent.click(close);
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(trigger).toHaveFocus();
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
});

it('keeps product select and listbox markup in the shared custom owner', () => {
  const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? files(file) : file.endsWith('.tsx') ? [file] : [];
  });
  for (const file of files('src')) {
    const source = readFileSync(file, 'utf8');
    expect(source, file).not.toMatch(/<\s*(?:select|datalist)\b/);
    if (!file.endsWith('/AppSelect.tsx')) expect(source, file).not.toMatch(/role=["'](?:combobox|listbox)["']/);
  }
});
