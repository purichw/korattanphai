import { eventEnrichment, riskEvents } from "./data/catalog";
import type { EventEnrichment, RiskFusionBreakdown } from "./types";

const MAIN_EVENT_ID = "ARE-2026-0825-NE";

function getEventEnrichmentForFusion(eventId: string): EventEnrichment {
  return eventEnrichment[eventId] ?? eventEnrichment[MAIN_EVENT_ID];
}

export function getRiskFusionBreakdown(eventId: string): RiskFusionBreakdown {
  const event = riskEvents.find((item) => item.id === eventId) ?? riskEvents[0];
  const enrichment = getEventEnrichmentForFusion(event.id);
  const waterDriver = enrichment.drivers.find((driver) => /water|soil|rain|flood|runoff/i.test(driver.label));
  const cropDriver = enrichment.drivers.find((driver) => /crop|sensitivity|stage/i.test(driver.label));
  const pestDriver = enrichment.drivers.find((driver) => /disease|humidity|wetness/i.test(driver.label));
  return {
    id: `fusion-${event.id}`,
    formula: "Hazard x Exposure x Vulnerability x Crop-stage sensitivity x Confidence adjustment",
    formulaTh: "ภัย + พื้นที่พืชที่เกี่ยวข้อง + ความเปราะบาง + ระยะพืช + การปรับด้วยความเชื่อมั่น",
    resultLabel: "DERIVED PROTOTYPE RISK",
    resultLabelTh: "ความเสี่ยงต้นแบบที่ระบบคำนวณ",
    components: [
      {
        id: "hazard",
        label: "Weather / hazard evidence",
        labelTh: "หลักฐานอากาศหรือภัย",
        sourceIds: ["SRC-TMD", "SRC-GISTDA-DROUGHT", "SRC-GISTDA-FLOOD"],
        dataClass: "REAL",
        value: waterDriver?.value ?? event.hazard,
        valueTh: waterDriver?.value ?? event.hazard,
        interpretation: "Official source context frames the hazard, but does not issue this local composite score.",
        interpretationTh: "แหล่งข้อมูลจริงให้บริบทของภัย แต่ไม่ได้ออกคะแนนรวมระดับพื้นที่นี้",
      },
      {
        id: "water",
        label: "Water availability",
        labelTh: "สถานะน้ำ",
        sourceIds: ["SRC-RID", "SRC-DWR-EWS"],
        dataClass: "CANONICAL_SYNTHETIC",
        value: String(enrichment.evidence.waterAvailability ?? waterDriver?.value ?? "Seeded event context"),
        valueTh: String(enrichment.evidence.waterAvailability ?? waterDriver?.value ?? "บริบทเหตุการณ์ที่เตรียมไว้ในต้นแบบ"),
        interpretation: "Water context can increase or reduce agricultural impact compared with weather alone.",
        interpretationTh: "สถานะน้ำอาจเพิ่มหรือลดผลกระทบเกษตรเมื่อเทียบกับการดูอากาศเพียงอย่างเดียว",
      },
      {
        id: "crop",
        label: "Crop exposure and stage",
        labelTh: "พื้นที่พืชและระยะพืช",
        sourceIds: ["SRC-OAE", "SRC-GISTDA-DROUGHT"],
        dataClass: "CANONICAL_SYNTHETIC",
        value: cropDriver?.value ?? event.crops.map((crop) => crop.crop).join(", "),
        valueTh: cropDriver?.value ?? event.crops.map((crop) => crop.crop).join(", "),
        interpretation: "The current prototype still uses canonical crop exposure proxies unless real OAE/GISTDA values are ingested.",
        interpretationTh: "ต้นแบบยังใช้ตัวแทนพื้นที่พืชจากชุดข้อมูลต้นแบบ จนกว่าจะนำเข้าค่า OAE/GISTDA จริง",
      },
      {
        id: "planning",
        label: "Suitability / structural vulnerability",
        labelTh: "ความเหมาะสมที่ดินและความเปราะบางเชิงโครงสร้าง",
        sourceIds: ["SRC-AGRIMAP-LDD"],
        dataClass: "REAL",
        value: "Reference context",
        valueTh: "บริบทอ้างอิง",
        interpretation: "Suitability informs vulnerability and planning; it is not emergency severity.",
        interpretationTh: "ความเหมาะสมที่ดินช่วยอธิบายความเปราะบางและการวางแผน ไม่ใช่ระดับภัยฉุกเฉิน",
      },
      {
        id: "biological",
        label: "Pest / disease evidence",
        labelTh: "หลักฐานศัตรูพืชหรือโรคพืช",
        sourceIds: ["SRC-DOAE"],
        dataClass: pestDriver ? "CANONICAL_SYNTHETIC" : "REAL",
        value: pestDriver?.value ?? "No seeded pest escalation for this event",
        valueTh: pestDriver?.value ?? "เหตุการณ์นี้ยังไม่มีการยกระดับศัตรูพืชที่เตรียมไว้ในต้นแบบ",
        interpretation: "Pest or disease claims require evidence or field verification before publication.",
        interpretationTh: "ข้อกล่าวอ้างเรื่องศัตรูพืชหรือโรคพืชต้องมีหลักฐานหรือผลตรวจภาคสนามก่อนเผยแพร่",
      },
      {
        id: "verification",
        label: "Field verification",
        labelTh: "ผลตรวจภาคสนาม",
        sourceIds: ["SRC-DWR-EWS", "SRC-DOAE"],
        dataClass: "RUNTIME_STATE",
        value: event.workflow.verification,
        valueTh: event.workflow.verification,
        interpretation: "Officer-submitted observations change workflow confidence only inside this demo runtime.",
        interpretationTh: "ผลที่เจ้าหน้าที่ส่งจะเปลี่ยนความเชื่อมั่นเฉพาะในสถานะรันไทม์ของต้นแบบ",
      },
    ],
  };
}
