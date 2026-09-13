import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import type { MultiPolygon, Polygon } from 'geojson';
import type { NakhonRatchasimaGeoFeature } from './components/nakhon-ratchasima/workspaceModel';

/** Boundary ties remain ambiguous instead of assigning a point to the first polygon. */
export function locateKoratPoint(latitude: string, longitude: string, features: NakhonRatchasimaGeoFeature[]) {
  const lat = Number(latitude), lon = Number(longitude);
  if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)
    || lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error('กรุณาระบุละติจูดและลองจิจูดเป็นองศาทศนิยมที่ถูกต้อง');
  const matches = features.filter(feature => feature.properties.Admin_code.startsWith('30')
    && booleanPointInPolygon([lon, lat], feature.geometry as Polygon | MultiPolygon));
  if (!matches.length) throw new Error('พิกัดอยู่นอกขอบเขตนครราชสีมา หรือไม่อยู่ในขอบเขตตำบลที่มี');
  if (matches.length > 1) throw new Error('พิกัดอยู่บนแนวเขตหลายตำบล กรุณาระบุจุดภายในตำบลให้ชัดเจน');
  return { feature: matches[0], point: [lon, lat] as [number, number] };
}
