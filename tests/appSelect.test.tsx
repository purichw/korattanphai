import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppSelect } from '../src/components/AppSelect';
import { MonthSelect } from '../src/components/MonthSelect';

afterEach(cleanup);
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
// jsdom has no scrolling layout; real menu scrolling is covered by browser QA.
beforeAll(() => Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }));
beforeAll(() => Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: true })) }));
afterAll(() => {
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
  else Reflect.deleteProperty(window, 'matchMedia');
});

const longOptions = Array.from({ length: 8 }, (_, index) => ({ value: String(3001 + index), label: `พื้นที่ ${index + 1}` }));

it('enables search for long lists, keeps short lists compact and allows an explicit override', () => {
  const { rerender } = render(<AppSelect ariaLabel="พื้นที่" value="3001" options={longOptions} onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('combobox'));
  expect(screen.getByRole('searchbox')).toHaveFocus();
  rerender(<AppSelect searchable={false} ariaLabel="พื้นที่" value="3001" options={longOptions} onChange={vi.fn()} />);
  expect(screen.queryByRole('searchbox')).toBeNull();
  rerender(<AppSelect ariaLabel="พื้นที่" value="a" options={options} onChange={vi.fn()} />);
  expect(screen.queryByRole('searchbox')).toBeNull();
  rerender(<AppSelect searchable ariaLabel="พื้นที่" value="a" options={options} onChange={vi.fn()} />);
  expect(screen.getByRole('searchbox')).toBeInTheDocument();
});

it('filters names, codes and aliases without committing or hiding disabled semantics', async () => {
  const change = vi.fn();
  render(<AppSelect searchable ariaLabel="พื้นที่" value="3001" options={[
    { value: '3001', label: 'เมืองนครราชสีมา', group: 'อำเภอ', searchText: 'Mueang' },
    { value: '3015', label: 'พิมาย', group: 'อำเภอ' },
    { value: '301501', label: 'ในเมือง', group: 'ตำบล', disabled: true },
  ]} onChange={change} />);
  const trigger = screen.getByRole('combobox');
  fireEvent.click(trigger);
  const input = screen.getByRole('searchbox');
  fireEvent.change(input, { target: { value: '๓๐๑๕' } });
  expect(screen.getAllByRole('option')).toHaveLength(2);
  expect(screen.getByRole('option', { name: 'ในเมือง' })).toHaveAttribute('aria-disabled', 'true');
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(input.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'พิมาย' }).id);
  fireEvent.change(input, { target: { value: 'ไม่มี' } });
  expect(screen.queryByRole('option')).toBeNull();
  expect(input).not.toHaveAttribute('aria-activedescendant');
  expect(screen.getByRole('status')).toHaveTextContent('ไม่พบตัวเลือก');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(change).not.toHaveBeenCalled();
  expect(trigger).toHaveTextContent('เมืองนครราชสีมา');
  fireEvent.click(screen.getByRole('button', { name: 'ล้างคำค้นตัวเลือก' }));
  expect(input).toHaveFocus();
  expect(screen.getAllByRole('option')).toHaveLength(3);
  fireEvent.change(input, { target: { value: 'MUEANG' } });
  expect(screen.getAllByRole('option')).toHaveLength(1);
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(change).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(change).toHaveBeenCalledExactlyOnceWith('3001');
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(trigger);
  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(screen.getAllByRole('option')).toHaveLength(3);
});

it('searches full or abbreviated Thai months, either calendar year and Thai digits', () => {
  render(<MonthSelect ariaLabel="เดือน" value="2025-12" options={[
    { value: '2025-12', label: 'ธ.ค. 2568' }, { value: '2025-11', label: 'พ.ย. 2568' },
  ]} onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('combobox'));
  const input = screen.getByRole('searchbox');
  for (const query of ['ธันวาคม 2568', 'ธค๒๕๖๘', '2025-12', 'dec 2025', 'ธันวาคม 2025']) {
    fireEvent.change(input, { target: { value: query } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('ธ.ค. 2568');
  }
});

it('preserves text editing keys and dismisses search before its parent dialog', () => {
  const parentEscape = vi.fn();
  render(<div onKeyDown={event => { if (event.key === 'Escape') parentEscape(); }}>
    <AppSelect searchable ariaLabel="พื้นที่" value="a" options={options} onChange={vi.fn()} />
  </div>);
  const trigger = screen.getByRole('combobox');
  fireEvent.click(trigger);
  const input = screen.getByRole('searchbox');
  expect(fireEvent.keyDown(input, { key: 'Home' })).toBe(true);
  expect(fireEvent.keyDown(input, { key: 'End' })).toBe(true);
  expect(fireEvent.keyDown(input, { key: ' ' })).toBe(true);
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(trigger).toHaveFocus();
  expect(parentEscape).not.toHaveBeenCalled();
  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(parentEscape).toHaveBeenCalledOnce();
});
const options = [{ value: 'a', label: 'First' }, { value: 'b', label: 'Second' }];

it('keeps short-menu hover and keyboard scrolling inside the menu', () => {
  const scroll = vi.mocked(HTMLElement.prototype.scrollIntoView);
  scroll.mockClear();
  render(<AppSelect ariaLabel="Choice" value="a" options={options} onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.mouseEnter(screen.getByRole('option', { name: 'Second' }));
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowUp' });
  expect(scroll).not.toHaveBeenCalled();
});

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
