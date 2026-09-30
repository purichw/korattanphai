import type { Payload, Json } from './types';

export const fieldLabels: Record<string, string> = {
  subdistrictCode: 'ตำบลและอำเภอ', targetMonth: 'เดือนที่พยากรณ์',
  horizonMonths: 'ระยะเวลาล่วงหน้า', riskCode: 'ระดับความเสี่ยง', status: 'สถานะข้อมูล',
};

export const choiceLabels: Record<string, string> = {
  reported: 'มีค่าจากต้นทาง', missing: 'ไม่มีข้อมูล', suspect: 'ต้องตรวจสอบ',
  rainfall: 'ปริมาณฝน', air_temperature: 'อุณหภูมิอากาศ', relative_humidity: 'ความชื้นสัมพัทธ์', water_level: 'ระดับน้ำ', streamflow: 'อัตราการไหลของน้ำ', soil_moisture: 'ความชื้นในดิน',
  precipitation: 'ปริมาณฝน', ndvi: 'ดัชนีความเขียวของพืช (NDVI)', ndmi: 'ดัชนีความชื้นของพืช (NDMI)', land_surface_temperature: 'อุณหภูมิพื้นผิว',
  instant: 'ค่าขณะตรวจวัด', sum: 'ผลรวม', mean: 'ค่าเฉลี่ย', min: 'ค่าต่ำสุด', max: 'ค่าสูงสุด',
  area_weighted_mean: 'เฉลี่ยตามสัดส่วนพื้นที่', coarse_grid_proxy: 'ค่าตัวแทนจากพื้นที่ใกล้เคียง',
  calendar_year: 'ปีปฏิทิน', crop_season: 'ฤดูเพาะปลูก', DOAE: 'กรมส่งเสริมการเกษตร',
  harvested: 'พื้นที่เก็บเกี่ยว', planted: 'พื้นที่ปลูก', unspecified: 'ยังไม่ระบุ',
  predicted: 'มีค่าพยากรณ์', out_of_scope: 'นอกขอบเขตการศึกษา', insufficient_data: 'ข้อมูลไม่เพียงพอ', unresolved: 'ต้องตรวจค่าที่ขัดแย้งกัน',
};
export const riskOptions = [
  { value: '0', label: 'ไม่พบความเสี่ยง' }, { value: '1', label: 'เสี่ยงปานกลาง' },
  { value: '2', label: 'เสี่ยงสูง' }, { value: 'out_of_scope', label: 'นอกขอบเขตการศึกษา' },
];
export function forecastChoice(row: Payload) {
  if (row.status === 'out_of_scope' && row.riskCode === null) return 'out_of_scope';
  if (row.status === 'predicted' && [0, 1, 2].includes(row.riskCode as number)) return String(row.riskCode);
  return '';
}
export function updateForecastChoice(row: Payload, choice: string): Payload {
  if (choice === 'out_of_scope') return { ...row, status: 'out_of_scope', riskCode: null };
  if (!['0', '1', '2'].includes(choice)) return row;
  return { ...row, status: 'predicted', riskCode: Number(choice) };
}
export function monthLabel(value: Json | undefined) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return String(value ?? 'ไม่ระบุ');
  return new Date(`${value}-01T12:00:00+07:00`).toLocaleDateString('th-TH', { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
}
export function displayCell(key: string, value: Json | undefined) {
  if (value === null) return 'ไม่มีค่า';
  if (value === undefined) return 'ไม่ระบุ';
  if (key === 'riskCode') return riskOptions.find(option => option.value === String(value))?.label ?? `ต้องตรวจสอบ: ${value}`;
  if (key === 'targetMonth' || key === 'period') return monthLabel(value);
  if (key === 'horizonMonths') return `ล่วงหน้า ${value} เดือน`;
  return choiceLabels[String(value)] ?? String(value);
}
