import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkspaceDialog } from '../src/components/WorkspaceDialog';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);
it('returns focus to a keyboard-accessible map shape as well as HTML controls', () => {
  const source = render(<svg><path tabIndex={0} role="button" aria-label="Boundary" d="M0 0 L10 0 L10 10 Z" /></svg>);
  const opener = screen.getByRole('button', { name: 'Boundary' });
  opener.focus();
  const focus = vi.spyOn(opener, 'focus');
  const view = render(<WorkspaceDialog title="Boundary details" onClose={() => {}}>Details</WorkspaceDialog>);
  screen.getByRole('button', { name: 'ปิดเครื่องมือแผนที่' }).focus();
  view.unmount();
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  expect(opener).toHaveFocus(); source.unmount();
});
it('keeps the modal open when its owner defers closure and closes after approved unmount', () => {
  const close = vi.fn();
  const view = render(<WorkspaceDialog title="Editing" onClose={close}><input aria-label="value" /></WorkspaceDialog>);
  const dialog = screen.getByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'ปิดเครื่องมือแผนที่' }));
  expect(close).toHaveBeenCalledOnce(); expect(dialog).toHaveAttribute('open');
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(close).toHaveBeenCalledTimes(2); expect(dialog).toHaveAttribute('open');
  view.unmount(); expect(dialog).not.toHaveAttribute('open');
});

it('describes an optional detail variant and keeps footer closure owned by its caller', () => {
  const close = vi.fn();
  render(<WorkspaceDialog title="รายละเอียดรายการ" description="ข้อมูลพื้นที่" className="cms-record-dialog" onClose={close}
    footer={<button onClick={close}>ปิด</button>}><p>300101</p></WorkspaceDialog>);
  const dialog = screen.getByRole('dialog', { name: 'รายละเอียดรายการ' });
  expect(dialog).toHaveAccessibleDescription('ข้อมูลพื้นที่');
  expect(dialog).toHaveClass('cms-record-dialog');
  fireEvent.click(screen.getByRole('button', { name: 'ปิด', exact: true }));
  expect(close).toHaveBeenCalledOnce();
  expect(dialog).toHaveAttribute('open');
});
