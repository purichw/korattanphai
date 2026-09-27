import { getSupabaseClient } from '../supabase';
import { CMS_RESOURCES } from '../../shared/cmsResources.mjs';

export const cmsReferencesEnabled = import.meta.env.VITE_REFERENCE_BACKEND === 'cms';
type ReferenceHead = { id: string; resource_key: string };
let heads: Map<string, string> | null = null;
const values = new Map<string, unknown>();
let startup: Promise<void> | null = null;

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const client = await getSupabaseClient();
  if (!client) throw new Error('CMS configuration unavailable');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const { data, error } = await client.rpc(name, args).abortSignal(controller.signal);
    if (error || data == null) throw new Error('CMS reference unavailable');
    return data as T;
  } finally { window.clearTimeout(timeout); }
}

// Pin a coherent catalogue for this page session. No bundled-data fallback.
export function bootstrapCmsReferences(): Promise<void> {
  if (!cmsReferencesEnabled) return Promise.resolve();
  if (startup) return startup;
  startup = (async () => {
    const catalog = await rpc<ReferenceHead[]>('ktp_cms_reference_catalog');
    const next = new Map(catalog.map(item => [item.resource_key, item.id]));
    if (CMS_RESOURCES.some(resource => !next.has(resource.key))) throw new Error('CMS reference migration is incomplete');
    const required = CMS_RESOURCES.filter(resource => resource.preload);
    const bundle = await rpc<Record<string, unknown>>('ktp_cms_reference_bundle', { p_ids: required.map(resource => next.get(resource.key)) });
    if (required.some(resource => !Object.prototype.hasOwnProperty.call(bundle, resource.key))) throw new Error('Incomplete CMS reference bundle');
    heads = next;
    for (const [key, value] of Object.entries(bundle)) values.set(key, value);
  })().catch(error => { startup = null; throw error; });
  return startup;
}
export function readCmsResource<T>(key: string): T {
  if (!values.has(key)) throw new Error(`CMS resource not ready: ${key}`);
  return values.get(key) as T;
}
export async function loadCmsGeometry<T>(url: string): Promise<T> {
  await bootstrapCmsReferences();
  const key = url.replace(/^\//, '').replace(/\.geojson$/, '');
  const id = heads?.get(key);
  if (!id) throw new Error('Unknown CMS geometry');
  if (!values.has(key)) values.set(key, await rpc('ktp_cms_reference_read', { p_id: id }));
  return readCmsResource<T>(key);
}
