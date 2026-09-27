import type { DataKind } from '../../shared/dataFields.mjs';
export type { DataKind, DataField } from '../../shared/dataFields.mjs';
export type Json = null | string | number | boolean | Json[] | { [key: string]: Json };
export type Payload = Record<string, Json>;
export type DraftSummary = { id: string; kind: DataKind; title: string; source_filename: string;
  revision: number; state: 'draft' | 'accepted'; updated_at: string; created_at: string };
export type Draft = DraftSummary & { payload: Payload; original_hash: string; accepted_hash: string | null };
export type ValidationReport = { revision: number; valid: boolean; rowCount: number; contentHash: string | null;
  issues: { row: number | null; message: string }[] };
export type AuditEntry = { id: number; action: string; revision: number; reason: string; occurred_at: string; actor_id: string };
export const kindLabels: Record<DataKind, string> = { station: 'ข้อมูลสถานีตรวจวัด', satellite: 'ข้อมูลดาวเทียม',
  crop: 'ข้อมูลพื้นที่และผลผลิตพืช', forecast: 'ผลพยากรณ์จากแบบจำลอง', archive: 'แก้ไขพยากรณ์ที่เผยแพร่' };
export const rowsKey = (kind: DataKind) => kind === 'forecast' || kind === 'archive' ? 'predictions' : 'observations';
