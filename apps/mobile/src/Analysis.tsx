import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { analysisDistricts, comparisonStyles, filterAnalysisRows, riskPatternOptions, type RiskPattern } from '../../../src/forecastAnalysis';
import { buildForecastComparison, buildForecastExport, type ForecastExportComparison } from '../../../src/forecastExportModel';
import { AppText, Button, Empty, Input, Section, Segments, Select, s } from './ui';
import { areaInfo, exportHorizons, exportRiskLabel, forecastTargetPeriod, formatMonth, riskColors, riskIndex, type Archive, type ExportLocation, type IrrigationCriterion } from './domain';

type Props = { archive: Archive; rows: ExportLocation[]; origin: string; areaCode: string; irrigation: IrrigationCriterion; horizon: number; onArea: (code: string) => void; load: (query: { areaCode: string; originPeriod: string }) => Promise<Archive> };
export function Analysis({ archive, rows, origin, areaCode, irrigation, horizon, onArea, load }: Props) {
  const [tab, setTab] = useState('table');
  const [group, setGroup] = useState(areaCode.length === 6 ? 'tambon' : 'district');
  const [query, setQuery] = useState('');
  const [pattern, setPattern] = useState<RiskPattern>('all');
  const [baseline, setBaseline] = useState('');
  const [comparison, setComparison] = useState<ForecastExportComparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => { generation.current++; setComparison(null); setError(''); setBusy(false); return () => { generation.current++; }; }, [archive, origin, areaCode, irrigation, baseline]);
  const filtered = useMemo(() => filterAnalysisRows(rows, query, '', pattern), [rows, query, pattern]);
  const districts = useMemo(() => analysisDistricts(filtered), [filtered]);
  const items: { code: string; name: string; risks: ExportLocation['risks']; summaries: ReturnType<typeof analysisDistricts>[number]['horizons'] | null }[] = group === 'district' || tab === 'graph'
    ? districts.map(d => ({ code: d.code, name: `อ.${d.name}`, risks: d.horizons.map(h => h.highest), summaries: d.horizons }))
    : filtered.map(row => ({ code: row.subdistrictCode, name: `ต.${row.subdistrictNameTh} · อ.${row.districtNameTh}`, risks: row.risks, summaries: null }));
  const compare = async () => {
    const id = ++generation.current; setBusy(true); setError(''); setComparison(null);
    try {
      // Refresh both sides before comparing; never mix snapshots from different revisions.
      const current = await load({ areaCode, originPeriod: origin });
      const previous = await load({ areaCode, originPeriod: baseline });
      if (current.meta.datasetVersion !== previous.meta.datasetVersion || current.meta.sourceWorkbookSha256 !== previous.meta.sourceWorkbookSha256 || current.meta.normalizedManifestSha256 !== previous.meta.normalizedManifestSha256) throw new Error('รุ่นข้อมูลเปลี่ยน กรุณาลองอีกครั้ง');
      const result = buildForecastComparison(buildForecastExport(current, { areaCode, originPeriod: origin, irrigation }), buildForecastExport(previous, { areaCode, originPeriod: baseline, irrigation }));
      if (generation.current === id) setComparison(result);
    } catch { if (generation.current === id) setError('เปรียบเทียบไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อหรือตัวกรองชลประทาน'); }
    finally { if (generation.current === id) setBusy(false); }
  };
  const filteredCodes = new Set(filtered.map(row => row.subdistrictCode));
  const pairs = comparison?.rows.filter(row => filteredCodes.has(row.subdistrictCode)) ?? [];
  const header = <Section title={`วิเคราะห์ · ${areaInfo(areaCode).name}`}>
    <AppText style={[s.small, s.center]}>เดือนตั้งต้น {formatMonth(origin, 'th')} · {irrigation === 'all' ? 'ทุกสถานะชลประทาน' : irrigation === 'rainfed' ? 'พึ่งน้ำฝน' : irrigation === 'irrigated' ? 'เข้าถึงชลประทาน' : 'ยังไม่มีข้อมูลชลประทาน'}</AppText>
    <Segments value={tab} options={[{ value: 'table', label: '6 เดือน' }, { value: 'graph', label: 'อำเภอ' }, { value: 'compare', label: 'เทียบรอบ' }]} onChange={setTab} />
    <Input accessibilityLabel="ค้นหาพื้นที่วิเคราะห์" placeholder="ค้นหาชื่อพื้นที่ / รหัส" value={query} onChangeText={setQuery} autoCorrect={false} />
    <Select label="รูปแบบพยากรณ์" value={pattern} options={riskPatternOptions} onChange={v => setPattern(v as RiskPattern)} />
    {tab === 'table' && <Segments value={group} options={[{ value: 'district', label: 'สรุปอำเภอ' }, { value: 'tambon', label: 'รายตำบล' }]} onChange={setGroup} />}
    <AppText style={[s.small, s.center]}>{filtered.length}/{rows.length} ตำบล · {districts.length} อำเภอ{tab === 'graph' ? ` · T+${horizon}` : ''}</AppText>
    {tab === 'compare' && <><Select label="รอบตั้งต้นที่ใช้เปรียบเทียบ" value={baseline} options={[{ value: '', label: 'เลือกรอบพยากรณ์' }, ...[...archive.targetMonths].reverse().filter(m => m.period !== origin).map(m => ({ value: m.period, label: m.labelTh, search: m.period }))]} onChange={setBaseline} />
      <Button disabled={!baseline} busy={busy} onPress={() => void compare()}>เปรียบเทียบกับ {formatMonth(origin, 'th')}</Button>
      <AppText style={s.small}>เทียบตำบลและเดือนที่พยากรณ์ตรงกันเท่านั้น ไม่ใช่การเทียบกับผลจริง</AppText>
      {!!error && <AppText accessibilityLiveRegion="polite">{error}</AppText>}
      {comparison && <AppText weight="semibold" style={s.center}>เดือนตรงกัน {comparison.targets.length} เดือน · {pairs.length} คู่</AppText>}</>}
  </Section>;
  return tab === 'compare' ? <FlatList data={pairs} keyExtractor={row => `${row.subdistrictCode}-${row.targetPeriod}`} ListHeaderComponent={header} contentContainerStyle={{ paddingBottom: 24 }}
    ListEmptyComponent={busy ? <ActivityIndicator /> : <Empty title={comparison ? 'ไม่มีคู่ข้อมูลตามตัวกรอง' : 'เลือกรอบที่จะเปรียบเทียบ'} detail={comparison ? 'รอบที่เลือกอาจไม่มีเดือนพยากรณ์ตรงกัน' : undefined} />}
    renderItem={({ item }) => <Section><AppText weight="semibold">ต.{item.subdistrictNameTh} · {formatMonth(item.targetPeriod, 'th')}</AppText><AppText>{formatMonth(item.baselineOriginPeriod, 'th')} T+{item.baselineHorizon}: {item.baselineStatus === 'VALID' ? item.baselineForecastRisk : item.baselineStatus === 'OUT_OF_SCOPE' ? 'นอกขอบเขต' : 'ไม่มีข้อมูล'}</AppText><AppText>{formatMonth(item.currentOriginPeriod, 'th')} T+{item.currentHorizon}: {item.currentStatus === 'VALID' ? item.currentForecastRisk : item.currentStatus === 'OUT_OF_SCOPE' ? 'นอกขอบเขต' : 'ไม่มีข้อมูล'}</AppText><AppText weight="semibold">{comparisonStyles[item.comparisonStatus].label}</AppText></Section>} />
    : <FlatList data={items} keyExtractor={item => item.code} ListHeaderComponent={header} contentContainerStyle={{ paddingBottom: 24 }}
      ListEmptyComponent={<Empty title="ไม่พบตำบลตามตัวกรองนี้" action="ล้างตัวกรองวิเคราะห์" onAction={() => { setQuery(''); setPattern('all'); }} />}
      renderItem={({ item }) => <Section>
        <Pressable accessibilityRole="button" onPress={() => onArea(item.code)} style={[s.row, { minHeight: 44 }]}><AppText weight="bold" style={s.flex}>{item.name}</AppText><ChevronRight size={18} color="#245947" /></Pressable>
        {tab === 'graph' && item.summaries ? <><View style={{ height: 18, flexDirection: 'row', overflow: 'hidden', borderRadius: 4 }}>{item.summaries[horizon - 1].counts.map((n, i) => n > 0 && <View key={i} style={{ flex: n, backgroundColor: riskColors[i] }} />)}</View><AppText style={s.small}>ไม่เสี่ยง {item.summaries[horizon - 1].counts[0]} · ปานกลาง {item.summaries[horizon - 1].counts[1]} · สูง {item.summaries[horizon - 1].counts[2]} · นอกขอบเขต {item.summaries[horizon - 1].counts[3]} · ไม่มีข้อมูล {item.summaries[horizon - 1].counts[4]}</AppText></>
          : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>{exportHorizons.map(h => <View key={h} style={{ width: '31%', gap: 4, padding: 8, justifyContent: 'center', backgroundColor: '#f7f8f6', borderRadius: 6 }}>
            <AppText weight="semibold" style={[s.center, { fontSize: 14 }]}>T+{h}</AppText><AppText style={[s.small, s.center]}>{formatMonth(forecastTargetPeriod(origin, h), 'th')}</AppText>
            <View style={{ height: 4, backgroundColor: riskColors[riskIndex(item.risks[h - 1])], borderRadius: 2 }} /><AppText style={[s.center, { fontSize: 12, lineHeight: 19 }]}>{exportRiskLabel(item.risks[h - 1])}</AppText>
            {item.summaries && <AppText style={[s.small, s.center]}>มีค่า {item.summaries[h - 1].valid}/{item.summaries[h - 1].total}</AppText>}
          </View>)}</View>}
      </Section>} />;
}
