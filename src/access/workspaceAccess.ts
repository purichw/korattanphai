import { resolveAppRoute } from '../domain';
import type { AccessRequest, Capability } from './policy';

/** Map an existing page to its broadest geographic context, using canonical codes.
 * Filters never turn a province page into a district-authorized page. Data request
 * scoping is a separate check at the service/RPC boundary.
 * null means unsupported/unavailable, never an unscoped or country-wide request.
 */
export function workspaceAccessRequest(destination: string, capability: Capability = 'forecast.view'): AccessRequest | null {
  if (!destination.startsWith('/') || destination.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(destination)) return null;
  const url = new URL(destination, 'https://workspace.invalid');
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return null;
  const route = resolveAppRoute(url.pathname);
  if (route.kind !== 'nakhon-ratchasima' || !route.target.valid) return null;
  const target = route.target;
  const area = target.level === 'province' ? { level: 'province' as const, code: '30' }
    : target.level === 'district' ? { level: 'district' as const, code: target.district.districtCode }
      : { level: 'subdistrict' as const, code: target.subdistrict.subdistrictCode };
  return { capability, area };
}
