import { getNakhonRatchasimaDistrictByCode, getNakhonRatchasimaPath, resolveAppRoute } from './domain';
import { isSavedSelection, savedRiskCriteria, type SavedForecastSelection, type SavedRiskCriterion } from './data/savedWorkspaces';
import { FORECAST_DATASET_ID } from './data/supabaseForecastArchive';
import { readIrrigationSelection } from './irrigation';

export function savedAreaInfo(code: string): { label: string; path: string } | null {
  if (code === '30') return { label: 'จังหวัดนครราชสีมา', path: '/drought' };
  const district = getNakhonRatchasimaDistrictByCode(code.slice(0, 4));
  if (!district) return null;
  if (code.length === 4) return { label: `อำเภอ${district.nameTh}`, path: getNakhonRatchasimaPath(district) };
  const subdistrict = district.subdistricts.find((s) => s.subdistrictCode === code);
  return subdistrict ? { label: `ตำบล${subdistrict.nameTh} · อำเภอ${district.nameTh}`, path: getNakhonRatchasimaPath(district, subdistrict) } : null;
}

export function readWorkspaceSelection(location: Pick<Location, 'pathname' | 'search'>, historyState?: unknown): SavedForecastSelection | null {
  const route = resolveAppRoute(location.pathname);
  if (route.kind !== 'nakhon-ratchasima' || !route.target.valid) return null;
  const target = route.target;
  const params = new URLSearchParams(location.search);
  const overview = target.level === 'province' && target.tab === 'overview';
  const code = target.level === 'subdistrict' ? target.subdistrict.subdistrictCode
    : target.level === 'district' ? target.district.districtCode : overview ? params.get('district') || '30' : '30';
  if (!savedAreaInfo(code)) return null;
  const risk = params.get('mapRisk') ?? 'all';
  const irrigation = readIrrigationSelection(location.search, historyState);
  const displayedDataset = historyState && typeof historyState === 'object' && 'ktpForecastDatasetId' in historyState
    && typeof historyState.ktpForecastDatasetId === 'string' ? historyState.ktpForecastDatasetId : FORECAST_DATASET_ID;
  const selection: SavedForecastSelection = {
    view_name: overview ? 'overview' : 'drought', area_code: code, dataset_id: displayedDataset,
    target_period: `${params.get('target') ?? ''}-01`, horizon: overview ? 1 : Number(params.get('horizon') ?? '1'),
    risk_criterion: savedRiskCriteria.includes(risk as SavedRiskCriterion) ? risk as SavedRiskCriterion : 'all',
    ...(irrigation === 'all' ? {} : { irrigation_criterion: irrigation }),
  };
  return isSavedSelection(selection) ? selection : null;
}

export function savedFilterPath(selection: SavedForecastSelection): string | null {
  if (!isSavedSelection(selection)) return null;
  const area = savedAreaInfo(selection.area_code);
  if (!area) return null;
  const params = new URLSearchParams({ mapLayer: 'forecast-archive', target: selection.target_period.slice(0, 7), horizon: String(selection.horizon) });
  if (selection.risk_criterion !== 'all') params.set('mapRisk', selection.risk_criterion);
  if (selection.irrigation_criterion && selection.irrigation_criterion !== 'all') params.set('irrigation', selection.irrigation_criterion);
  if (selection.view_name === 'overview' && selection.area_code !== '30') params.set('district', selection.area_code);
  return `${selection.view_name === 'overview' ? '/' : area.path}?${params.toString()}`;
}
