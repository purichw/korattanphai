import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowLeft, BarChart3, Bookmark, Download, Info, LogOut, Map, Pause, Play, SlidersHorizontal, User } from 'lucide-react-native';
import { irrigationCriteria, irrigationLabels } from '../../../src/irrigation';
import type { SavedFilter, SavedForecastSelection } from '../../../src/data/savedWorkspaces';
import { backend } from './backend';
import { useForecast } from './useForecast';
import { areaInfo, areas, exportHorizons, exportRiskLabel, forecastRows, forecastTargetPeriod, formatMonth, riskColors, riskOptions, summarizeExportRisks, type IrrigationCriterion, type SavedRiskCriterion } from './domain';
import { theme } from './theme';
import { AppText, Button, Empty, IconButton, Section, Segments, Select, Sheet, s } from './ui';
import { ForecastMap } from './ForecastMap';
import { ForecastChart } from './ForecastChart';
import { Analysis } from './Analysis';
import { Saved } from './Saved';
import { ExcelExport } from './ExcelExport';

export function Workspace({ userId, email }: { userId: string; email: string }) {
  const [tab, setTab] = useState('forecast');
  const [areaCode, setAreaCode] = useState('30');
  const [origin, setOrigin] = useState('');
  const [horizon, setHorizon] = useState(1);
  const [irrigation, setIrrigation] = useState<IrrigationCriterion>('all');
  const [risk, setRisk] = useState<SavedRiskCriterion>('all');
  const [mode, setMode] = useState<'forecast' | 'irrigation'>('forecast');
  const [sheet, setSheet] = useState('');
  const [playing, setPlaying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { archive, loading, error, refresh, loader, checked } = useForecast(userId, areaCode, origin);
  const period = origin || archive?.loadedSelection?.originPeriod || archive?.meta.targetMonthEnd || '';
  const rows = useMemo(() => archive && period ? forecastRows(archive, period, irrigation) : [], [archive, period, irrigation]);
  const summary = summarizeExportRisks(rows, horizon);
  const info = areaInfo(areaCode);
  const target = period ? forecastTargetPeriod(period, horizon) : '';
  const goArea = (code: string) => { setAreaCode(code); setPlaying(false); setTab('forecast'); setSheet(''); };
  const setMonth = (value: string) => { setOrigin(value); setPlaying(false); };
  const chooseHorizon = (value: number) => { setHorizon(value); setPlaying(false); };
  const togglePlayback = () => {
    if (!playing && horizon === 6) setHorizon(1);
    setPlaying(value => !value);
  };
  useEffect(() => {
    if (!playing) return;
    if (tab !== 'forecast' || loading || !archive || sheet) { setPlaying(false); return; }
    const timer = setTimeout(() => {
      if (horizon === 6) setPlaying(false);
      else setHorizon(h => h + 1);
    }, 1600);
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') setPlaying(false); });
    return () => { clearTimeout(timer); listener.remove(); };
  }, [playing, horizon, tab, loading, archive, sheet]);
  const selection: SavedForecastSelection | null = archive && period ? { view_name: 'drought', area_code: areaCode, dataset_id: archive.meta.datasetId, target_period: `${period}-01`, horizon, risk_criterion: risk, irrigation_criterion: irrigation } : null;
  const recall = (filter: SavedFilter) => {
    if (!areas.some(a => a.code === filter.area_code)) { Alert.alert('ไม่พบพื้นที่ในจังหวัดนครราชสีมา'); return; }
    setAreaCode(filter.area_code); setOrigin(filter.target_period.slice(0, 7)); setHorizon(filter.horizon); setRisk(filter.risk_criterion); setIrrigation(filter.irrigation_criterion ?? 'all'); setPlaying(false); setTab('forecast');
  };
  const logout = () => Alert.alert('ออกจากระบบ?', 'ข้อมูลพยากรณ์ที่โหลดไว้จะถูกล้างจากหน่วยความจำ', [{ text: 'ยกเลิก', style: 'cancel' }, { text: 'ออกจากระบบ', style: 'destructive', onPress: async () => {
    setSigningOut(true);
    const result = await backend!.auth.signOut({ scope: 'local' });
    if (result.error) { setSigningOut(false); Alert.alert('ออกจากระบบไม่สำเร็จ', 'กรุณาลองอีกครั้ง'); }
  } }]);
  return <View style={s.flex}>
    <View style={styles.header}><View style={styles.headerActions}>{info.parent ? <IconButton icon={ArrowLeft} label={`กลับ${areaInfo(info.parent).label}`} onPress={() => goArea(info.parent)} /> : <Image source={require('../assets/korat-tan-phai-emblem.png')} style={{ width: 42, height: 42 }} accessibilityLabel="โคราชทันภัย" />}</View>
      <View style={s.flex}><AppText style={[s.small, s.center]}>โคราชทันภัย · ภัยแล้ง</AppText><AppText weight="bold" style={s.center} numberOfLines={2}>{info.label}</AppText></View>
      <View style={styles.headerActions}><IconButton icon={Download} label="ส่งออก Excel" disabled={!archive || loading || error} onPress={() => { setPlaying(false); setSheet('export'); }} /><IconButton icon={User} label="บัญชีผู้ใช้" onPress={() => { setPlaying(false); setSheet('account'); }} /></View>
    </View>
    <View style={styles.context}><View style={s.flex}><Select label="พื้นที่" value={areaCode} options={areas.map(a => ({ value: a.code, label: a.label, search: a.search }))} onChange={goArea} /></View><View style={{ flex: .78 }}><Select label="เดือนตั้งต้น" value={period} options={archive ? [...archive.targetMonths].reverse().map(m => ({ value: m.period, label: m.labelTh, search: m.period })) : [{ value: period, label: period ? formatMonth(period, 'th') : 'กำลังโหลด' }]} onChange={setMonth} /></View></View>
    {error && archive && <View style={styles.notice}><AppText style={s.small}>ยังตรวจสอบข้อมูลล่าสุดไม่ได้ · แสดงข้อมูลที่โหลดสำเร็จล่าสุด</AppText><Button secondary onPress={() => void refresh()}>ลองอีกครั้ง</Button></View>}
    {tab === 'saved' ? <Saved userId={userId} selection={selection} onArea={goArea} onFilter={recall} />
      : !archive ? loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.primary} /><AppText style={[s.small, s.center]}>กำลังโหลดพยากรณ์ของพื้นที่นี้</AppText></View> : <Empty title="โหลดข้อมูลไม่สำเร็จ" detail="ตรวจสอบอินเทอร์เน็ต แล้วลองอีกครั้ง" action="โหลดใหม่" onAction={() => void refresh()} />
      : tab === 'analysis' ? <Analysis key={`${areaCode}|${period}|${irrigation}`} archive={archive} rows={rows} origin={period} areaCode={areaCode} irrigation={irrigation} horizon={horizon} onArea={goArea} load={query => loader.load(query)} />
      : <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}>
        <Section>
          <View style={s.row}><IconButton icon={playing ? Pause : Play} label={playing ? 'หยุดลำดับพยากรณ์' : 'เล่นลำดับพยากรณ์'} active={playing} onPress={togglePlayback} /><View style={s.flex}><AppText style={[s.small, s.center]}>เดือนพยากรณ์</AppText><AppText weight="bold" style={[styles.month, s.center]}>{formatMonth(target, 'th')}</AppText></View><IconButton icon={SlidersHorizontal} label="ตัวกรองแผนที่" active={risk !== 'all' || irrigation !== 'all'} onPress={() => { setPlaying(false); setSheet('filters'); }} /></View>
          <View style={styles.horizons}>{exportHorizons.map(h => <Pressable accessibilityRole="button" accessibilityState={{ selected: h === horizon }} key={h} onPress={() => chooseHorizon(h)} style={[styles.horizon, h === horizon && styles.selected]}><AppText weight="semibold" style={{ color: h === horizon ? '#ffffff' : theme.colors.primary, fontSize: 14 }}>T+{h}</AppText></Pressable>)}</View>
          {areaCode.length === 6 && rows[0] ? <AppText weight="bold" style={[s.heading, s.center]}>{exportRiskLabel(rows[0].risks[horizon - 1])}</AppText> : <View style={s.row}><View style={s.flex}><AppText weight="bold" style={[s.heading, s.center]}>สรุปเดือน</AppText><AppText style={[s.small, s.center]}>พืชที่ประเมิน · ข้าว</AppText></View><View style={s.flex}><AppText style={[s.small, s.center]}>มีค่าพยากรณ์</AppText><AppText weight="bold" style={[s.center, { color: '#08709a', fontSize: 24, lineHeight: 34 }]}>{summary.valid}/{summary.total} ตำบล</AppText><AppText style={[s.small, s.center]}>{summary.total ? Math.round(summary.valid / summary.total * 100) : 0}% ของตำบลตามตัวกรอง</AppText></View></View>}
          <View style={styles.stats}>{summary.counts.map((count, i) => <View key={i} style={styles.stat}><View style={[styles.swatch, { backgroundColor: riskColors[i] }]} /><AppText style={[s.small, s.center]}>{['ไม่เสี่ยง', 'ปานกลาง', 'สูง', 'นอกขอบเขต', 'ไม่มีข้อมูล'][i]}</AppText><AppText weight="bold" style={s.center}>{count}</AppText></View>)}</View>
          <AppText style={[s.small, s.center]}>T+{horizon} จากเดือนตั้งต้น {formatMonth(period, 'th')} · ไม่ใช่ผลความเสียหายจริง</AppText>
        </Section>
        <Section title="แผนที่พยากรณ์" action={<IconButton icon={Info} label="นิยามข้อมูล" onPress={() => setSheet('source')} />}>
          <Segments value={mode} options={[{ value: 'forecast', label: 'ความเสี่ยงภัยแล้ง' }, { value: 'irrigation', label: 'ชลประทาน' }]} onChange={v => setMode(v as typeof mode)} />
          {(risk !== 'all' || irrigation !== 'all') && <AppText style={[s.small, s.center]}>{riskOptions.find(r => r.value === risk)?.label} · {irrigationLabels[irrigation]}</AppText>}
          <ForecastMap areaCode={areaCode} rows={rows} horizon={horizon} risk={risk} mode={mode} onArea={goArea} />
          {!rows.length && <Empty title="ไม่พบตำบลตามสถานะชลประทาน" action="แสดงทุกสถานะ" onAction={() => setIrrigation('all')} />}
        </Section>
        <Section title="แนวโน้ม 6 เดือน"><ForecastChart rows={rows} origin={period} horizon={horizon} onHorizon={chooseHorizon} /><Button secondary icon={BarChart3} onPress={() => { setPlaying(false); setTab('analysis'); }}>วิเคราะห์รายพื้นที่</Button></Section>
        <Section title="คำแนะนำและข้อควรระวัง"><AppText>ตรวจสอบพื้นที่ที่มีสัญญาณเสี่ยงกับข้อมูลภาคสนาม และประสานหน่วยงานในพื้นที่ก่อนวางแผนจัดการน้ำ</AppText><AppText style={s.small}>ระดับอำเภอใช้ค่าสูงสุดของตำบลที่มีค่าพยากรณ์ ไม่ใช่ค่าเฉลี่ย ค่าว่างไม่ใช่ระดับ 0</AppText></Section>
      </ScrollView>}
    <View accessibilityRole="tablist" style={styles.tabs}>{[{ key: 'forecast', label: 'พยากรณ์', icon: Map }, { key: 'analysis', label: 'วิเคราะห์', icon: BarChart3 }, { key: 'saved', label: 'บันทึก', icon: Bookmark }].map(({ key, label, icon: Icon }) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: key === tab }} onPress={() => { setTab(key); setPlaying(false); }} style={styles.tab}><Icon size={23} color={key === tab ? theme.colors.primary : theme.colors.muted} /><AppText weight={key === tab ? 'bold' : 'regular'} style={{ fontSize: 12, lineHeight: 20, color: key === tab ? theme.colors.primary : theme.colors.muted }}>{label}</AppText></Pressable>)}</View>
    <Sheet title="ตัวกรองแผนที่" visible={sheet === 'filters'} onClose={() => setSheet('')}><Select label="ระดับความเสี่ยง" value={risk} options={riskOptions} searchable={false} onChange={v => setRisk(v as SavedRiskCriterion)} /><Select label="ชลประทาน" value={irrigation} options={irrigationCriteria.map(value => ({ value, label: irrigationLabels[value] }))} searchable={false} onChange={v => setIrrigation(v as IrrigationCriterion)} /><Button secondary onPress={() => { setRisk('all'); setIrrigation('all'); }}>ล้างตัวกรอง</Button><Button onPress={() => setSheet('')}>ดูแผนที่</Button></Sheet>
    <Sheet title="ที่มาและนิยาม" visible={sheet === 'source'} onClose={() => setSheet('')}><AppText>0 ไม่พบสัญญาณเสี่ยง · 1 เสี่ยงปานกลาง · 2 เสี่ยงสูง</AppText><AppText>ค่าว่าง: อยู่นอกขอบเขตการศึกษา ไม่ถือว่าไม่มีความเสี่ยง</AppText><AppText>เปอร์เซ็นต์ความเสี่ยงคิดจากตำบลที่มีค่า 0, 1 หรือ 2 เท่านั้น</AppText>{archive && <><AppText style={s.small}>{archive.meta.sourceWorkbook} · {archive.meta.sourceSheet}</AppText><AppText selectable style={s.small}>{archive.meta.datasetVersion}</AppText><AppText style={s.small}>ตรวจสอบล่าสุด {checked?.toLocaleString('th-TH')}</AppText></>}</Sheet>
    <Sheet title="บัญชีผู้ใช้" visible={sheet === 'account'} onClose={() => setSheet('')}><AppText weight="bold" style={s.center}>{email}</AppText><AppText style={[s.small, s.center]}>โคราชทันภัย · iOS เวอร์ชันพัฒนา</AppText><Button secondary icon={LogOut} busy={signingOut} onPress={logout}>ออกจากระบบ</Button></Sheet>
    {sheet === 'export' && archive && <ExcelExport archive={archive} areaCode={areaCode} origin={period} irrigation={irrigation} loader={loader} visible onClose={() => setSheet('')} />}
  </View>;
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#ffffff' },
  headerActions: { width: 88, flexDirection: 'row', alignItems: 'center' },
  context: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: theme.colors.line },
  notice: { padding: 12, gap: 8, backgroundColor: '#fff4df' }, loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  month: { fontSize: 24, lineHeight: 34, color: theme.colors.primaryStrong },
  horizons: { flexDirection: 'row', gap: 5 }, horizon: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 6, backgroundColor: '#edf3ef' }, selected: { backgroundColor: theme.colors.primary },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, stat: { flexGrow: 1, minWidth: 58, alignItems: 'center', gap: 4 }, swatch: { width: 18, height: 4, borderRadius: 2 },
  tabs: { flexDirection: 'row', backgroundColor: '#ffffff', borderTopWidth: 1, borderColor: theme.colors.line }, tab: { flex: 1, minHeight: 60, padding: 8, gap: 2, alignItems: 'center', justifyContent: 'center' },
});
