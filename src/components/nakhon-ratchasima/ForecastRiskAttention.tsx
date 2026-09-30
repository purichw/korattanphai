import { useId, useRef, useState } from "react";
import { ChevronRight, ClipboardCheck, Info, MapPin } from "lucide-react";
import { formatMonth } from "../../i18n";
import type { DroughtForecastArchiveSummary } from "./forecastModel";
import { formatThaiNumber } from "./workspaceModel";

export function ForecastRiskAttention({ summary, hrefForSubdistrict }: {
  summary: DroughtForecastArchiveSummary;
  hrefForSubdistrict: (code: string) => string;
}) {
  const [risk, setRisk] = useState<1 | 2>(() => summary.highRiskSubdistricts > 0 || summary.moderateRiskSubdistricts === 0 ? 2 : 1);
  const listRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const listId = useId();
  const riskLabel = risk === 2 ? "เสี่ยงสูง" : "เสี่ยงปานกลาง";
  // Use the same scoped records as the summary metrics, including explicit missing/out-of-scope values.
  const records = [...summary.recordsBySubdistrict.values()]
    .filter(record => record.forecastRisk === risk)
    .sort((a, b) => a.subdistrictCode.localeCompare(b.subdistrictCode));
  const otherCount = risk === 2 ? summary.moderateRiskSubdistricts : summary.highRiskSubdistricts;
  const otherLabel = risk === 2 ? "เสี่ยงปานกลาง" : "เสี่ยงสูง";
  return <section className="nr-forecast-overview-attention" data-risk={risk} aria-labelledby={headingId}>
    <div className="nr-home-attention-heading"><h3 id={headingId}>ตำบลที่พยากรณ์มีความเสี่ยง</h3></div>
    <div className="nr-home-risk-toggle" role="group" aria-label="ระดับความเสี่ยงที่แสดง">
      {([2, 1] as const).map(value => <button key={value} type="button" aria-pressed={risk === value} aria-controls={listId}
        data-risk={value} onClick={() => { setRisk(value); if (listRef.current) listRef.current.scrollTop = 0; }}>
        {value === 2 ? "เสี่ยงสูง" : "เสี่ยงปานกลาง"} ({formatThaiNumber(value === 2 ? summary.highRiskSubdistricts : summary.moderateRiskSubdistricts)})
      </button>)}
    </div>
    <p className="nr-home-attention-context">พยากรณ์ {formatMonth(summary.targetMonth, "th")} · {formatThaiNumber(records.length)} ตำบล</p>
    <div id={listId} ref={listRef} className="nr-home-attention-scroll" role="region" aria-label={`รายชื่อตำบล${riskLabel}`} tabIndex={records.length ? 0 : undefined}>
      {records.length ? <ul>
        {records.map(record => <li key={record.subdistrictCode}>
          <a href={hrefForSubdistrict(record.subdistrictCode)}>
            <span className="nr-home-area-marker" aria-hidden="true"><MapPin size={18} /></span>
            <span className="nr-home-area-name"><strong>ต.{record.subdistrictNameTh}</strong><small>อ.{record.districtNameTh}</small></span>
            <span className="status-pill">{riskLabel}</span><ChevronRight size={16} aria-hidden="true" />
          </a>
        </li>)}
      </ul> : <div className="nr-home-attention-empty" role="status">
        <span className="nr-home-attention-empty-icon" aria-hidden="true">{summary.inScopeSubdistricts === 0 ? <Info size={28} /> : <ClipboardCheck size={28} />}</span>
        <strong>{summary.inScopeSubdistricts === 0 ? "ไม่มีค่าพยากรณ์ในขอบเขตที่เลือก" : `ไม่พบตำบลที่พยากรณ์${riskLabel}`}</strong>
        <small>{summary.inScopeSubdistricts === 0 ? "ยังไม่สามารถสรุปความเสี่ยงของพื้นที่นี้ได้" : otherCount > 0
          ? `มีตำบล${otherLabel} ${formatThaiNumber(otherCount)} ตำบล · เลือกระดับด้านบนเพื่อดูรายชื่อ`
          : "เฉพาะตำบลที่มีค่าพยากรณ์ในขอบเขตที่เลือก"}</small>
      </div>}
    </div>
  </section>;
}
