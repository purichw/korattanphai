import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { locateKoratPlusCode, locateKoratPoint } from '../src/mapPoint';
import type { NakhonRatchasimaGeoFeature } from '../src/components/nakhon-ratchasima/workspaceModel';

const features: NakhonRatchasimaGeoFeature[] = JSON.parse(readFileSync('public/geodata/nakhon-ratchasima-subdistricts.geojson', 'utf8')).features;
const fullCode = '7P64X3HQ+2M';

describe('Korat full Plus Code lookup', () => {
  it('decodes the known WGS84 code center, not a swapped coordinate or a geocoder guess', () => {
    const result = locateKoratPlusCode(fullCode, features);
    expect(result.point[0]).toBeCloseTo(102.0891875, 7);
    expect(result.point[1]).toBeCloseTo(14.9775625, 7);
    expect(result.feature.properties.Admin_code).toBe('300101');
    expect(result.feature).toBe(locateKoratPoint(String(result.point[1]), String(result.point[0]), features).feature);
  });
  it('accepts surrounding whitespace, lowercase and extra-precision full codes', () => {
    expect(locateKoratPlusCode('  7p64x3hq+2m\n', features).plusCode).toBe(fullCode);
    expect(locateKoratPlusCode(`${fullCode}2`, features).feature.properties.Admin_code).toBe('300101');
  });
  it.each(['X3HQ+2M', 'X3HQ+2M นครราชสีมา', '+2M'])('does not guess a location for short code %s', input => {
    expect(() => locateKoratPlusCode(input, features)).toThrow('แบบย่อ');
  });
  it.each(['', 'not a code', '7P64X3HQ2M', '7P64X3HQ+2', '7P64X3HQ++2M', '7P64X3HQ+2I', '7P64 X3HQ+2M', `${fullCode} นครราชสีมา`, `https://plus.codes/${fullCode}`, 'ZZZZZZZZ+ZZ', `${fullCode}222222`])('rejects malformed or unsupported input %s', input => {
    expect(() => locateKoratPlusCode(input, features)).toThrow('ไม่ถูกต้อง');
  });
  it.each(['7P640000+', '7P64X3HQ+'])('requires enough precision to avoid coarse-area attribution: %s', input => {
    expect(() => locateKoratPlusCode(input, features)).toThrow('พื้นที่กว้างเกินไป');
  });
  it('rejects points outside Korat and absent boundary data', () => {
    expect(() => locateKoratPlusCode('7P52QG42+GP', features)).toThrow('นอกขอบเขตนครราชสีมา');
    expect(() => locateKoratPlusCode(fullCode, [])).toThrow('นอกขอบเขตนครราชสีมา');
  });
  it('preserves hole, non-Korat and overlapping-boundary checks', () => {
    const polygon = {
      type: 'Feature', properties: { Admin_code: '300101' },
      geometry: { type: 'Polygon', coordinates: [[[102, 14], [103, 14], [103, 16], [102, 16], [102, 14]]] },
    } as NakhonRatchasimaGeoFeature;
    expect(() => locateKoratPlusCode(fullCode, [polygon, { ...polygon, properties: { ...polygon.properties, Admin_code: '300102' } }])).toThrow('หลายตำบล');
    expect(() => locateKoratPlusCode(fullCode, [{ ...polygon, properties: { ...polygon.properties, Admin_code: '500101' } }])).toThrow('นอกขอบเขต');
    const hole = [[102.08, 14.97], [102.1, 14.97], [102.1, 14.99], [102.08, 14.99], [102.08, 14.97]];
    expect(() => locateKoratPlusCode(fullCode, [{ ...polygon, geometry: { ...polygon.geometry, coordinates: [...polygon.geometry.coordinates, hole] } }])).toThrow('นอกขอบเขต');
  });
});
