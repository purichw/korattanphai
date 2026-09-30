import { StrictMode, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PageLoadBoundary, usePageLoading } from '../src/components/PageLoadBoundary';
import { AppStartup } from '../src/components/AppStartup';

afterEach(() => { cleanup(); vi.useRealTimers(); });

function Read({ pending, name }: { pending: boolean; name: string }) {
  usePageLoading(pending);
  return <p>{name}</p>;
}

it('waits for all readers, including a newly mounted waterfall, without resetting children', () => {
  function Editor() {
    const [value, setValue] = useState('');
    return <input aria-label="draft" value={value} onChange={event => setValue(event.target.value)} />;
  }
  function Content({ stage }: { stage: number }) {
    return <StrictMode><PageLoadBoundary path="/admin">
      <Read pending={stage === 0} name="list" />
      {stage > 0 && <Read pending={stage === 1} name="catalog" />}
      <Editor />
    </PageLoadBoundary></StrictMode>;
  }
  const { container, rerender } = render(<Content stage={0} />);
  expect(screen.getByRole('status')).toHaveTextContent('กำลังเตรียมข้อมูลให้คุณ');
  expect(container.querySelector('.page-load-content')).toHaveAttribute('inert');
  expect(screen.queryByRole('textbox')).toBeNull();
  rerender(<Content stage={1} />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  rerender(<Content stage={2} />);
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'unsaved draft' } });
  rerender(<Content stage={1} />);
  rerender(<Content stage={2} />);
  expect(screen.getByRole('textbox')).toHaveValue('unsaved draft');
  expect(container.querySelector('.page-load-content')).not.toHaveAttribute('inert');
  expect(document.body.style.overflow).not.toBe('hidden');
});

it('releases an abandoned route and restores scrolling when the boundary unmounts', () => {
  const { rerender, unmount } = render(<PageLoadBoundary path="/"><Read pending name="departed" /></PageLoadBoundary>);
  expect(document.body.style.overflow).toBe('hidden');
  rerender(<PageLoadBoundary path="/admin"><p>ready route</p></PageLoadBoundary>);
  expect(screen.queryByRole('status')).toBeNull();
  rerender(<PageLoadBoundary path="/admin"><Read pending name="next" /></PageLoadBoundary>);
  unmount();
  expect(document.body.style.overflow).not.toBe('hidden');
});

it('offers recovery for an unusually slow startup without pretending loading has finished', () => {
  vi.useFakeTimers();
  const { container } = render(<AppStartup path="/admin" />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText('จัดการข้อมูล · นครราชสีมา')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(20_000));
  expect(screen.getByRole('button', { name: 'โหลดหน้าใหม่' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/\d+%/);
});
