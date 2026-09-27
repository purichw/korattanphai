import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { OpenLocationCode } from 'open-location-code';
import type { MultiPolygon, Polygon } from 'geojson';
import type { NakhonRatchasimaGeoFeature } from './components/nakhon-ratchasima/workspaceModel';

const locationCode = new OpenLocationCode();

/** Resolve the code area's center through the same boundary checks as WGS84 input. */
export function locateKoratPlusCode(input: string, features: NakhonRatchasimaGeoFeature[]) {
  const code = input.trim().toUpperCase();
  if (locationCode.isShort(code.split(/\s+/)[0])) {
    throw new Error('รหัสนี้เป็น Plus Code แบบย่อ กรุณาใช้รหัสเต็มที่มี 8 ตัวก่อนเครื่องหมาย + หรือค้นหาด้วยละติจูด / ลองจิจูด');
  }
  if (!locationCode.isFull(code) || code.length > 16) {
    throw new Error('Plus Code ไม่ถูกต้อง กรุณาระบุรหัสเต็มเท่านั้น ไม่รวมชื่อสถานที่หรือลิงก์');
  }
  const area = locationCode.decode(code);
  if (area.codeLength < 10) {
    throw new Error('Plus Code นี้ครอบคลุมพื้นที่กว้างเกินไป กรุณาใช้รหัสที่ละเอียดขึ้น โดยมีอย่างน้อย 2 ตัวหลังเครื่องหมาย +');
  }
  return {
    ...locateKoratPoint(String(area.latitudeCenter), String(area.longitudeCenter), features),
    plusCode: code,
  };
}

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
