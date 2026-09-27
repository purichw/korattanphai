import { describe, expect, it } from 'vitest';
import { isSavedSelection } from '../src/data/savedWorkspaces';
import { readWorkspaceAreaCode, readWorkspaceSelection, savedAreaInfo, savedFilterPath } from '../src/savedWorkspaceRoutes';

const datasetId = '11111111-1111-4111-8111-111111111111';
const displayedState = { ktpForecastDatasetId: datasetId };

describe('saved forecast selections', () => {
  it('cannot save a forecast before its actual published revision is loaded', () => {
    const location = { pathname: '/drought', search: '?target=2025-12&horizon=1' };
    expect(readWorkspaceSelection(location)).toBeNull();
    expect(readWorkspaceSelection(location, {})).toBeNull();
    expect(readWorkspaceSelection(location, { ktpForecastDatasetId: 'invalid' })).toBeNull();
    expect(readWorkspaceSelection(location, displayedState)?.dataset_id).toBe(datasetId);
  });
  it('records the dataset actually displayed after a new publication', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const selected = readWorkspaceSelection({ pathname: '/drought', search: '?mapLayer=forecast-archive&target=2026-01&horizon=4' }, { ktpForecastDatasetId: id });
    expect(selected).toMatchObject({ dataset_id: id, target_period: '2026-01-01', horizon: 4 });
    expect(savedFilterPath(selected!)).toContain('target=2026-01');
  });
  it('saves the live map filter instead of a stale URL value', () => {
    const location = { pathname: '/drought', search: '?mapLayer=forecast-archive&target=2025-12&horizon=4&irrigation=irrigated' };
    for (const criterion of ['unknown', 'rainfed', 'all'] as const) {
      const selection = readWorkspaceSelection(location, { ...displayedState, ktpIrrigation: criterion })!;
      expect(selection.irrigation_criterion ?? 'all').toBe(criterion);
      expect(readWorkspaceSelection(new URL(savedFilterPath(selection)!, 'https://local.test'), displayedState)).toEqual(selection);
    }
  });
  it.each([
    ['/', '?target=2025-12&horizon=1&district=3008&mapRisk=forecast-high', '3008', 1, 'overview'],
    ['/drought', '?target=2025-11&horizon=3&irrigation=irrigated', '30', 3, 'drought'],
    ['/dan-khun-thot', '?target=2025-12&horizon=4&irrigation=unknown', '3008', 4, 'drought'],
    ['/dan-khun-thot/t-300806', '?target=2025-12&horizon=6&mapRisk=forecast-out-of-scope&irrigation=rainfed', '300806', 6, 'drought'],
    ['/', '?target=2025-12&horizon=6&district=3008', '3008', 6, 'drought'],
  ])('round-trips %s without losing target, horizon, risk or scope', (pathname, search, code, horizon, view) => {
    const selection = readWorkspaceSelection({ pathname, search: `${search}&mapLayer=forecast-archive` }, displayedState);
    expect(readWorkspaceSelection({ pathname, search }, displayedState)).toEqual(selection);
    expect(selection).toMatchObject({ area_code: code, horizon, view_name: view, dataset_id: datasetId });
    const path = savedFilterPath(selection!);
    const url = new URL(path!, 'https://local.test');
    expect(readWorkspaceSelection(url, displayedState)).toEqual(selection);
  });
  it('rejects foreign source IDs, unsafe routes, missing dates and unseeded areas', () => {
    expect(readWorkspaceSelection({ pathname: '/login', search: '' })).toBeNull();
    expect(readWorkspaceSelection({ pathname: '/drought', search: '' })).toBeNull();
    expect(readWorkspaceSelection({ pathname: '/', search: '?mapLayer=forecast-archive&target=2025-12&district=3099' })).toBeNull();
    expect(savedAreaInfo('309999')).toBeNull();
    const selection = readWorkspaceSelection({ pathname: '/drought', search: '?mapLayer=forecast-archive&target=2025-12&horizon=1' }, displayedState)!;
    expect(isSavedSelection({ ...selection, dataset_id: 'other-source' })).toBe(false);
    expect(isSavedSelection({ ...selection, target_period: '2026-01-01' })).toBe(true);
    expect(isSavedSelection({ ...selection, target_period: '2026-13-01' })).toBe(false);
    expect(isSavedSelection({ ...selection, area_code: '//evil.test' })).toBe(false);
    expect(isSavedSelection({ ...selection, irrigation_criterion: 'Collecting' as 'unknown' })).toBe(false);
    expect(savedFilterPath({ ...selection, irrigation_criterion: 'all' })).toBe(savedFilterPath(selection));
    expect(savedFilterPath({ ...selection, area_code: '309999' })).toBeNull();
  });
  it('keeps geographic following independent of actual or forecast filters', () => {
    for (const search of ['?period=2026-08', '']) {
      const location = { pathname: '/phimai/t-301503', search };
      expect(readWorkspaceAreaCode(location)).toBe('301503');
      expect(readWorkspaceSelection(location)).toBeNull();
    }
    expect(readWorkspaceAreaCode({ pathname: '/', search: '?district=3015&period=2026-08' })).toBe('3015');
  });
});
