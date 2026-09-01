import type { Language, MapLayerRecord, PersonaRole, Severity } from "./types";

type Key =
  | "brand"
  | "tagline"
  | "overview"
  | "risks"
  | "map"
  | "forecast"
  | "crops"
  | "workflows"
  | "alerts"
  | "planning"
  | "models"
  | "language"
  | "persona"
  | "month"
  | "hazard"
  | "crop"
  | "all"
  | "asOf"
  | "province"
  | "severity"
  | "confidence"
  | "status"
  | "exposedArea"
  | "highRiskArea"
  | "topRisks"
  | "actionRequired"
  | "agricultureAtRisk"
  | "areaProfile"
  | "openEvent"
  | "evidence"
  | "riskLayer"
  | "evidenceLayer"
  | "officialContext"
  | "prototypeAssessment"
  | "resetDemo"
  | "submitVerification"
  | "submitReview"
  | "approve"
  | "requestChanges"
  | "publish"
  | "farmerView"
  | "dataNotice"
  | "notSeeded";

const dictionary: Record<Key, Record<Language, string>> = {
  brand: { th: "โคราชทันภัย", en: "Korat Tan Phai" },
  tagline: {
    th: "ข่าวกรองความเสี่ยงเกษตรและการเตือนภัยล่วงหน้าจังหวัดนครราชสีมา",
    en: "Nakhon Ratchasima agricultural risk intelligence and early action",
  },
  overview: { th: "ภาพรวม", en: "Overview" },
  risks: { th: "เหตุการณ์เสี่ยง", en: "Risks" },
  map: { th: "แผนที่", en: "Map" },
  forecast: { th: "คาดการณ์", en: "Forecast" },
  crops: { th: "พืช", en: "Crops" },
  workflows: { th: "งานภาคสนาม", en: "Workflows" },
  alerts: { th: "แจ้งเตือน", en: "Alerts" },
  planning: { th: "แผน/วิเคราะห์", en: "Planning" },
  models: { th: "ข้อมูล/แบบจำลอง", en: "Data & Models" },
  language: { th: "ภาษา", en: "Language" },
  persona: { th: "บทบาท", en: "Persona" },
  month: { th: "เดือน", en: "Month" },
  hazard: { th: "ภัย", en: "Hazard" },
  crop: { th: "พืช", en: "Crop" },
  all: { th: "ทั้งหมด", en: "All" },
  asOf: { th: "ข้อมูล ณ", en: "As of" },
  province: { th: "จังหวัด", en: "Province" },
  severity: { th: "ระดับเสี่ยง", en: "Severity" },
  confidence: { th: "ความเชื่อมั่น", en: "Confidence" },
  status: { th: "สถานะ", en: "Status" },
  exposedArea: { th: "พื้นที่เกษตรเสี่ยง", en: "Agriculture exposed" },
  highRiskArea: { th: "พื้นที่เสี่ยงสูง", en: "High-risk area" },
  topRisks: { th: "ความเสี่ยงเร่งด่วน", en: "Top risks" },
  actionRequired: { th: "งานที่ต้องทำ", en: "Action required" },
  agricultureAtRisk: { th: "พืชที่ได้รับผลกระทบ", en: "Agriculture at risk" },
  areaProfile: { th: "โปรไฟล์พื้นที่", en: "Area profile" },
  openEvent: { th: "เปิดเหตุการณ์", en: "Open event" },
  evidence: { th: "หลักฐาน", en: "Evidence" },
  riskLayer: { th: "ชั้นความเสี่ยง", en: "Risk layer" },
  evidenceLayer: { th: "ชั้นหลักฐาน", en: "Evidence layer" },
  officialContext: { th: "บริบททางการ", en: "Official context" },
  prototypeAssessment: { th: "ค่าประเมินประกอบ", en: "Prototype assessment" },
  resetDemo: { th: "คืนค่าข้อมูลเริ่มต้น", en: "Reset data" },
  submitVerification: { th: "ส่งผลตรวจภาคสนาม", en: "Submit verification" },
  submitReview: { th: "ส่งตรวจอนุมัติ", en: "Submit for review" },
  approve: { th: "อนุมัติ", en: "Approve" },
  requestChanges: { th: "ขอแก้ไข", en: "Request changes" },
  publish: { th: "เผยแพร่", en: "Publish" },
  farmerView: { th: "มุมมองเกษตรกร", en: "Farmer view" },
  dataNotice: {
    th: "คะแนนระดับจังหวัด/อำเภอเป็นข้อมูลประกอบการประเมิน ไม่ใช่ประกาศทางการ",
    en: "Province and local risk scores are synthetic prototype values, not official warnings.",
  },
  notSeeded: {
    th: "พื้นที่นี้ยังไม่มีข้อมูลระดับท้องถิ่น",
    en: "Detailed local demo data is not seeded for this area.",
  },
};

const severityLabels: Record<Severity, Record<Language, string>> = {
  Normal: { th: "ปกติ", en: "Normal" },
  Watch: { th: "เฝ้าระวัง", en: "Watch" },
  Warning: { th: "เตือนภัย", en: "Warning" },
  Severe: { th: "รุนแรง", en: "Severe" },
};

const monthFormatter = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  month: "short",
  year: "numeric",
});

const monthFormatterEn = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
});

export function t(key: Key, language: Language) {
  return dictionary[key][language];
}

export function severityLabel(severity: Severity, language: Language) {
  return severityLabels[severity][language];
}

export function formatMonth(month: string, language: Language) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1, 1);
  return language === "th" ? monthFormatter.format(date) : monthFormatterEn.format(date);
}

export function displayAll(language: Language) {
  return t("all", language);
}

export const hazardTh: Record<string, string> = {
  "Agricultural Water Stress": "เครียดน้ำเกษตร",
  "Crop Stress": "พืชเครียด",
  "Disease Risk": "เสี่ยงโรคพืช",
  "Dry Spell / Rainfall Deficit": "ฝนทิ้งช่วง",
  "Dry-season Irrigation Pressure": "แรงกดดันน้ำชลประทาน",
  "Flash Flood": "น้ำป่า/น้ำหลาก",
  "Flood / Excess Rainfall": "น้ำท่วม/ฝนมาก",
  "Heat Stress": "ร้อนจัด",
  "Heavy Rainfall": "ฝนหนัก",
  "River Flood / Waterlogging": "น้ำล้นตลิ่ง/น้ำขัง",
  "Seasonal Transition": "เปลี่ยนฤดู",
  "Storm / Strong Wind": "พายุ/ลมแรง",
  "Multi-Hazard Seasonal Transition": "เปลี่ยนฤดูหลายภัย",
};

export const cropTh: Record<string, string> = {
  Cassava: "มันสำปะหลัง",
  Durian: "ทุเรียน",
  Fruit: "ไม้ผล",
  Horticulture: "พืชสวน",
  Longan: "ลำไย",
  Maize: "ข้าวโพด",
  "Mixed Agriculture": "เกษตรผสมผสาน",
  "Oil Palm": "ปาล์มน้ำมัน",
  Rice: "ข้าว",
  Rubber: "ยางพารา",
  Sugarcane: "อ้อย",
};

export function labelHazard(hazard: string, language: Language) {
  if (hazard === "All") return displayAll(language);
  return language === "th" ? hazardTh[hazard] ?? hazard : hazard;
}

export function labelCrop(crop: string, language: Language) {
  if (crop === "All") return displayAll(language);
  return language === "th" ? cropTh[crop] ?? crop : crop;
}

const cropConditionTh: Record<string, string> = {
  "Favourable / Watch by location": "เอื้ออำนวย แต่ต้องเฝ้าระวังตามพื้นที่",
  Watch: "เฝ้าระวัง",
};

export function labelCropCondition(condition: string, language: Language) {
  return language === "th" ? cropConditionTh[condition] ?? condition : condition;
}

const cropStageTh: Record<string, string> = {
  "Grand growth in seeded western scenario": "ระยะเจริญเติบโตเต็มที่ในฉากจำลองภาคตะวันตก",
  "Harvest / post-harvest in seeded eastern scenario": "ระยะเก็บเกี่ยวและหลังเก็บเกี่ยวในฉากจำลองภาคตะวันออก",
  Mixed: "หลายระยะการเจริญเติบโต",
  "Mixed production stages": "หลายระยะการผลิต",
  "Vegetative to tillering in seeded demo areas": "ระยะเจริญทางใบถึงแตกกอในพื้นที่ที่มีข้อมูลรองรับ",
};

export function labelCropStageSummary(summary: string, language: Language) {
  return language === "th" ? cropStageTh[summary] ?? summary : summary;
}

const cropOutlookTh: Record<string, string> = {
  "Heavy rain may affect access/logistics in selected western areas.":
    "ฝนหนักอาจกระทบการเข้าพื้นที่และโลจิสติกส์ในบางพื้นที่ภาคตะวันตก",
  "Mixed: localized flood/excess-water risk and localized water-management stress can coexist.":
    "ต้องติดตามทั้งความเสี่ยงน้ำมากเฉพาะพื้นที่และความเครียดจากการจัดการน้ำในแปลง ซึ่งอาจเกิดพร้อมกันได้",
  "Use province risk context; no dedicated cassava event is seeded.":
    "ใช้บริบทความเสี่ยงระดับจังหวัดเป็นหลัก โดยยังไม่มีเหตุการณ์เฉพาะของมันสำปะหลังในข้อมูลปัจจุบัน",
  "Use province risk context; no dedicated maize event is seeded.":
    "ใช้บริบทความเสี่ยงระดับจังหวัดเป็นหลัก โดยยังไม่มีเหตุการณ์เฉพาะของข้าวโพดในข้อมูลปัจจุบัน",
  "Wind/heavy-rain disruption risk in selected orchard areas.":
    "ลมแรงและฝนหนักอาจรบกวนการจัดการสวนในบางพื้นที่ไม้ผล",
};

export function labelCropOutlook(outlook: string, language: Language) {
  return language === "th" ? cropOutlookTh[outlook] ?? outlook : outlook;
}

const cropPresenceRuleTh: Record<string, string> = {
  "Use province-month records where mainCropExposure == Cassava.":
    "ใช้รายการจังหวัด-เดือนที่ระบุพืชหลักเป็นมันสำปะหลังเป็นตัวแทนพื้นที่เพาะปลูกในต้นแบบ",
  "Use province-month records where mainCropExposure == Durian where present; otherwise use seeded eastern event only.":
    "ใช้รายการจังหวัด-เดือนที่ระบุพืชหลักเป็นทุเรียนเมื่อมีข้อมูล และใช้เหตุการณ์ภาคตะวันออกที่เตรียมไว้เป็นข้อมูลประกอบ",
  "Use province-month records where mainCropExposure == Maize.":
    "ใช้รายการจังหวัด-เดือนที่ระบุพืชหลักเป็นข้าวโพดเป็นตัวแทนพื้นที่เพาะปลูกในต้นแบบ",
  "Use province-month records where mainCropExposure == Rice as the synthetic crop-presence proxy.":
    "ใช้รายการจังหวัด-เดือนที่ระบุพืชหลักเป็นข้าวเป็นตัวแทนพื้นที่เพาะปลูกในข้อมูลต้นแบบ",
  "Use province-month records where mainCropExposure == Sugarcane.":
    "ใช้รายการจังหวัด-เดือนที่ระบุพืชหลักเป็นอ้อยเป็นตัวแทนพื้นที่เพาะปลูกในต้นแบบ",
};

export function labelCropPresenceRule(rule: string, language: Language) {
  return language === "th" ? cropPresenceRuleTh[rule] ?? rule : rule;
}

const cropActionTh: Record<string, string> = {
  "Adjust harvest timing when practical": "ปรับช่วงเก็บเกี่ยวเมื่อทำได้อย่างปลอดภัย",
  "Adjust logistics around heavy-rain periods": "ปรับแผนขนส่งรอบช่วงฝนหนัก",
  "Check field water status": "ตรวจสถานะน้ำในแปลง",
  "Follow crop-stage-specific advice": "ปฏิบัติตามคำแนะนำให้เหมาะกับระยะพืช",
  "Inspect damage after strong-wind events": "ตรวจความเสียหายหลังเกิดลมแรง",
  "Inspect lodging after storms": "ตรวจพืชล้มหลังพายุ",
  "Monitor drainage": "ติดตามการระบายน้ำ",
  "Monitor moisture stress in uneven-rainfall areas": "ติดตามภาวะเครียดน้ำในพื้นที่ที่ฝนตกไม่สม่ำเสมอ",
  "Monitor rainfall distribution and soil moisture": "ติดตามการกระจายตัวของฝนและความชื้นดิน",
  "Monitor waterlogging in heavy-rain areas": "ติดตามน้ำขังในพื้นที่ฝนหนัก",
  "Plan field access": "วางแผนการเข้าพื้นที่",
  "Prioritize drainage or supplementary irrigation according to local condition":
    "จัดลำดับการระบายน้ำหรือให้น้ำเสริมตามสภาพพื้นที่จริง",
  "Secure vulnerable orchard infrastructure": "เสริมความมั่นคงโครงสร้างสวนที่เปราะบาง",
};

export function labelCropAction(action: string, language: Language) {
  return language === "th" ? cropActionTh[action] ?? action : action;
}

const dataModeTh: Record<string, string> = {
  "Current operational month": "เดือนปฏิบัติการปัจจุบัน",
  "Forecast / outlook": "คาดการณ์ล่วงหน้า",
  "Observed / historical context": "ข้อมูลย้อนหลังที่สังเกตแล้ว",
};

export function labelDataMode(mode: string, language: Language) {
  return language === "th" ? dataModeTh[mode] ?? mode : mode;
}

const backboneLabelTh: Record<string, string> = {
  "August 2026": "สิงหาคม 2569",
  "July 2026": "กรกฎาคม 2569",
  "June 2026": "มิถุนายน 2569",
  "October 2026": "ตุลาคม 2569",
  "September 2026": "กันยายน 2569",
};

export function labelBackboneLabel(label: string, language: Language) {
  return language === "th" ? backboneLabelTh[label] ?? label : label;
}

const sourceTypeTh: Record<string, string> = {
  "Official 3-month + agrometeorological forecast horizon":
    "แนวโน้มทางการระยะ 3 เดือนและอุตุนิยมเกษตร",
  "Official monthly forecast": "พยากรณ์รายเดือนทางการ",
  "Official monthly/agricultural outlook + short-range agromet updates":
    "แนวโน้มรายเดือน/เกษตรทางการ และข้อมูลอุตุนิยมเกษตรระยะสั้น",
  "Official observed monthly summary": "สรุปรายเดือนจากข้อมูลตรวจอากาศจริง",
};

export function labelSourceType(sourceType: string, language: Language) {
  return language === "th" ? sourceTypeTh[sourceType] ?? sourceType : sourceType;
}

const sourceTh: Record<string, string> = {
  "Thai Meteorological Department": "กรมอุตุนิยมวิทยา",
};

export function labelSource(source: string, language: Language) {
  return language === "th" ? sourceTh[source] ?? source : source;
}

const layerGroupTh: Record<MapLayerRecord["group"], string> = {
  risk: "ความเสี่ยง",
  agriculture: "เกษตร",
  hydrology: "น้ำ",
  weather: "อากาศ",
  planning: "วางแผน",
  operations: "ปฏิบัติการ",
};

export function labelLayerGroup(group: MapLayerRecord["group"], language: Language) {
  return language === "th" ? layerGroupTh[group] : group;
}

const availabilityTh: Record<string, string> = {
  available: "มีข้อมูล",
  "low-risk": "มีข้อมูล: ระดับปกติ",
  "no-data": "ไม่มีข้อมูลในชุดนี้",
  "source-unavailable": "ยังไม่เชื่อมแหล่งข้อมูลสด",
  unsupported: "ไม่รองรับบริบทนี้",
};

export function labelLayerAvailability(status: string, language: Language) {
  return language === "th" ? availabilityTh[status] ?? status : status;
}

const prototypeUseTh: Record<string, string> = {
  "Allow October forecast exploration. Keep local province/district risk classifications synthetic unless a specific official local source is integrated.":
    "ใช้สำรวจแนวโน้มเดือนตุลาคม โดยคงการจัดระดับความเสี่ยงจังหวัด/อำเภอเป็นข้อมูลสังเคราะห์จนกว่าจะเชื่อมแหล่งข้อมูลท้องถิ่นทางการ",
  "Default month. Mix current monitoring, 7-day forecast, active field verification and advisory workflows.":
    "เดือนหลักของระบบ ใช้รวมการติดตามปัจจุบัน พยากรณ์ 7 วัน งานตรวจภาคสนาม และกระบวนการออกคำแนะนำ",
  "Demonstrate simultaneous flood/excess-rainfall risk and intermittent dry-spell risk. Local event scores are synthetic.":
    "ใช้สาธิตว่าความเสี่ยงน้ำท่วม/ฝนมากและฝนทิ้งช่วงเป็นช่วง ๆ อาจเกิดร่วมกันได้ คะแนนเหตุการณ์ระดับพื้นที่เป็นข้อมูลสังเคราะห์",
  "Show a forward-looking national risk outlook dominated by water-related hazards in vulnerable locations, while still allowing other agricultural risks.":
    "ใช้แสดงแนวโน้มความเสี่ยงระดับประเทศล่วงหน้า โดยเน้นภัยด้านน้ำในพื้นที่เปราะบางและยังรองรับความเสี่ยงเกษตรประเภทอื่น",
  "Use as retrospective context for agricultural water stress, delayed planting, and uneven rainfall. Local event scores are synthetic.":
    "ใช้เป็นบริบทย้อนหลังสำหรับภาวะเครียดน้ำเกษตร การปลูกล่าช้า และฝนกระจายตัวไม่สม่ำเสมอ คะแนนเหตุการณ์ระดับพื้นที่เป็นข้อมูลสังเคราะห์",
};

export function labelPrototypeUse(text: string, language: Language) {
  return language === "th" ? prototypeUseTh[text] ?? text : text;
}

const provinceProvenanceTh: Record<string, string> = {
  "Synthetic province-level prototype risk; national/regional temporal context is source-grounded in TMD publications.":
    "คะแนนความเสี่ยงระดับจังหวัดเป็นข้อมูลสังเคราะห์สำหรับต้นแบบ ส่วนบริบทเวลาในระดับประเทศ/ภูมิภาคอ้างอิงเอกสารของกรมอุตุนิยมวิทยา",
};

export function labelProvinceProvenance(text: string, language: Language) {
  return language === "th" ? provinceProvenanceTh[text] ?? text : text;
}

const priorityTh: Record<string, string> = {
  High: "สำคัญมาก",
  Severe: "เร่งด่วนสูง",
  Warning: "เตือนภัย",
};

export function labelPriority(priority: string, language: Language) {
  return language === "th" ? priorityTh[priority] ?? labelStatus(priority, language) : priority;
}

const locationTh: Record<string, string> = {
  "Ban Phai": "บ้านไผ่",
  "Bang Sai": "บางซ้าย",
  "Demo Rice Community": "ชุมชนนาข้าวต้นแบบ",
  "Demo Rice Farm": "แปลงนาข้าวต้นแบบ",
  "Khlong Narai": "คลองนารายณ์",
  "Ko Phlapphla": "เกาะพลับพลา",
  "Mae Rim": "แม่ริม",
  "Mueang Chanthaburi": "เมืองจันทบุรี",
  "Mueang Ratchaburi": "เมืองราชบุรี",
  "Nai Mueang": "ในเมือง",
  "Northern basin demo group": "กลุ่มลุ่มน้ำภาคเหนือต้นแบบ",
  Phunphin: "พุนพิน",
  "Rim Tai": "ริมใต้",
  "Tha Kham": "ท่าข้าม",
};

export function labelLocationName(name: string, language: Language) {
  return language === "th" ? locationTh[name] ?? name : name;
}

const fieldChecklistTh: Record<string, string> = {
  "Ask about recent rainfall and irrigation access": "สอบถามฝนล่าสุดและการเข้าถึงน้ำชลประทาน",
  "Assess visible leaf rolling/stress": "ประเมินอาการใบม้วนหรือพืชเครียดที่เห็นได้",
  "Check drainage condition": "ตรวจสภาพการระบายน้ำ",
  "Check inundation depth": "ตรวจระดับน้ำท่วมขัง",
  "Check standing field water": "ตรวจระดับน้ำขังในแปลง",
  "Confirm crop stage": "ยืนยันระยะการเจริญเติบโตของพืช",
  "Record access disruption": "บันทึกข้อจำกัดการเข้าพื้นที่",
  "Record farmer-reported constraints": "บันทึกข้อจำกัดที่เกษตรกรรายงาน",
};

export function labelFieldChecklist(item: string, language: Language) {
  return language === "th" ? fieldChecklistTh[item] ?? item : item;
}

const fieldObservationTh: Record<string, string> = {
  "Constrained in selected rain-fed fields": "จำกัดในนาน้ำฝนบางพื้นที่",
  "Declining between rain episodes": "ลดลงในช่วงเว้นระหว่างฝน",
  "Drying between rain episodes": "เริ่มแห้งลงระหว่างช่วงฝน",
  "Excess water": "น้ำมากเกิน",
  Limited: "จำกัด",
  "Leaf rolling in some plots": "พบใบม้วนในบางแปลง",
  Low: "ต่ำ",
  "Mock photo attached": "แนบภาพตัวอย่างแล้ว",
  "Prototype pre-seeded partial observation.": "ข้อมูลสังเกตการณ์บางส่วนที่เตรียมไว้สำหรับต้นแบบ",
  "Representative demo observation": "บันทึกตัวอย่างสำหรับต้นแบบ",
  "Supplementary irrigation delayed": "การให้น้ำเสริมล่าช้า",
  Tillering: "ระยะแตกกอ",
  Vegetative: "ระยะเจริญทางใบ",
  "Wet / localized inundation": "เปียกชื้นและมีน้ำท่วมขังเฉพาะจุด",
};

export function labelFieldObservation(value: string | undefined, language: Language) {
  if (!value) return "";
  return language === "th" ? fieldObservationTh[value] ?? value : value;
}

const advisoryTitleTh: Record<string, string> = {
  "Field water-management advisory for rain-fed rice areas":
    "คำแนะนำจัดการน้ำสำหรับพื้นที่นาข้าวนาน้ำฝน",
};

export function labelAdvisoryTitle(title: string, language: Language) {
  return language === "th" ? advisoryTitleTh[title] ?? title : title;
}

const advisorySummaryTh: Record<string, string> = {
  "Short intense rainfall and uneven distribution can still leave some rain-fed rice fields under water-management stress. This local risk assessment is synthetic and used for prototype demonstration.":
    "ฝนตกหนักช่วงสั้นและกระจายตัวไม่สม่ำเสมอ อาจทำให้นาข้าวนาน้ำฝนบางพื้นที่ยังมีภาวะเครียดจากการจัดการน้ำ การประเมินระดับพื้นที่นี้เป็นข้อมูลประกอบการตัดสินใจ",
};

export function labelAdvisorySummary(summary: string, language: Language) {
  return language === "th" ? advisorySummaryTh[summary] ?? summary : summary;
}

const channelTh: Record<string, string> = {
  Email: "อีเมล",
  "Farmer app": "แอปเกษตรกร",
  "LINE-like channel": "ช่องทาง LINE",
  "PDF bulletin": "เอกสาร PDF",
  Push: "แจ้งเตือนผ่านแอป",
  SMS: "SMS",
  "Voice / IVR": "เสียงตอบรับอัตโนมัติ",
  "Web portal": "เว็บพอร์ทัล",
};

export function labelChannel(channel: string, language: Language) {
  return language === "th" ? channelTh[channel] ?? channel : channel;
}

const farmNameTh: Record<string, string> = {
  "Demo Rice Farm": "แปลงนาข้าวต้นแบบ",
};

const farmerCropStageTh: Record<string, string> = {
  Tillering: "ระยะแตกกอ",
};

export function labelFarmName(name: string, language: Language) {
  return language === "th" ? farmNameTh[name] ?? name : name;
}

export function labelFarmerCropStage(stage: string, language: Language) {
  return language === "th" ? farmerCropStageTh[stage] ?? stage : stage;
}

const outcomeProvenanceTh: Record<string, string> = {
  "Synthetic dashboard outcome metric derived from prototype workflow state.":
    "ตัวชี้วัดผลลัพธ์สังเคราะห์จากสถานะกระบวนงานในต้นแบบ",
  "SYNTHETIC prototype outcome metrics.": "ตัวชี้วัดผลลัพธ์เป็นข้อมูลสังเคราะห์สำหรับต้นแบบ",
};

export function labelOutcomeProvenance(text: string, language: Language) {
  return language === "th" ? outcomeProvenanceTh[text] ?? text : text;
}

const modelFamilyTh: Record<string, string> = {
  Agriculture: "เกษตรกรรม",
  Forecast: "พยากรณ์",
  Hydrology: "อุทกวิทยา",
  Meteorology: "อุตุนิยมวิทยา",
  "Satellite / agricultural drought": "ดาวเทียมและภัยแล้งเกษตร",
  "Satellite vegetation": "ดาวเทียมด้านพืชพรรณ",
  "Soil moisture": "ความชื้นดิน",
};

const modelNameTh: Record<string, string> = {
  "Demo Crop Exposure / Crop Stage": "ชั้นข้อมูลต้นแบบพื้นที่พืชและระยะพืช",
  "Demo Hydrological Risk Layer": "ชั้นข้อมูลต้นแบบความเสี่ยงอุทกวิทยา",
  "Demo Soil Moisture Layer": "ชั้นข้อมูลความชื้นดิน",
  "Demo Vegetation Stress Layer": "ชั้นข้อมูลความเครียดพืช",
  "GISTDA Crops Drought pattern": "รูปแบบภัยแล้งพืชจาก GISTDA",
  "TMD monthly / 3-month / agromet outlook": "แนวโน้มรายเดือน/3 เดือน/อุตุนิยมเกษตร จากกรมอุตุนิยมวิทยา",
  "TMD observed/monthly summaries": "สรุปข้อมูลตรวจอากาศและรายเดือนจากกรมอุตุนิยมวิทยา",
};

const modelCoverageTh: Record<string, string> = {
  "Nationwide province summaries + seeded deep areas": "สรุประดับจังหวัดทั่วประเทศและพื้นที่ลึกที่เตรียมข้อมูลไว้",
  "Seeded demo areas": "พื้นที่ที่เตรียมข้อมูลไว้",
  "Seeded flood demo areas": "พื้นที่ด้านน้ำท่วมที่เตรียมข้อมูลไว้",
  Thailand: "ประเทศไทย",
  "Thailand / national-regional context": "ประเทศไทยและบริบทระดับประเทศ/ภูมิภาค",
  "Thailand / published forecast scope": "ประเทศไทยตามขอบเขตพยากรณ์ที่เผยแพร่",
};

const modelFreshnessTh: Record<string, string> = {
  "2026-08-24": "24 ส.ค. 2569",
  "2026-08-25": "25 ส.ค. 2569",
  "2026-08-25 08:00": "25 ส.ค. 2569 08:00 น.",
  "As published": "ตามรอบเผยแพร่",
  "Reference capability": "ใช้เป็นข้อมูลอ้างอิง",
  "Varies by product": "แตกต่างตามผลิตภัณฑ์ข้อมูล",
};

const modelVersionTh: Record<string, string> = {
  "demo-v1": "รุ่นข้อมูล 1",
  "External reference": "แหล่งอ้างอิงภายนอก",
  "Official source product": "ผลิตภัณฑ์ข้อมูลทางการ",
};

const modelLimitationsTh: Record<string, string> = {
  "Do not infer unsupported local agricultural impact from national summaries.":
    "ไม่ควรสรุปผลกระทบเกษตรระดับพื้นที่จากสรุประดับประเทศหากไม่มีข้อมูลสนับสนุน",
  "Local prototype risk scores are not official TMD forecasts.":
    "คะแนนความเสี่ยงระดับพื้นที่ในต้นแบบไม่ใช่พยากรณ์ทางการของกรมอุตุนิยมวิทยา",
  "Prototype does not ingest live GISTDA data unless separately integrated.":
    "ต้นแบบยังไม่ได้เชื่อมข้อมูล GISTDA แบบสด เว้นแต่จะพัฒนาการเชื่อมต่อเพิ่ม",
  "Province crop exposure and deep-area crop stage are synthetic.":
    "พื้นที่พืชระดับจังหวัดและระยะพืชในพื้นที่ลึกเป็นข้อมูลสังเคราะห์",
  "Synthetic river/flood indices.": "ดัชนีแม่น้ำและน้ำท่วมเป็นข้อมูลสังเคราะห์",
  "Synthetic values.": "ค่าที่แสดงเป็นข้อมูลสังเคราะห์",
  "Synthetic values; VHI-like concept only.": "ค่าที่แสดงเป็นข้อมูลสังเคราะห์ ใช้แนวคิดคล้าย VHI เท่านั้น",
};

const modelProvenanceTh: Record<string, string> = {
  "REAL reference capability": "ความสามารถอ้างอิงจากแหล่งจริง",
  "REAL source family": "กลุ่มแหล่งข้อมูลจริง",
  SYNTHETIC: "ข้อมูลสังเคราะห์",
};

export function labelModelFamily(value: string, language: Language) {
  return language === "th" ? modelFamilyTh[value] ?? value : value;
}

export function labelModelName(value: string, language: Language) {
  return language === "th" ? modelNameTh[value] ?? value : value;
}

export function labelModelCoverage(value: string, language: Language) {
  return language === "th" ? modelCoverageTh[value] ?? value : value;
}

export function labelModelFreshness(value: string, language: Language) {
  return language === "th" ? modelFreshnessTh[value] ?? value : value;
}

export function labelModelVersion(value: string, language: Language) {
  return language === "th" ? modelVersionTh[value] ?? value : value;
}

export function labelModelLimitations(value: string, language: Language) {
  return language === "th" ? modelLimitationsTh[value] ?? value : value;
}

export function labelModelProvenance(value: string, language: Language) {
  return language === "th" ? modelProvenanceTh[value] ?? value : value;
}

const eventTitleTh: Record<string, string> = {
  "ARE-2026-0601": "กลุ่มเสี่ยงเครียดน้ำเกษตรจากฝนต่ำกว่าปกติเดือนมิถุนายน",
  "ARE-2026-0712": "กลุ่มผลกระทบฝนหนักและน้ำท่วมเดือนกรกฎาคม",
  "ARE-2026-0825-N": "เสี่ยงน้ำป่าและน้ำหลากในลุ่มน้ำเกษตรภาคเหนือ",
  "ARE-2026-0825-NE": "ความเครียดน้ำระดับแปลง แม้มีฝนหนักเป็นช่วงในภาคอีสาน",
  "ARE-2026-0825-E": "เสี่ยงลมแรงและฝนหนักต่อพื้นที่ไม้ผลภาคตะวันออก",
  "ARE-2026-0825-S": "เฝ้าระวังความชื้นสูงและโรคพืชในพื้นที่เพาะปลูกภาคใต้",
  "ARE-2026-0901-C": "แนวโน้มน้ำล้นตลิ่งและน้ำขังเดือนกันยายนในภาคกลาง",
  "ARE-2026-0901-W": "เสี่ยงฝนหนักกระทบโลจิสติกส์เกษตรภาคตะวันตก",
  "ARE-2026-1001-TRANS": "แนวโน้มความเสี่ยงเกษตรช่วงเปลี่ยนฤดูเดือนตุลาคม",
};

const eventSummaryTh: Record<string, string> = {
  "ARE-2026-0601":
    "เหตุการณ์ย้อนหลังจากบริบทเดือนมิถุนายนที่ฝนโดยรวมต่ำกว่าปกติ ใช้คะแนนพื้นที่สังเคราะห์เพื่อเทียบความเสี่ยงน้ำ",
  "ARE-2026-0712":
    "กลุ่มเหตุการณ์ย้อนหลังจากช่วงฝนหนักในเดือนกรกฎาคม แสดงผลกระทบน้ำท่วมต่อพื้นที่เกษตรในหลายภูมิภาค",
  "ARE-2026-0825-N":
    "ฝนหนักระยะสั้นอาจทำให้น้ำหลากเร็ว กระทบพื้นที่ลุ่มต่ำ แปลงเชิงเขา และทางเข้าพื้นที่เกษตร",
  "ARE-2026-0825-NE":
    "ฝนตกไม่สม่ำเสมอทำให้บางแปลงนาข้าวยังขาดน้ำในช่วงพืชเริ่มไวต่อน้ำ ต้องตรวจสภาพจริงก่อนออกคำแนะนำ",
  "ARE-2026-0825-E":
    "ลมแรงและฝนหนักอาจกระทบสวนไม้ผลมูลค่าสูง ต้องเตรียมพยุงกิ่ง ระบายน้ำ และสื่อสารพื้นที่เสี่ยง",
  "ARE-2026-0825-S":
    "สภาพชื้นแฉะต่อเนื่องเพิ่มโอกาสโรคพืชในบางพื้นที่ ควรตรวจแปลงและหลีกเลี่ยงการกล่าวอ้างโรคโดยไม่มีหลักฐาน",
  "ARE-2026-0901-C":
    "แนวโน้มเดือนกันยายนอาจทำให้พื้นที่ข้าวลุ่มต่ำเสี่ยงน้ำขัง การเก็บเกี่ยว และโรคพืชหลังฝนต่อเนื่อง",
  "ARE-2026-0901-W":
    "ฝนหนักภาคตะวันตกอาจกระทบการขนส่งเกษตรและการจัดการแปลงในช่วงวางแผนล่วงหน้า",
  "ARE-2026-1001-TRANS":
    "ช่วงเปลี่ยนฤดูต้องติดตามความเสี่ยงหลายชนิดพร้อมกัน โดยใช้คะแนนท้องถิ่นเป็นข้อมูลต้นแบบเท่านั้น",
};

const advisoryActionTh: Record<string, string> = {
  "Check actual field water level before irrigation decisions.":
    "ตรวจระดับน้ำจริงในแปลงก่อนตัดสินใจให้น้ำเพิ่ม",
  "Prioritize water during sensitive crop stages where supply is limited.":
    "จัดลำดับการใช้น้ำให้แปลงที่อยู่ในช่วงพืชไวต่อน้ำก่อน",
  "Report visible crop stress and local water constraints to the extension officer.":
    "แจ้งเจ้าหน้าที่เมื่อพบอาการพืชเครียดหรือข้อจำกัดน้ำในพื้นที่",
  "Avoid treating province-wide rainfall totals as a substitute for field conditions.":
    "อย่าใช้ตัวเลขฝนระดับจังหวัดแทนการตรวจสภาพจริงในแปลง",
};

const monthNarrativeTh: Record<string, string> = {
  "2026-06": "มิถุนายนใช้เป็นบริบทย้อนหลังจากภาวะฝนต่ำกว่าปกติในภาพรวม เพื่อเทียบรูปแบบความเสี่ยงน้ำระดับจังหวัด",
  "2026-07": "กรกฎาคมสะท้อนช่วงฝนหนักและผลกระทบน้ำท่วมในหลายภูมิภาค ใช้เพื่อเปรียบเทียบกับสถานการณ์ปัจจุบัน",
  "2026-08": "สิงหาคมเป็นเดือนปฏิบัติการหลัก มีทั้งฝนหนัก น้ำหลาก ความเครียดน้ำระดับแปลง ลมแรง และโรคพืชในต่างพื้นที่",
  "2026-09": "กันยายนเป็นช่วงคาดการณ์ที่ต้องแปลสัญญาณฝนต่อเนื่องเป็นผลกระทบต่อพืช น้ำขัง และแผนปฏิบัติการล่วงหน้า",
  "2026-10": "ตุลาคมเป็นช่วงเปลี่ยนผ่านฤดู ใช้สำรวจแนวโน้มที่มีแหล่งคาดการณ์รองรับ โดยไม่อ้างคะแนนท้องถิ่นเป็นประกาศทางการ",
};

export function labelEventTitle(eventId: string, fallback: string, language: Language) {
  return language === "th" ? eventTitleTh[eventId] ?? fallback : fallback;
}

export function labelEventSummary(eventId: string, fallback: string, language: Language) {
  return language === "th" ? eventSummaryTh[eventId] ?? fallback : fallback;
}

export function labelAdvisoryAction(action: string, language: Language) {
  return language === "th" ? advisoryActionTh[action] ?? action : action;
}

export function labelMonthNarrative(month: string, fallback: string | string[], language: Language) {
  if (language === "th" && monthNarrativeTh[month]) return monthNarrativeTh[month];
  return Array.isArray(fallback) ? fallback.join(" ") : fallback;
}

const personaRoleTh: Record<PersonaRole, string> = {
  "National Agricultural Officer": "เจ้าหน้าที่เกษตรระดับประเทศ",
  "Provincial Agricultural Officer": "เจ้าหน้าที่เกษตรจังหวัด",
  "District Agricultural Officer": "เจ้าหน้าที่เกษตรอำเภอ",
  "Agricultural Extension Officer": "เจ้าหน้าที่ส่งเสริมการเกษตร",
  "Agricultural / Climate Analyst": "นักวิเคราะห์เกษตรและภูมิอากาศ",
  "Water / Irrigation Authority": "หน่วยงานน้ำและชลประทาน",
  "Supervisor / Approver": "ผู้ตรวจอนุมัติ",
  Farmer: "เกษตรกร",
};

export function labelPersonaRole(role: PersonaRole, language: Language) {
  return language === "th" ? personaRoleTh[role] : role;
}

export function labelPersonaOption(username: string, role: PersonaRole, language: Language) {
  return language === "th" ? labelPersonaRole(role, language) : username;
}

const regionTh: Record<string, string> = {
  North: "ภาคเหนือ",
  Northeast: "ภาคอีสาน",
  East: "ภาคตะวันออก",
  South: "ภาคใต้",
  Central: "ภาคกลาง",
  West: "ภาคตะวันตก",
  "Multi-region": "หลายภูมิภาค",
};

export function labelRegion(region: string, language: Language) {
  return language === "th" ? regionTh[region] ?? region : region;
}

const statusTh: Record<string, string> = {
  Active: "กำลังดำเนินการ",
  Archived: "เก็บประวัติแล้ว",
  Approved: "อนุมัติแล้ว",
  Available: "พร้อมใช้",
  Closed: "ปิดงานแล้ว",
  "Changes Requested": "ส่งกลับให้แก้ไข",
  Draft: "ร่างคำแนะนำ",
  "Draft Ready": "ร่างคำแนะนำพร้อมส่งตรวจ",
  Forecast: "คาดการณ์ล่วงหน้า",
  "In Progress": "กำลังตรวจสอบ",
  Monitoring: "เฝ้าระวัง",
  "Not Published": "ยังไม่เผยแพร่",
  "Not Required": "ไม่ต้องตรวจภาคสนาม",
  "Not Started": "ยังไม่เริ่ม",
  "Not Submitted": "ยังไม่ส่งตรวจ",
  Pending: "รอดำเนินการ",
  Published: "เผยแพร่แล้ว",
  "Published / Monitoring": "เผยแพร่แล้วและติดตามผล",
  "Reference only": "ใช้อ้างอิงเท่านั้น",
  "Ready for Review": "รอตรวจอนุมัติ",
  "Resolved / Historical": "ปิดเหตุการณ์แล้ว",
  Submitted: "ส่งแล้ว",
  "Under Review": "อยู่ระหว่างตรวจสอบ",
  Verified: "ตรวจยืนยันแล้ว",
  "Verified / Advisory Ready": "ยืนยันแล้วและพร้อมจัดทำคำแนะนำ",
};

export function labelStatus(status: string, language: Language) {
  return language === "th" ? statusTh[status] ?? status : status;
}

const confidenceTh: Record<string, string> = {
  Low: "ต่ำ",
  Medium: "ปานกลาง",
  High: "สูง",
};

export function labelConfidence(confidence: string, language: Language) {
  return language === "th" ? confidenceTh[confidence] ?? confidence : confidence;
}

const periodTh: Record<string, string> = {
  "June 2026": "มิถุนายน 2569",
  "July 2026": "กรกฎาคม 2569",
  "25–31 August 2026": "25-31 ส.ค. 2569",
  "25 August–10 September 2026": "25 ส.ค.-10 ก.ย. 2569",
  "Late August–early September 2026": "ปลาย ส.ค.-ต้น ก.ย. 2569",
  "September 2026": "กันยายน 2569",
};

export function labelPeriod(period: string, language: Language) {
  return language === "th" ? periodTh[period] ?? period : period;
}

const organizationTh: Record<string, string> = {
  "Agricultural Logistics Team": "ทีมโลจิสติกส์เกษตร",
  "Central Regional Operations": "ศูนย์ปฏิบัติการภาคกลาง",
  "Crop Health Monitoring Team": "ทีมติดตามสุขภาพพืช",
  "Demo Risk Engine": "ระบบประเมินความเสี่ยงต้นแบบ",
  "Eastern Regional Operations": "ศูนย์ปฏิบัติการภาคตะวันออก",
  "Flood Impact Review": "ทีมทบทวนผลกระทบน้ำท่วม",
  "Flood Preparedness Team": "ทีมเตรียมพร้อมน้ำท่วม",
  "Historical Review": "ทีมทบทวนข้อมูลย้อนหลัง",
  "Khon Kaen Extension Verification Team": "ทีมตรวจภาคสนามจังหวัดขอนแก่น",
  "National Agricultural Risk Analysis Team": "ทีมวิเคราะห์ความเสี่ยงเกษตรระดับประเทศ",
  "Northeast Regional Operations": "ศูนย์ปฏิบัติการภาคอีสาน",
  "Northern Extension Verification Team": "ทีมตรวจภาคสนามภาคเหนือ",
  "Northern Regional Operations": "ศูนย์ปฏิบัติการภาคเหนือ",
  "Orchard Risk Team": "ทีมประเมินความเสี่ยงสวนไม้ผล",
  "Southern Regional Operations": "ศูนย์ปฏิบัติการภาคใต้",
  System: "ระบบ",
  "Western Regional Operations": "ศูนย์ปฏิบัติการภาคตะวันตก",
  "analyst.demo": "นักวิเคราะห์เกษตรและภูมิอากาศ",
  "extension.demo": "เจ้าหน้าที่ส่งเสริมการเกษตร",
  "national.demo": "เจ้าหน้าที่เกษตรระดับประเทศ",
  "province.demo": "เจ้าหน้าที่เกษตรจังหวัด",
  "supervisor.demo": "ผู้ตรวจอนุมัติ",
};

export function labelOrganization(name: string, language: Language) {
  return language === "th" ? organizationTh[name] ?? name : name;
}

const sourceNameTh: Record<string, string> = {
  "TMD August 2026 agrometeorological context": "บริบทอุตุนิยมเกษตร เดือนสิงหาคม 2569 จากกรมอุตุนิยมวิทยา",
  "TMD August 2026 monthly/agrometeorological outlook": "แนวโน้มรายเดือนและอุตุนิยมเกษตร เดือนสิงหาคม 2569 จากกรมอุตุนิยมวิทยา",
  "TMD August 2026 monthly and agrometeorological outlook": "แนวโน้มรายเดือนและอุตุนิยมเกษตร เดือนสิงหาคม 2569 จากกรมอุตุนิยมวิทยา",
  "TMD August 2026 monthly outlook": "แนวโน้มรายเดือน สิงหาคม 2569 จากกรมอุตุนิยมวิทยา",
  "TMD August 2026 outlook": "แนวโน้มอากาศ เดือนสิงหาคม 2569 จากกรมอุตุนิยมวิทยา",
  "TMD July 2026 monthly summary": "สรุปรายเดือน กรกฎาคม 2569 จากกรมอุตุนิยมวิทยา",
  "TMD June 2026 monthly summary": "สรุปรายเดือน มิถุนายน 2569 จากกรมอุตุนิยมวิทยา",
  "TMD September 2026 monthly outlook": "แนวโน้มรายเดือน กันยายน 2569 จากกรมอุตุนิยมวิทยา",
};

export function labelSourceName(name: string, language: Language) {
  return language === "th" ? sourceNameTh[name] ?? name : name;
}

const driverLabelTh: Record<string, string> = {
  "Crop sensitivity": "ความไวต่อน้ำของพืช",
  "Field soil moisture": "ความชื้นดินระดับแปลง",
  "Heavy-rain outlook": "แนวโน้มฝนหนัก",
  "Heavy-rain signal": "สัญญาณฝนหนัก",
  "Humidity / wetness pressure": "แรงกดดันจากความชื้นสูง",
  "Local soil-moisture stress": "ความเครียดความชื้นดินในพื้นที่",
  "Localized flood susceptibility": "ความเปราะบางต่อน้ำท่วมเฉพาะพื้นที่",
  "Lowland exposure": "พื้นที่ลุ่มต่ำที่มีโอกาสได้รับผลกระทบ",
  "National rainfall anomaly": "ปริมาณฝนเทียบค่าปกติระดับประเทศ",
  "Rainfall distribution": "การกระจายตัวของฝน",
  "Runoff susceptibility": "ความเสี่ยงน้ำหลาก",
  "September wet-season outlook": "แนวโน้มฤดูฝนเดือนกันยายน",
  "Strong-wind / heavy-rain signal": "สัญญาณลมแรงและฝนหนัก",
};

const driverValueTh: Record<string, string> = {
  "8% above normal": "สูงกว่าค่าปกติ 8%",
  "8% below normal": "ต่ำกว่าค่าปกติ 8%",
  "Declining between rain episodes": "ลดลงในช่วงเว้นระหว่างฝน",
  "Constrained in selected rain-fed fields": "จำกัดในนาน้ำฝนบางพื้นที่",
  "Elevated": "สูงกว่าระดับเฝ้าระวัง",
  "Elevated in selected prototype areas": "สูงขึ้นในพื้นที่ต้นแบบบางส่วน",
  High: "สูง",
  "High in selected prototype lowlands": "สูงในพื้นที่ลุ่มต่ำต้นแบบบางส่วน",
  Pending: "รอดำเนินการ",
  "Rainy / heavy-rain potential": "มีแนวโน้มฝนต่อเนื่องและฝนหนักบางช่วง",
  "Rice tillering approaching more water-sensitive stages": "ข้าวระยะแตกกอเริ่มเข้าสู่ช่วงไวต่อน้ำมากขึ้น",
  "Uneven / intermittent": "ตกไม่สม่ำเสมอและขาดช่วง",
};

export function labelDriverLabel(label: string, language: Language) {
  return language === "th" ? driverLabelTh[label] ?? label : label;
}

export function labelDriverValue(value: string, language: Language) {
  return language === "th" ? driverValueTh[value] ?? value : value;
}

const provenanceTh: Record<string, string> = {
  "All local numeric evidence is SYNTHETIC and anchored only to TMD August context.":
    "ค่าตัวเลขระดับพื้นที่ทั้งหมดเป็นข้อมูลสังเคราะห์ โดยยึดเฉพาะบริบทอากาศเดือนสิงหาคมจากกรมอุตุนิยมวิทยา",
  "All local numeric evidence is SYNTHETIC. TMD provides the August weather/agromet context only.":
    "ค่าตัวเลขระดับพื้นที่ทั้งหมดเป็นข้อมูลสังเคราะห์ กรมอุตุนิยมวิทยาให้เฉพาะบริบทอากาศและอุตุนิยมเกษตรเดือนสิงหาคม",
  "National rainfall/temperature values are REAL; local indices are SYNTHETIC.":
    "ค่าฝนและอุณหภูมิระดับประเทศเป็นบริบทจริง ส่วนดัชนีระดับพื้นที่เป็นข้อมูลสังเคราะห์",
  "REAL — TMD June 2026 national summary": "บริบทจริงจากสรุปรายเดือน มิถุนายน 2569 ของกรมอุตุนิยมวิทยา",
  "REAL — TMD July 2026 national summary": "บริบทจริงจากสรุปรายเดือน กรกฎาคม 2569 ของกรมอุตุนิยมวิทยา",
  "REAL — TMD national outlook": "บริบทจริงจากแนวโน้มระดับประเทศของกรมอุตุนิยมวิทยา",
  "REAL CONTEXT — TMD August outlook; local interpretation SYNTHETIC":
    "บริบทจริงจากแนวโน้มอากาศเดือนสิงหาคมของกรมอุตุนิยมวิทยา; การแปลผลระดับพื้นที่เป็นข้อมูลสังเคราะห์",
  "REAL CONTEXT — TMD August outlook; local risk SYNTHETIC":
    "บริบทจริงจากแนวโน้มอากาศเดือนสิงหาคมของกรมอุตุนิยมวิทยา; ความเสี่ยงระดับพื้นที่เป็นข้อมูลสังเคราะห์",
  "REAL CONTEXT — TMD agromet; disease inference SYNTHETIC":
    "บริบทจริงจากข้อมูลอุตุนิยมเกษตรของกรมอุตุนิยมวิทยา; การประเมินโรคพืชเป็นข้อมูลสังเคราะห์",
  "REAL CONTEXT — TMD; local logistics exposure SYNTHETIC":
    "บริบทจริงจากกรมอุตุนิยมวิทยา; ผลกระทบต่อโลจิสติกส์ระดับพื้นที่เป็นข้อมูลสังเคราะห์",
  SYNTHETIC: "ข้อมูลสังเคราะห์",
  "SYNTHETIC DEMO AGRONOMIC CONTEXT": "บริบทเกษตรกรรมสังเคราะห์สำหรับต้นแบบ",
  "SYNTHETIC local evidence.": "หลักฐานระดับพื้นที่เป็นข้อมูลสังเคราะห์",
  "SYNTHETIC local evidence; not an official pest/disease forecast.":
    "หลักฐานระดับพื้นที่เป็นข้อมูลสังเคราะห์ ไม่ใช่ประกาศคาดการณ์ศัตรูพืชหรือโรคพืชทางการ",
  "TMD supports the wet outlook; local indices are SYNTHETIC.":
    "กรมอุตุนิยมวิทยารองรับบริบทแนวโน้มฝน ส่วนดัชนีระดับพื้นที่เป็นข้อมูลสังเคราะห์",
};

export function labelProvenance(provenance: string, language: Language) {
  return language === "th" ? provenanceTh[provenance] ?? provenance : provenance;
}

const impactTh: Record<string, string> = {
  "Access and post-harvest handling disruption": "การเข้าพื้นที่และงานหลังเก็บเกี่ยวอาจสะดุด",
  "Branch/fruit drop": "เสี่ยงกิ่งหรือผลไม้ร่วงจากลมแรง",
  "Crop access disruption": "การเข้าถึงแปลงเพาะปลูกอาจสะดุด",
  "Crop lodging where water persists": "พืชอาจล้มในพื้นที่น้ำขังต่อเนื่อง",
  "Delayed establishment in rain-fed rice areas": "การตั้งตัวของข้าวนาน้ำฝนอาจล่าช้า",
  "Delayed field operations": "งานภาคสนามอาจล่าช้า",
  "Field access disruption": "การเข้าถึงแปลงอาจสะดุด",
  "Harvest interruption": "การเก็บเกี่ยวอาจหยุดชะงัก",
  "Higher disease scouting burden": "ต้องเพิ่มภาระตรวจโรคพืชในแปลง",
  "Higher supplementary irrigation demand": "ความต้องการน้ำเสริมเพิ่มขึ้น",
  "Localized crop-health deterioration if wetness persists": "สุขภาพพืชอาจแย่ลงเฉพาะพื้นที่หากความชื้นสูงต่อเนื่อง",
  "Localized early crop stress where rainfall distribution was poor": "พืชอาจเริ่มเครียดเฉพาะพื้นที่ที่ฝนกระจายตัวไม่ดี",
  "Localized lodging and nutrient loss": "อาจเกิดพืชล้มและสูญเสียธาตุอาหารเฉพาะพื้นที่",
  "Localized rice water stress": "นาข้าวบางพื้นที่เสี่ยงเครียดน้ำ",
  "Local erosion/runoff damage": "เสี่ยงการชะล้างดินและความเสียหายจากน้ำหลากเฉพาะพื้นที่",
  "Potential tapping/field-operation disruption": "งานกรีดยางหรือปฏิบัติงานในแปลงอาจสะดุด",
  "Rapid inundation of low-lying rice fields": "พื้นที่นาข้าวลุ่มต่ำอาจถูกน้ำท่วมเร็ว",
  "Risk of overreacting to province-wide rainfall totals instead of field conditions":
    "เสี่ยงตัดสินใจจากตัวเลขฝนระดับจังหวัดโดยไม่ดูสภาพแปลงจริง",
  "Uneven crop development": "การเจริญเติบโตของพืชไม่สม่ำเสมอ",
  Waterlogging: "น้ำขังในพื้นที่ลุ่มต่ำ",
  "Waterlogging in low-lying fields": "น้ำขังในแปลงลุ่มต่ำ",
};

export function labelImpact(impact: string, language: Language) {
  return language === "th" ? impactTh[impact] ?? impact : impact;
}

const actionRoleTh: Record<string, string> = {
  farmers: "เกษตรกร",
  extension: "เจ้าหน้าที่ส่งเสริม",
  officers: "ฝ่ายปฏิบัติการ",
  water: "หน่วยงานน้ำ",
};

export function labelActionRole(role: string, language: Language) {
  return language === "th" ? actionRoleTh[role] ?? role : role;
}

const recommendationTh: Record<string, string> = {
  "Avoid entering fast-flowing water.": "หลีกเลี่ยงการเข้าใกล้น้ำไหลแรง",
  "Clear drainage and avoid entering fast-flowing water.": "เปิดทางระบายน้ำและหลีกเลี่ยงการเข้าใกล้น้ำไหลแรง",
  "Compare verified impacts against predicted risk.": "เปรียบเทียบผลกระทบที่ยืนยันแล้วกับความเสี่ยงที่คาดการณ์",
  "Coordinate drainage and river-level monitoring.": "ประสานการระบายน้ำและติดตามระดับน้ำในลำน้ำ",
  "Coordinate rapid orchard impact reporting.": "ประสานการรายงานผลกระทบต่อสวนไม้ผลอย่างรวดเร็ว",
  "Document areas with delayed establishment.": "บันทึกพื้นที่ที่การตั้งตัวของพืชล่าช้า",
  "Do not publish disease claims without field verification.": "ไม่เผยแพร่ข้อกล่าวอ้างเรื่องโรคพืชหากยังไม่มีผลตรวจภาคสนาม",
  "Identify low-lying hotspots before peak rain episodes.": "ระบุจุดลุ่มต่ำเสี่ยงก่อนช่วงฝนหนัก",
  "Increase crop-health scouting after prolonged wet periods.": "เพิ่มการสำรวจสุขภาพพืชหลังช่วงชื้นแฉะต่อเนื่อง",
  "Keep drainage paths clear in vulnerable fields.": "ดูแลทางระบายน้ำในแปลงเสี่ยงให้ไม่อุดตัน",
  "Maintain drainage readiness and monitor field water depth.": "เตรียมทางระบายน้ำและติดตามระดับน้ำในแปลง",
  "No primary action.": "ยังไม่มีภารกิจหลัก",
  "No primary action unless drainage issues emerge.": "ยังไม่มีภารกิจหลัก เว้นแต่พบปัญหาการระบายน้ำ",
  "Prepare targeted flood/waterlogging advisories.": "เตรียมคำแนะนำเฉพาะพื้นที่เรื่องน้ำท่วมและน้ำขัง",
  "Prioritize verified high-stress communities rather than applying one province-wide response.":
    "จัดลำดับชุมชนที่ตรวจยืนยันว่าเสี่ยงสูงก่อน ไม่ใช้มาตรการเดียวทั้งจังหวัด",
  "Prioritize vulnerable basin communities for outreach.": "สื่อสารก่อนกับชุมชนลุ่มน้ำที่เปราะบาง",
  "Record farmer-reported water constraints.": "บันทึกข้อจำกัดน้ำที่เกษตรกรรายงาน",
  "Record verified waterlogging and access constraints.": "บันทึกจุดน้ำขังและข้อจำกัดการเข้าพื้นที่ที่ตรวจยืนยันแล้ว",
  "Report visible stress or water constraints.": "แจ้งเจ้าหน้าที่เมื่อพบอาการพืชเครียดหรือข้อจำกัดน้ำ",
  "Review local supplementary irrigation availability where verification confirms stress.":
    "ทบทวนแหล่งน้ำเสริมในพื้นที่ที่ผลตรวจภาคสนามยืนยันความเครียดน้ำ",
  "Review where supplementary irrigation demand increased.": "ทบทวนพื้นที่ที่ความต้องการน้ำเสริมเพิ่มขึ้น",
  "Secure vulnerable orchard infrastructure and monitor harvest windows.":
    "เสริมความมั่นคงโครงสร้างในสวนที่เปราะบางและติดตามช่วงเก็บเกี่ยว",
  "Track basin inflow and local drainage bottlenecks.": "ติดตามน้ำไหลเข้าลุ่มน้ำและจุดคอขวดการระบายน้ำ",
  "Track local drainage and river conditions.": "ติดตามการระบายน้ำและสภาพลำน้ำในพื้นที่",
  "Use the event for retrospective seasonal learning.": "ใช้เหตุการณ์นี้เพื่อเรียนรู้ย้อนหลังระดับฤดูกาล",
  "Verify crop stage, water availability and visible stress in assigned fields.":
    "ตรวจระยะพืช ปริมาณน้ำที่มี และอาการเครียดในแปลงที่ได้รับมอบหมาย",
  "Verify field moisture before planting or irrigation.": "ตรวจความชื้นในแปลงก่อนปลูกหรือให้น้ำ",
  "Verify flood depth, crop stage and access constraints.": "ตรวจระดับน้ำท่วม ระยะพืช และข้อจำกัดการเข้าพื้นที่",
  "Verify symptoms before escalating disease risk.": "ตรวจอาการจริงก่อนยกระดับความเสี่ยงโรคพืช",
  "Verify wind damage and access constraints.": "ตรวจความเสียหายจากลมและข้อจำกัดการเข้าพื้นที่",
};

export function labelRecommendation(action: string, language: Language) {
  if (language === "en") return action;
  return recommendationTh[action] ?? advisoryActionTh[action] ?? action;
}

const evidenceKeyTh: Record<string, string> = {
  evidenceLabel: "หมายเหตุหลักฐาน",
  forecastProbabilityPct: "โอกาสเกิดตามแบบจำลอง",
  humidityRiskIndex: "ดัชนีความชื้นเสี่ยงโรค",
  modelAgreement: "ความเห็นพ้องของสัญญาณ",
  rainfallAnomalyPct: "ฝนเทียบค่าปกติ",
  riverFloodIndex: "ดัชนีน้ำล้นตลิ่ง",
  soilMoistureIndex: "ดัชนีความชื้นดิน",
  temperatureAnomalyC: "อุณหภูมิเบี่ยงเบน",
  vegetationStressIndex: "ดัชนีความเครียดพืช",
  waterAvailability: "สถานะน้ำ",
  windRiskIndex: "ดัชนีความเสี่ยงลม",
};

const evidenceValueTh: Record<string, string> = {
  "3 of 5 demo signals support elevated field water stress": "สัญญาณข้อมูล 3 จาก 5 รายการสนับสนุนภาวะเครียดน้ำระดับแปลง",
  "Constrained in selected rain-fed fields": "จำกัดในนาน้ำฝนบางพื้นที่",
  High: "สูง",
  "High / excess in selected areas": "สูงหรือมากเกินในบางพื้นที่",
  Mixed: "คละกันตามพื้นที่",
};

export function labelEvidenceKey(key: string, language: Language) {
  return language === "th" ? evidenceKeyTh[key] ?? key : key;
}

export function labelEvidenceValue(key: string, value: string | number | undefined, language: Language) {
  if (value === undefined) return "-";
  if (language === "en") return String(value);
  if (typeof value === "number") {
    if (key.endsWith("Pct")) return `${value}%`;
    if (key.endsWith("C")) return `${value}°C`;
    return `${value}/100`;
  }
  if (key === "evidenceLabel") return labelProvenance(value, language);
  return evidenceValueTh[value] ?? value;
}

const workflowStepTh: Record<string, string> = {
  advisory: "คำแนะนำ",
  approval: "อนุมัติ",
  publication: "เผยแพร่",
  verification: "ตรวจภาคสนาม",
};

export function labelWorkflowStep(step: string, language: Language) {
  return language === "th" ? workflowStepTh[step] ?? step : step;
}

const auditActionTh: Record<string, string> = {
  "Advisory approved": "อนุมัติคำแนะนำแล้ว",
  "Advisory published to selected channels": "เผยแพร่คำแนะนำผ่านช่องทางที่เลือกแล้ว",
  "Advisory recommendation edited": "แก้ไขรายการคำแนะนำ",
  "Advisory submitted for supervisor review": "ส่งคำแนะนำให้ผู้อนุมัติตรวจแล้ว",
  "Assigned for local verification": "มอบหมายตรวจยืนยันในพื้นที่",
  "Disease-pressure watch created": "สร้างรายการเฝ้าระวังแรงกดดันโรคพืช",
  "Draft advisory pre-populated": "เตรียมร่างคำแนะนำเบื้องต้น",
  "Event detected": "ตรวจพบเหตุการณ์เสี่ยง",
  "Event placed on monitoring queue": "เพิ่มเหตุการณ์เข้าคิวเฝ้าระวัง",
  "Field verification assigned": "มอบหมายงานตรวจภาคสนาม",
  "Field verification submitted; event confidence increased":
    "รับผลตรวจภาคสนามและปรับความเชื่อมั่นของเหตุการณ์",
  "Field verification submitted; event confidence increased for demo":
    "รับผลตรวจภาคสนามและปรับความเชื่อมั่นของเหตุการณ์",
  "Historical event closed": "ปิดเหตุการณ์ย้อนหลัง",
  "Risk event generated": "สร้างเหตุการณ์เสี่ยง",
  "September outlook event created": "สร้างเหตุการณ์จากแนวโน้มเดือนกันยายน",
  "Supervisor requested advisory changes": "ผู้อนุมัติส่งกลับให้แก้ไขคำแนะนำ",
};

export function labelAuditAction(action: string, language: Language) {
  return language === "th" ? auditActionTh[action] ?? action : action;
}

export function formatAuditTime(value: string, language: Language) {
  if (language === "en") return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
