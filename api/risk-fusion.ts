type ApiRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  end: () => void;
};

type DataClass = "REAL" | "CANONICAL_SYNTHETIC" | "DERIVED" | "RUNTIME_STATE";

type RiskFusionComponent = {
  id: string;
  label: string;
  labelTh: string;
  sourceIds: string[];
  dataClass: DataClass;
  value: string;
  valueTh: string;
  interpretation: string;
  interpretationTh: string;
};

type RiskFusionBreakdown = {
  id: string;
  formula: string;
  formulaTh: string;
  resultLabel: string;
  resultLabelTh: string;
  components: RiskFusionComponent[];
};

const MAIN_EVENT_ID = "ARE-2026-0825-NE";

// Keep this serverless payload self-contained so Vercel does not type-check
// browser-side JSON imports through the Node runtime.
function getRiskFusionBreakdown(eventId: string): RiskFusionBreakdown {
  const resolvedEventId = eventId || MAIN_EVENT_ID;

  return {
    id: `fusion-${resolvedEventId}`,
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
        value: "Official source context",
        valueTh: "บริบทจากแหล่งข้อมูลจริง",
        interpretation: "Official source context frames the hazard, but does not issue this local composite score.",
        interpretationTh: "แหล่งข้อมูลจริงให้บริบทของภัย แต่ไม่ได้ออกคะแนนรวมระดับพื้นที่นี้",
      },
      {
        id: "water",
        label: "Water availability",
        labelTh: "สถานะน้ำ",
        sourceIds: ["SRC-RID", "SRC-HII-THAIWATER", "SRC-DWR-EWS"],
        dataClass: "CANONICAL_SYNTHETIC",
        value: "Seeded event context",
        valueTh: "บริบทเหตุการณ์ที่เตรียมไว้ในต้นแบบ",
        interpretation: "Water context can increase or reduce agricultural impact compared with weather alone.",
        interpretationTh: "สถานะน้ำอาจเพิ่มหรือลดผลกระทบเกษตรเมื่อเทียบกับการดูอากาศเพียงอย่างเดียว",
      },
      {
        id: "crop",
        label: "Crop exposure and stage",
        labelTh: "พื้นที่พืชและระยะพืช",
        sourceIds: ["SRC-OAE", "SRC-GISTDA-DROUGHT"],
        dataClass: "CANONICAL_SYNTHETIC",
        value: "Canonical crop exposure proxy",
        valueTh: "ตัวแทนพื้นที่พืชจากชุดข้อมูลต้นแบบ",
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
        dataClass: "REAL",
        value: "Evidence required before publication",
        valueTh: "ต้องมีหลักฐานก่อนเผยแพร่",
        interpretation: "Pest or disease claims require evidence or field verification before publication.",
        interpretationTh: "ข้อกล่าวอ้างเรื่องศัตรูพืชหรือโรคพืชต้องมีหลักฐานหรือผลตรวจภาคสนามก่อนเผยแพร่",
      },
      {
        id: "verification",
        label: "Field verification",
        labelTh: "ผลตรวจภาคสนาม",
        sourceIds: ["SRC-DWR-EWS", "SRC-DOAE"],
        dataClass: "RUNTIME_STATE",
        value: "Runtime workflow state",
        valueTh: "สถานะงานในต้นแบบ",
        interpretation: "Officer-submitted observations change workflow confidence only inside this demo runtime.",
        interpretationTh: "ผลที่เจ้าหน้าที่ส่งจะเปลี่ยนความเชื่อมั่นเฉพาะในสถานะรันไทม์ของต้นแบบ",
      },
    ],
  };
}

function readQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "private, no-store");

  if (request.method && request.method !== "GET") {
    response.status(405).end();
    return;
  }

  const eventId = readQueryValue(request.query.eventId) ?? "ARE-2026-0825-NE";
  response.status(200).json(getRiskFusionBreakdown(eventId));
}
