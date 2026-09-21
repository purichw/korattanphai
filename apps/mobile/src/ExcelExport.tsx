import { useEffect, useRef, useState } from 'react';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Download } from 'lucide-react-native';
import { buildForecastExport, withForecastExportComparison } from '../../../src/forecastExportModel';
import { irrigationCriteria, irrigationLabels } from '../../../src/irrigation';
import { areaInfo, areas, formatMonth, type Archive, type IrrigationCriterion } from './domain';
import { AppText, Button, Select, Sheet, s } from './ui';

type Loader = { load(query: { areaCode: string; originPeriod?: string | null }): Promise<Archive> };
class ExportNotice extends Error {}
export function ExcelExport({ archive, areaCode, origin, irrigation, loader, visible, onClose }: { archive: Archive; areaCode: string; origin: string; irrigation: IrrigationCriterion; loader: Loader; visible: boolean; onClose: () => void }) {
  const [area, setArea] = useState(areaCode);
  const [period, setPeriod] = useState(origin);
  const [water, setWater] = useState<IrrigationCriterion>(irrigation);
  const [baseline, setBaseline] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  const locked = useRef(false);
  useEffect(() => () => { mounted.current = false; }, []);
  const options = [...archive.targetMonths].reverse().map(m => ({ value: m.period, label: m.labelTh, search: m.period }));
  const run = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true); setMessage('กำลังตรวจสอบข้อมูลล่าสุด');
    let file: File | undefined;
    try {
      const current = await loader.load({ areaCode: area, originPeriod: period });
      if (!mounted.current) return;
      let report = buildForecastExport(current, { areaCode: area, originPeriod: period, irrigation: water });
      if (baseline) {
        const previous = await loader.load({ areaCode: area, originPeriod: baseline });
        if (!mounted.current) return;
        if (previous.meta.datasetVersion !== current.meta.datasetVersion || previous.meta.sourceWorkbookSha256 !== current.meta.sourceWorkbookSha256 || previous.meta.normalizedManifestSha256 !== current.meta.normalizedManifestSha256) throw new ExportNotice('รุ่นข้อมูลเปลี่ยน กรุณาส่งออกอีกครั้ง');
        report = withForecastExportComparison(report, buildForecastExport(previous, { areaCode: area, originPeriod: baseline, irrigation: water }));
      }
      const template = await Asset.fromModule(require('../../../src/assets/forecast-export-template.xlsx')).downloadAsync();
      const bytes = await new File(template.localUri!).arrayBuffer();
      if (!mounted.current) return;
      // Metro's dev split-chunk URLs cannot address modules outside the app root.
      const { createForecastWorkbook } = require('../../../src/forecastExcelWriter') as typeof import('../../../src/forecastExcelWriter');
      const result = await createForecastWorkbook(report, bytes, { onProgress: stage => { if (mounted.current) setMessage(stage === 'packaging' ? 'กำลังจัดเตรียมไฟล์' : 'กำลังสร้าง Excel'); } });
      if (!mounted.current) return;
      file = new File(Paths.cache, report.filename); file.write(new Uint8Array(result));
      if (!await Sharing.isAvailableAsync()) throw new ExportNotice('อุปกรณ์นี้ไม่รองรับการแชร์ไฟล์');
      if (!mounted.current) return;
      await Sharing.shareAsync(file.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', UTI: 'org.openxmlformats.spreadsheetml.sheet', dialogTitle: 'ส่งออกพยากรณ์ภัยแล้ง' });
      if (mounted.current) setMessage(`เตรียมไฟล์แล้ว ${report.rows.length} ตำบล · ${report.districts.length} อำเภอ`);
    } catch (error) {
      if (__DEV__) console.warn('Native workbook export failed', error);
      if (mounted.current) setMessage(error instanceof ExportNotice ? error.message : 'ส่งออกไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง');
    }
    finally {
      try { if (file?.exists) file.delete(); }
      catch { if (__DEV__) console.warn('Could not remove temporary workbook'); }
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return <Sheet title="ส่งออก Excel" visible={visible} onClose={() => { mounted.current = false; onClose(); }}>
    <AppText style={[s.small, s.center]}>ข้อมูล T+1 ถึง T+6 พร้อมสรุปอำเภอ กราฟ และ PivotTable</AppText>
    {!busy && <><Select label="เดือนตั้งต้น" value={period} options={options} onChange={v => { setPeriod(v); if (baseline === v) setBaseline(''); }} /><Select label="พื้นที่" value={area} options={areas.map(a => ({ value: a.code, label: a.label, search: a.search }))} onChange={setArea} /><Select label="ชลประทาน" value={water} options={irrigationCriteria.map(value => ({ value, label: irrigationLabels[value] }))} onChange={v => setWater(v as IrrigationCriterion)} /><Select label="เปรียบเทียบรอบ" value={baseline} options={[{ value: '', label: 'ไม่เปรียบเทียบ' }, ...options.filter(o => o.value !== period)]} onChange={setBaseline} /></>}
    <AppText style={s.center}>{areaInfo(area).label} · {formatMonth(period, 'th')}</AppText>
    {!!message && <AppText accessibilityLiveRegion="polite" style={s.center}>{message}</AppText>}
    <Button busy={busy} icon={Download} onPress={() => void run()}>สร้างและแชร์ Excel</Button>
  </Sheet>;
}
