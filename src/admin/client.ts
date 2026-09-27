import { getSupabaseClient } from '../supabase';

const messages: Record<string, string> = {
  cms_not_configured: 'ยังไม่ได้เปิดใช้ฐานข้อมูล CMS ในสภาพแวดล้อมนี้',
  cms_forbidden: 'บัญชีนี้ยังไม่มีสิทธิ์จัดการข้อมูล',
  sign_in_required: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง',
  revision_conflict: 'ข้อมูลถูกแก้ไขจากอีกหน้าต่างแล้ว กรุณาโหลดฉบับล่าสุดก่อนบันทึก',
  batch_already_exists: 'รหัสชุดข้อมูลนี้มีอยู่แล้ว กรุณาใช้รหัสรุ่นใหม่ ต้นฉบับจะไม่ถูกเขียนทับ',
  immutable_revision: 'ชุดข้อมูลที่รับเข้าระบบแล้วแก้ทับไม่ได้',
  row_limit: 'หนึ่งชุดรับได้ 1–2,000 รายการ ตามข้อกำหนด API เดิม',
  payload_too_large: 'ชุดข้อมูลเกินขนาดที่รับได้ กรุณาแบ่งชุดข้อมูล',
  draft_not_found: 'ไม่พบฉบับร่างนี้',
  validation_failed: 'ยังมีข้อมูลที่ต้องตรวจสอบก่อนรับเข้าระบบ',
  cms_unavailable: 'เชื่อมต่อ CMS ไม่สำเร็จ ข้อมูลที่กำลังแก้ไขยังไม่ถูกบันทึก',
  resource_shape_changed: 'โครงสร้างข้อมูลเปลี่ยนไป กรุณาคง fields และจำนวนรายการของทะเบียนเดิม',
  resource_identity_locked: 'รหัสอ้างอิงและที่มาข้อมูลต้องคงเดิม การเปลี่ยนทะเบียนต้องตรวจความสัมพันธ์ก่อน',
  resource_review_required: 'ข้อมูลชุดนี้เก็บเพื่ออ้างอิง ต้องผ่านการตรวจเฉพาะประเภทก่อนแก้ไข',
  archive_scope_locked: 'เดือนตั้งต้นและขอบเขตของฉบับตรวจแก้ต้องตรงกับต้นฉบับ',
  api_batch_too_large: 'ข้อมูลเกินขนาด 1 MB ตาม contract API กรุณาแบ่งชุดข้อมูล',
  invalid_resource_url: 'URL ต้องเป็น http หรือ https ที่ถูกต้อง ไม่มีช่องว่างหรือข้อมูลเข้าสู่ระบบ',
};
export class AdminRequestError extends Error {
  constructor(public code: string) { super(messages[code] ?? 'ดำเนินการไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองใหม่'); }
}
export function createAdminClient(userId: string) {
  return async <T>(action: string, options: { id?: string; offset?: number; body?: unknown; signal?: AbortSignal } = {}): Promise<T> => {
    const client = await getSupabaseClient();
    const initial = await client?.auth.getSession();
    const session = initial?.data.session;
    if (initial?.error || !session || session.user.id !== userId) throw new AdminRequestError('sign_in_required');
    const query = new URLSearchParams({ action });
    if (options.id) query.set('id', options.id);
    if (options.offset != null) query.set('offset', String(options.offset));
    const controller = new AbortController();
    const cancel = () => controller.abort();
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) controller.abort();
    const timer = window.setTimeout(cancel, action === 'accept' ? 70000 : 20000);
    try {
      const response = await fetch(`/api/admin-data?${query}`, {
        method: options.body === undefined ? 'GET' : 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${session.access_token}`, ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }), cache: 'no-store',
      });
      const data = await response.json();
      const current = await client!.auth.getSession();
      if (current.error || current.data.session?.user.id !== userId) throw new AdminRequestError('sign_in_required');
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!response.ok) throw new AdminRequestError(data.error?.code ?? 'cms_unavailable');
      return data as T;
    } catch (error) {
      if (error instanceof AdminRequestError) throw error;
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      throw new AdminRequestError('cms_unavailable');
    } finally { window.clearTimeout(timer); options.signal?.removeEventListener('abort', cancel); }
  };
}
