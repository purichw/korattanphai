import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CMS_RESOURCES } from '../shared/cmsResources.mjs';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../src/supabase', () => ({ getSupabaseClient: async () => ({ rpc }) }));
beforeEach(() => { vi.resetModules(); vi.stubEnv('VITE_REFERENCE_BACKEND', 'cms'); rpc.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

const catalog = CMS_RESOURCES.map((resource, index) => ({ id: `active-${index}`, resource_key: resource.key }));
const bundle = Object.fromEntries(CMS_RESOURCES.filter(resource => resource.preload).map(resource => [resource.key, { key: resource.key }]));
function respond(read: (name: string, args: Record<string, unknown>) => unknown) {
  rpc.mockImplementation((name, args) => ({ abortSignal: () => Promise.resolve({ data: read(name, args), error: null }) }));
}

it('starts with only active resources and never requests retired resources or country geometry', async () => {
  respond(name => name.endsWith('_catalog') ? catalog : bundle);
  const { bootstrapCmsReferences, readCmsResource, loadCmsGeometry } = await import('../src/data/cmsReferences');
  await Promise.all([bootstrapCmsReferences(), bootstrapCmsReferences()]);
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(rpc.mock.calls[1]).toEqual(['ktp_cms_reference_bundle', { p_ids: ['active-0', 'active-1'] }]);
  expect(readCmsResource('canonical/nakhon_ratchasima/admin_hierarchy')).toEqual(bundle['canonical/nakhon_ratchasima/admin_hierarchy']);
  await expect(loadCmsGeometry('/geodata/thailand-neighbor-context.geojson')).rejects.toThrow('Unknown CMS geometry');
  expect(rpc).toHaveBeenCalledTimes(2);
});

it('ignores retained rows and extra returned bundle values while preserving active pinned geometry reads', async () => {
  respond(name => name.endsWith('_catalog')
    ? [...catalog, { id: 'retired-source', resource_key: 'canonical/source_registry' }]
    : name.endsWith('_bundle') ? { ...bundle, 'canonical/source_registry': ['retired'] }
    : { features: ['active geometry'] });
  const { bootstrapCmsReferences, readCmsResource, loadCmsGeometry } = await import('../src/data/cmsReferences');
  await bootstrapCmsReferences();
  expect(() => readCmsResource('canonical/source_registry')).toThrow('CMS resource not ready');
  await expect(loadCmsGeometry('/geodata/nakhon-ratchasima-subdistricts.geojson')).resolves.toEqual({ features: ['active geometry'] });
  expect(rpc.mock.calls.at(-1)).toEqual(['ktp_cms_reference_read', { p_id: 'active-2' }]);
});

it.each(CMS_RESOURCES.map(resource => resource.key))('fails closed if active resource %s is absent, then permits retry', async missing => {
  respond(name => name.endsWith('_catalog') ? catalog.filter(item => item.resource_key !== missing) : bundle);
  const { bootstrapCmsReferences } = await import('../src/data/cmsReferences');
  await expect(bootstrapCmsReferences()).rejects.toThrow('CMS reference migration is incomplete');
  expect(rpc).toHaveBeenCalledTimes(1);
  respond(name => name.endsWith('_catalog') ? catalog : bundle);
  await expect(bootstrapCmsReferences()).resolves.toBeUndefined();
});

it('fails closed when a requested payload is absent from the bundle', async () => {
  respond(name => name.endsWith('_catalog') ? catalog : {});
  const { bootstrapCmsReferences } = await import('../src/data/cmsReferences');
  await expect(bootstrapCmsReferences()).rejects.toThrow('Incomplete CMS reference bundle');
});
