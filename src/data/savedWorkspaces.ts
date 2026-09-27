import type { SupabaseClient } from '@supabase/supabase-js';
import { irrigationCriteria, type IrrigationCriterion } from '../irrigation';

export const savedRiskCriteria = ['all', 'forecast-no-risk', 'forecast-moderate', 'forecast-high', 'forecast-out-of-scope', 'forecast-missing'] as const;
export type SavedRiskCriterion = typeof savedRiskCriteria[number];
export type SavedForecastSelection = {
  view_name: 'overview' | 'drought';
  area_code: string;
  dataset_id: string;
  target_period: string;
  horizon: number;
  risk_criterion: SavedRiskCriterion;
  irrigation_criterion?: IrrigationCriterion;
};
export type FollowedArea = { user_id: string; area_code: string; created_at: string };
export type SavedFilter = SavedForecastSelection & { id: string; user_id: string; name: string; created_at: string };

export function isSavedSelection(value: SavedForecastSelection): boolean {
  // PostgreSQL's published-dataset policy and run FK validate new revisions.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.dataset_id) && /^30([0-9]{2}){0,2}$/.test(value.area_code) &&
    /^\d{4}-(0[1-9]|1[0-2])-01$/.test(value.target_period) &&
    Number.isInteger(value.horizon) && value.horizon >= 1 && value.horizon <= 6 && savedRiskCriteria.includes(value.risk_criterion) &&
    (value.irrigation_criterion === undefined || irrigationCriteria.includes(value.irrigation_criterion)) &&
    (value.view_name === 'drought' || (value.view_name === 'overview' && value.horizon === 1 && value.area_code.length <= 4));
}

export function savedWorkspaceError(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error && error.code === '23505'
    ? 'มีชื่อหรือตำบลนี้อยู่ในรายการแล้ว'
    : 'บันทึกหรือโหลดรายการไม่สำเร็จ กรุณาลองอีกครั้ง';
}

export function createSavedWorkspaceClient(userId: string, getClient: () => Promise<SupabaseClient | null>) {
  async function clientForOwner() {
    const client = await getClient();
    if (!client) throw new Error('Database unavailable');
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== userId) throw new Error('Session changed');
    return client;
  }
  async function list<T>(table: 'ktp_followed_areas' | 'ktp_saved_filters', signal: AbortSignal): Promise<T[]> {
    const client = await clientForOwner();
    const rows: T[] = [];
    for (let start = 0; ; start += 200) {
      const { data, error } = await client.from(table).select('*').eq('user_id', userId)
        .order('created_at', { ascending: false }).order(table === 'ktp_saved_filters' ? 'id' : 'area_code')
        .range(start, start + 199).abortSignal(signal);
      if (error) throw error;
      rows.push(...data as T[]);
      if (data.length < 200) return rows;
    }
  }
  return {
    listAreas: (signal: AbortSignal) => list<FollowedArea>('ktp_followed_areas', signal),
    listFilters: (signal: AbortSignal) => list<SavedFilter>('ktp_saved_filters', signal),
    async follow(areaCode: string, signal: AbortSignal) {
      if (!/^30([0-9]{2}){0,2}$/.test(areaCode)) throw new Error('Invalid area');
      const client = await clientForOwner();
      const { error } = await client.from('ktp_followed_areas').upsert({ user_id: userId, area_code: areaCode }, { onConflict: 'user_id,area_code', ignoreDuplicates: true }).abortSignal(signal);
      if (error) throw error;
    },
    async saveFilter(name: string, selection: SavedForecastSelection, signal: AbortSignal) {
      if (!isSavedSelection(selection) || !name.trim() || name.trim().length > 80) throw new Error('Invalid saved filter');
      const client = await clientForOwner();
      const { error } = await client.from('ktp_saved_filters').insert({ ...selection, name: name.trim(), user_id: userId }).abortSignal(signal);
      if (error) throw error;
    },
    async remove(kind: 'area' | 'filter', id: string, signal: AbortSignal) {
      const client = await clientForOwner();
      const { data, error } = await client.from(kind === 'area' ? 'ktp_followed_areas' : 'ktp_saved_filters')
        .delete().eq('user_id', userId).eq(kind === 'area' ? 'area_code' : 'id', id).select().abortSignal(signal);
      if (error) throw error;
      if (!data.length) throw new Error('Saved item not found');
    },
  };
}
