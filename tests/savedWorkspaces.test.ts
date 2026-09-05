import { describe, expect, it } from 'vitest';
import { FORECAST_DATASET_ID } from '../src/data/supabaseForecastArchive';
import { isSavedSelection } from '../src/data/savedWorkspaces';
import { readWorkspaceSelection, savedAreaInfo, savedFilterPath } from '../src/savedWorkspaceRoutes';

describe('saved forecast selections', () => {
  it.each([
    ['/', '?target=2025-12&horizon=1&district=3008&mapRisk=forecast-high', '3008', 1, 'overview'],
    ['/drought', '?target=2025-11&horizon=3&irrigation=irrigated', '30', 3, 'drought'],
    ['/dan-khun-thot', '?target=2025-12&horizon=4&irrigation=unknown', '3008', 4, 'drought'],
    ['/dan-khun-thot/t-300806', '?target=2025-12&horizon=6&mapRisk=forecast-out-of-scope&irrigation=rainfed', '300806', 6, 'drought'],
  ])('round-trips %s without losing target, horizon, risk or scope', (pathname, search, code, horizon, view) => {
    const selection = readWorkspaceSelection({ pathname, search });
    expect(selection).toMatchObject({ area_code: code, horizon, view_name: view, dataset_id: FORECAST_DATASET_ID });
    const path = savedFilterPath(selection!);
    const url = new URL(path!, 'https://local.test');
    expect(readWorkspaceSelection(url)).toEqual(selection);
  });
  it('rejects foreign source IDs, unsafe routes, missing dates and unseeded areas', () => {
    expect(readWorkspaceSelection({ pathname: '/login', search: '' })).toBeNull();
    expect(readWorkspaceSelection({ pathname: '/drought', search: '' })).toBeNull();
    expect(readWorkspaceSelection({ pathname: '/', search: '?target=2025-12&district=3099' })).toBeNull();
    expect(savedAreaInfo('309999')).toBeNull();
    const selection = readWorkspaceSelection({ pathname: '/drought', search: '?target=2025-12&horizon=1' })!;
    expect(isSavedSelection({ ...selection, dataset_id: 'other-source' })).toBe(false);
    expect(isSavedSelection({ ...selection, target_period: '2026-01-01' })).toBe(false);
    expect(isSavedSelection({ ...selection, area_code: '//evil.test' })).toBe(false);
    expect(isSavedSelection({ ...selection, irrigation_criterion: 'Collecting' as 'unknown' })).toBe(false);
    expect(savedFilterPath({ ...selection, irrigation_criterion: 'all' })).toBe(savedFilterPath(selection));
    expect(savedFilterPath({ ...selection, area_code: '309999' })).toBeNull();
  });
});
