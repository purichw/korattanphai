import { exportRiskLabel, type ExportRisk } from '../forecastExportModel';

export function ForecastRiskValue({ risk }: { risk: ExportRisk }) {
  return <span className={`nr-analysis-risk is-${risk === null ? 'outside' : risk === undefined ? 'missing' : risk}`} title={exportRiskLabel(risk)}>
    {risk === null ? 'นอกขอบเขต' : risk === undefined ? 'ไม่มีข้อมูล' : `${risk} · ${risk === 0 ? 'ไม่พบสัญญาณเสี่ยง' : risk === 1 ? 'ปานกลาง' : 'สูง'}`}
  </span>;
}
