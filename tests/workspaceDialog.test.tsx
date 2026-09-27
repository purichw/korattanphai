import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkspaceDialog } from '../src/components/WorkspaceDialog';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);
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
