// Domain fields are shared by the existing integration validators and CMS forms.
// Management metadata (draft, actor, revision) never enters these wire payloads.
const text = (key, label, optional = false) => ({ key, label, type: 'text', optional });
const number = (key, label, nullable = false, optional = false) => ({ key, label, type: 'number', nullable, optional });
const choice = (key, label, options) => ({ key, label, type: 'choice', options });
const quality = choice('quality', 'คุณภาพข้อมูล', ['reported', 'missing', 'suspect']);
const sourceRecordId = text('sourceRecordId', 'รหัสรายการจากต้นทาง', true);

export const DATA_FIELDS = {
  station: [
    text('stationId', 'รหัสสถานี'), text('observedAt', 'เวลาตรวจวัด (ISO พร้อมเขตเวลา)'),
    choice('metric', 'ตัวแปร', ['rainfall', 'air_temperature', 'relative_humidity', 'water_level', 'streamflow', 'soil_moisture']),
    number('value', 'ค่าตรวจวัด', true), text('unit', 'หน่วย'),
    choice('aggregation', 'วิธีรวมค่า', ['instant', 'sum', 'mean', 'min', 'max']),
    number('periodMinutes', 'ช่วงเวลา (นาที)'), quality, sourceRecordId,
  ],
  satellite: [
    text('subdistrictCode', 'รหัสตำบล'), text('period', 'เดือนข้อมูล (YYYY-MM)'),
    text('availableAt', 'เวลาที่ข้อมูลพร้อมใช้ (ISO พร้อมเขตเวลา)'),
    choice('metric', 'ตัวแปร', ['precipitation', 'ndvi', 'ndmi', 'land_surface_temperature', 'soil_moisture']),
    number('value', 'ค่าข้อมูล', true), text('unit', 'หน่วย'), quality,
    number('validPixelFraction', 'สัดส่วนพิกเซลใช้ได้ (0–1)'), text('product', 'ผลิตภัณฑ์'),
    text('productVersion', 'รุ่นผลิตภัณฑ์'), text('processingVersion', 'รุ่นประมวลผล'),
    number('resolutionMeters', 'ความละเอียด (เมตร)'),
    choice('spatialAggregation', 'วิธีรวมเชิงพื้นที่', ['area_weighted_mean', 'coarse_grid_proxy']),
    choice('temporalAggregation', 'วิธีรวมเชิงเวลา', ['sum', 'mean']),
    text('geometryVersion', 'รุ่นขอบเขต', true), text('maskVersion', 'รุ่นหน้ากากข้อมูล', true),
    number('nativeSupportMeters', 'ขนาดพื้นที่ตรวจวัดจริง (เมตร)', false, true),
    text('sourceArtifactHash', 'SHA-256 ต้นฉบับ', true), sourceRecordId,
  ],
  crop: [
    text('subdistrictCode', 'รหัสตำบล'), text('cropCode', 'รหัสพืช'), text('seasonId', 'รหัสฤดู'),
    choice('periodType', 'ชนิดช่วงเวลา', ['calendar_year', 'crop_season']),
    text('periodStart', 'วันเริ่ม (YYYY-MM-DD)'), text('periodEnd', 'วันสิ้นสุด (YYYY-MM-DD)'),
    text('availableAt', 'เวลาที่ข้อมูลพร้อมใช้ (ISO พร้อมเขตเวลา)'),
    choice('agency', 'หน่วยงาน', ['DOAE']), text('datasetVersion', 'รุ่นชุดข้อมูล'),
    number('plantedAreaRai', 'พื้นที่ปลูก (ไร่)', true), number('harvestedAreaRai', 'พื้นที่เก็บเกี่ยว (ไร่)', true),
    number('productionTonnes', 'ผลผลิต (ตัน)', true), number('yieldKgPerRai', 'ผลผลิตต่อไร่ (กก./ไร่)', true),
    choice('yieldAreaBasis', 'ฐานพื้นที่ผลผลิตต่อไร่', ['harvested', 'planted', 'unspecified']), quality, sourceRecordId,
  ],
  forecast: [
    text('subdistrictCode', 'รหัสตำบล'), number('horizonMonths', 'ระยะพยากรณ์ (T+)'),
    text('targetMonth', 'เดือนพยากรณ์ (YYYY-MM)'),
    choice('status', 'สถานะพยากรณ์', ['predicted', 'out_of_scope', 'insufficient_data']),
    number('riskCode', 'ระดับความเสี่ยง (0/1/2)', true),
  ],
};

// Archived workbook corrections use the same prediction cells as model results;
// their envelope records a base publication, not invented model-input provenance.
DATA_FIELDS.archive = DATA_FIELDS.forecast;

export const requiredFields = kind => DATA_FIELDS[kind].filter(field => !field.optional).map(field => field.key);
export const optionalFields = kind => DATA_FIELDS[kind].filter(field => field.optional).map(field => field.key);
