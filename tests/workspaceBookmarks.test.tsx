import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkspaceBookmarks } from '../src/components/WorkspaceBookmarks';
import { FORECAST_DATASET_ID } from '../src/data/supabaseForecastArchive';

const f = vi.hoisted(() => ({ context: null as any }));
vi.mock('../src/DatabaseWorkspaceProvider', () => ({ useDatabaseWorkspace: () => f.context }));
beforeEach(() => {
  window.history.replaceState(null, '', '/dan-khun-thot/t-300806?target=2025-12&horizon=4&mapRisk=forecast-high');
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const areas: any[] = []; const filters: any[] = [];
  f.context = { userId: 'owner-a', saved: {
    listAreas: vi.fn(async () => [...areas]), listFilters: vi.fn(async () => [...filters]),
    follow: vi.fn(async (area_code: string) => { areas.push({ user_id: 'owner-a', area_code, created_at: '2026-09-05' }); }),
    saveFilter: vi.fn(async (name: string, selection: any) => { filters.push({ ...selection, id: 'filter-1', user_id: 'owner-a', name, created_at: '2026-09-05' }); }),
    remove: vi.fn(async (kind: string, id: string) => {
      const list = kind === 'area' ? areas : filters;
      const index = list.findIndex((item) => kind === 'area' ? item.area_code === id : item.id === id);
      list.splice(index, 1);
    }),
  } };
});
afterEach(() => cleanup());

describe('shared saved workspace controls', () => {
  it('stays hidden until the database provider is enabled', () => {
    f.context = null; render(<WorkspaceBookmarks onNavigate={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'รายการที่บันทึก' })).not.toBeInTheDocument();
  });
  it('follows the current area, confirms removal, and reloads records on reopen', async () => {
    render(<StrictMode><WorkspaceBookmarks onNavigate={vi.fn()} /></StrictMode>);
    fireEvent.click(screen.getByRole('button', { name: 'รายการที่บันทึก' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'ติดตามพื้นที่นี้' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'ติดตามพื้นที่นี้' }));
    await screen.findByText('เพิ่มพื้นที่ติดตามแล้ว');
    expect(f.context.saved.follow).toHaveBeenCalledWith('300806', expect.any(AbortSignal));
    fireEvent.click(screen.getByRole('button', { name: 'ปิดรายการที่บันทึก' }));
    fireEvent.click(screen.getByRole('button', { name: 'รายการที่บันทึก' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^ลบ ตำบล/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /^ลบ ตำบล/ }));
    expect(f.context.saved.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิกการลบ' }));
    expect(f.context.saved.remove).not.toHaveBeenCalled();
    expect(screen.queryByText('ลบรายการนี้?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^ลบ ตำบล/ }));
    fireEvent.click(screen.getByRole('button', { name: 'ลบ', exact: true }));
    await screen.findByText('ลบรายการแล้ว');
    expect(f.context.saved.remove).toHaveBeenCalledWith('area', '300806', expect.any(AbortSignal));
    fireEvent.click(screen.getByRole('tab', { name: 'ตัวกรองที่บันทึก' }));
    expect(screen.queryByText('ลบรายการแล้ว')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
  it('saves actual month/horizon/risk and navigates to the same filter', async () => {
    const onNavigate = vi.fn(); render(<WorkspaceBookmarks onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'รายการที่บันทึก' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'ติดตามพื้นที่นี้' })).toBeEnabled());
    fireEvent.keyDown(screen.getByRole('tab', { name: 'พื้นที่ติดตาม' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'ตัวกรองที่บันทึก' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('เดือนตั้งต้น ธ.ค. 2568 → เม.ย. 2569 (T+4)', { exact: false })).toBeVisible();
    fireEvent.change(screen.getByLabelText('ชื่อตัวกรอง'), { target: { value: 'บ้านเก่า T+4' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก', exact: true }));
    await screen.findByText('บันทึกตัวกรองแล้ว');
    expect(screen.getByRole('button', { name: /^บ้านเก่า T\+4/ })).toHaveTextContent('เดือนตั้งต้น ธ.ค. 2568 → เม.ย. 2569 (T+4)');
    expect(f.context.saved.saveFilter).toHaveBeenCalledWith('บ้านเก่า T+4', {
      area_code: '300806', dataset_id: FORECAST_DATASET_ID, target_period: '2025-12-01', horizon: 4, risk_criterion: 'forecast-high', view_name: 'drought',
    }, expect.any(AbortSignal));
    fireEvent.click(screen.getByRole('button', { name: /^บ้านเก่า T\+4/ }));
    expect(onNavigate).toHaveBeenCalledWith('/dan-khun-thot/t-300806?mapLayer=forecast-archive&target=2025-12&horizon=4&mapRisk=forecast-high');
  });
  it('keeps typed names after failures and never claims a successful save', async () => {
    f.context.saved.saveFilter.mockRejectedValue({ code: '23505' });
    render(<WorkspaceBookmarks onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'รายการที่บันทึก' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'ติดตามพื้นที่นี้' })).toBeEnabled());
    fireEvent.click(screen.getByRole('tab', { name: 'ตัวกรองที่บันทึก' }));
    fireEvent.change(screen.getByLabelText('ชื่อตัวกรอง'), { target: { value: 'ชื่อตัวกรองเดิม' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('มีชื่อหรือตำบลนี้อยู่ในรายการแล้ว');
    expect(screen.getByLabelText('ชื่อตัวกรอง')).toHaveValue('ชื่อตัวกรองเดิม');
    expect(screen.queryByText('บันทึกตัวกรองแล้ว')).not.toBeInTheDocument();
  });
});
