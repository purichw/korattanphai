import { ArrowRight } from "lucide-react";
import {
  NAKHON_RATCHASIMA_ROUTE_BASE,
  summarizeNakhonRatchasimaProvince,
} from "../domain";
import { MetricCard } from "./PageSummary";

export function NakhonRatchasimaWorkspaceSummary({ compact = false }: { compact?: boolean }) {
  const summary = summarizeNakhonRatchasimaProvince();
  const linkClass = [
    compact ? "secondary-button" : "primary-button",
    "button-link",
    "province-workspace-link",
    compact ? "compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={["province-workspace-card", compact ? "compact" : ""].filter(Boolean).join(" ")} aria-label="พื้นที่ปฏิบัติการนครราชสีมา">
      <div className="province-workspace-copy">
        <p className="eyebrow">พื้นที่ปฏิบัติการระดับจังหวัด</p>
        <strong>จังหวัดนครราชสีมา</strong>
        <span>ข้อมูลลงลึกถึงอำเภอและตำบล แยกหลักฐานจริงออกจากค่าที่ระบบคำนวณ</span>
      </div>
      <div className="mini-stat-grid" aria-label="จำนวนพื้นที่ย่อยจังหวัดนครราชสีมา">
        <MetricCard label="อำเภอ" value={summary.districtCount} />
        <MetricCard label="ตำบล" value={summary.subdistrictCount} />
      </div>
      <a className={linkClass} href={NAKHON_RATCHASIMA_ROUTE_BASE}>
        เปิดจังหวัดนครราชสีมา
        <ArrowRight size={compact ? 16 : 17} aria-hidden="true" />
      </a>
    </section>
  );
}
