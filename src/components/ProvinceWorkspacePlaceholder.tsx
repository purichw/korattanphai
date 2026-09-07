import { AlertTriangle, ArrowLeft, Database, Leaf, Map, ShieldAlert, Waves } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { DataProvenanceChip, dataProvenanceChipKindFromText } from "./DataProvenanceChip";
import { OperationalFilters } from "./OperationalFilters";
import { PageSummary } from "./PageSummary";
import {
  formatRai,
  getLayerAvailability,
  getLayerSources,
  getMapLayer,
  getProvinceRecord,
  getProvinceTrend,
  monthContext,
  severityTone,
  type ProvinceWorkspaceRouteTarget,
} from "../domain";
import {
  formatMonth,
  labelConfidence,
  labelCrop,
  labelDataMode,
  labelHazard,
  labelLayerAvailability,
  labelLayerGroup,
  labelMonthNarrative,
  labelProvinceProvenance,
  severityLabel,
} from "../i18n";
import { useAppDispatch, useAppState } from "../store";
import type { LocationNode } from "../types";

function provinceName(province: LocationNode) {
  return province.nameTh ?? province.name;
}

function PlaceholderPanel({
  icon,
  title,
  eyebrow,
  children,
}: {
  icon: ReactNode;
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <article className="province-placeholder-panel">
      <div className="province-panel-title">
        <span aria-hidden="true">{icon}</span>
        <div>
          {eyebrow && <small>{eyebrow}</small>}
          <strong>{title}</strong>
        </div>
      </div>
      {children}
    </article>
  );
}

function ProvinceRouteNotFound({ slug, onNavigate }: { slug: string; onNavigate: (path: string) => void }) {
  return (
    <div className="province-workspace">
      <section className="province-route-card">
        <button type="button" className="secondary-button" onClick={() => onNavigate("/")}>
          <ArrowLeft size={17} />
          กลับแผนที่ประเทศ
        </button>
        <span className="nr-inline-status">ไม่พบหน้าจังหวัด</span>
      </section>
      <section className="province-placeholder-panel">
        <div className="province-panel-title">
          <span aria-hidden="true">
            <AlertTriangle size={18} />
          </span>
          <div>
            <small>เส้นทางจังหวัด</small>
            <strong>ยังไม่มีจังหวัดสำหรับ /{slug}</strong>
          </div>
        </div>
        <p>เส้นทางจังหวัดต้องมาจากรายชื่อจังหวัดที่รองรับเท่านั้น กลับไปเลือกจังหวัดจากแผนที่ประเทศเพื่อเปิดหน้าที่ถูกต้อง</p>
      </section>
    </div>
  );
}

export function ProvinceWorkspacePlaceholder({
  route,
  onNavigate,
}: {
  route: ProvinceWorkspaceRouteTarget;
  onNavigate: (path: string) => void;
}) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const routeProvinceId = route.valid ? route.province.id : null;

  useEffect(() => {
    if (routeProvinceId) {
      dispatch({ type: "selectProvince", provinceId: routeProvinceId });
    }
  }, [dispatch, routeProvinceId]);

  if (!route.valid) return <ProvinceRouteNotFound slug={route.slug} onNavigate={onNavigate} />;

  const province = route.province;
  const name = provinceName(province);
  const record = getProvinceRecord(province.id, state.selectedMonth);
  const context = monthContext(state.selectedMonth);
  const trend = getProvinceTrend(province.id, 6);
  const layer = getMapLayer(state.mapLayer);
  const layerAvailability = getLayerAvailability(state);
  const layerSources = getLayerSources(layer.id);

  return (
    <div className="province-workspace" aria-label={`พื้นที่จังหวัด${name}`}>
      <section className="province-route-card">
        <button type="button" className="secondary-button" onClick={() => onNavigate("/")}>
          <ArrowLeft size={17} />
          กลับแผนที่ประเทศ
        </button>
        <div className="province-route-copy">
          <span>ประเทศไทย</span>
          <strong>{name}</strong>
        </div>
        <span className="nr-inline-status">โครงหน้าเตรียมไว้</span>
      </section>

      <OperationalFilters
        className="province-local-filters"
        ariaLabel={`ตัวกรองสถานการณ์จังหวัด${name}`}
      />

      <PageSummary
        className="province-situation-hero"
        eyebrow="พื้นที่ปฏิบัติการจังหวัด"
        title={`${name}: ภาพรวมสถานการณ์จังหวัด`}
        description={
          <>
            หน้านี้เป็นโครงหน้าสรุปสถานการณ์ระดับจังหวัดจากแผนที่ประเทศ
            จะแสดงสถานการณ์ น้ำ ฝน และพื้นที่เกษตรเมื่อมีแหล่งข้อมูลจังหวัดที่ตรวจสอบแล้ว
          </>
        }
        metrics={[
          { label: "เดือน", value: `${formatMonth(state.selectedMonth, "th")} · ${labelDataMode(context.mode, "th")}` },
          { label: "ภัยหลัก", value: record ? labelHazard(record.primaryHazard, "th") : "รอข้อมูล" },
          { label: "พื้นที่เกษตรเสี่ยง", value: record ? `${formatRai(record.agriculturalAreaExposedRai)} ไร่` : "รอข้อมูล" },
          { label: "สถานะข้อมูล", value: route.placeholder ? "โครงหน้า" : "พร้อมใช้" },
        ]}
      />

      <nav className="province-situation-tabs" aria-label="มุมมองจังหวัดที่เตรียมไว้">
        <button type="button" className="active">ภาพรวม</button>
        <button type="button" disabled>น้ำ</button>
        <button type="button" disabled>ฝน</button>
        <button type="button" disabled>พื้นที่เกษตร</button>
      </nav>

      <section className="province-dashboard-grid">
        <PlaceholderPanel icon={<Map size={18} />} eyebrow="แผนที่จังหวัด" title="แผนที่สถานการณ์">
          <div className="province-placeholder-map">
            <span className="nr-inline-status">รอขอบเขตย่อยที่ยืนยัน</span>
            <strong>{name}</strong>
            <p>เมื่อมีขอบเขตอำเภอ/ตำบลและชั้นข้อมูลจังหวัดที่ตรวจสอบย้อนกลับได้ พื้นที่นี้จะกลายเป็นแผนที่เจาะพื้นที่แบบเดียวกับนครราชสีมา</p>
          </div>
        </PlaceholderPanel>

        <div className="province-dashboard-side">
          <PlaceholderPanel icon={<ShieldAlert size={18} />} eyebrow="สถานการณ์วันนี้" title="สิ่งที่ต้องติดตาม">
            {record ? (
              <>
                <div className="status-row">
                  <span className={`severity-pill ${severityTone[record.severity]}`}>{severityLabel(record.severity, "th")}</span>
                  <span>{labelConfidence(record.confidence, "th")}</span>
                </div>
                <p>{labelMonthNarrative(state.selectedMonth, context.nationalContext, "th")}</p>
              </>
            ) : (
              <p>ยังไม่มี record ระดับจังหวัดสำหรับเดือนนี้</p>
            )}
          </PlaceholderPanel>

        </div>
      </section>

      <section className="province-container-grid">
        <PlaceholderPanel icon={<Database size={18} />} eyebrow="ข้อมูลจังหวัด" title="ยังไม่รองรับจังหวัดนี้">
          <p>ยังไม่มีข้อมูลเฉพาะจังหวัดนี้ในโปรเจกต์ จึงไม่แสดงตัวเลขสถานการณ์เป็นค่าจริง</p>
        </PlaceholderPanel>

        <PlaceholderPanel icon={<Leaf size={18} />} eyebrow="เกษตร" title="บริบทพื้นที่เกษตร">
          {record ? (
            <dl className="province-mini-list">
              <div>
                <dt>พืชที่ได้รับผลกระทบ</dt>
                <dd>{labelCrop(record.mainCropExposure, "th")}</dd>
              </div>
              <div>
                <dt>พื้นที่เสี่ยงสูง</dt>
                <dd>{formatRai(record.highRiskAreaRai)} ไร่</dd>
              </div>
              <div>
                <dt>ที่มาค่าประเมิน</dt>
                <dd className="provenance-corner-host">
                  <DataProvenanceChip kind={dataProvenanceChipKindFromText(record.provenance)} />
                  <span>{labelProvinceProvenance(record.provenance, "th")}</span>
                </dd>
              </div>
            </dl>
          ) : (
            <p>ยังไม่มีข้อมูลเกษตรรายจังหวัดในตัวกรองนี้</p>
          )}
        </PlaceholderPanel>

        <PlaceholderPanel icon={<Waves size={18} />} eyebrow="แนวโน้ม" title="แนวโน้มจากข้อมูลประเทศ">
          <div className="province-trend-row" aria-label="แนวโน้มรายเดือนของจังหวัด">
            {trend.map((item) => (
              <span key={item.month}>
                <i style={{ height: `${Math.max(16, item.score)}%` }} />
                <small>{formatMonth(item.month, "th").slice(0, 3)}</small>
              </span>
            ))}
          </div>
        </PlaceholderPanel>

        <PlaceholderPanel icon={<Database size={18} />} eyebrow="ชั้นข้อมูลปัจจุบัน" title={layer.labelTh}>
          <p className="provenance-corner-host">
            <DataProvenanceChip kind={layer.dataClass} />
            <span>
              {labelLayerGroup(layer.group, "th")} · {labelLayerAvailability(layerAvailability.status, "th")}
            </span>
          </p>
          <p>แหล่งอ้างอิง: {layerSources.map((source) => source.acronym).join(", ") || "รอระบุ"}</p>
        </PlaceholderPanel>
      </section>
    </div>
  );
}
