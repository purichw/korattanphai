import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { BookmarkPlus, MapPin, Trash2 } from 'lucide-react-native';
import { createSavedWorkspaceClient, savedWorkspaceError, type FollowedArea, type SavedFilter, type SavedForecastSelection } from '../../../src/data/savedWorkspaces';
import { backend } from './backend';
import { areaInfo, formatMonth } from './domain';
import { AppText, Button, Empty, IconButton, Input, Section, s } from './ui';

export function Saved({ userId, selection, onArea, onFilter }: { userId: string; selection: SavedForecastSelection | null; onArea: (code: string) => void; onFilter: (filter: SavedFilter) => void }) {
  const client = useMemo(() => createSavedWorkspaceClient(userId, async () => backend), [userId]);
  const [areas, setAreas] = useState<FollowedArea[]>([]);
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const run = useCallback(async (action?: (signal: AbortSignal) => Promise<void>) => {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    const timeout = setTimeout(() => request.abort(), 30000);
    setBusy(true); setError('');
    try {
      if (action) await action(request.signal);
      const nextAreas = await client.listAreas(request.signal);
      const nextFilters = await client.listFilters(request.signal);
      if (!request.signal.aborted) { setAreas(nextAreas); setFilters(nextFilters); }
    } catch (e) { if (controller.current === request) setError(savedWorkspaceError(e)); }
    finally { clearTimeout(timeout); if (controller.current === request) setBusy(false); }
  }, [client]);
  useEffect(() => { void run(); return () => { controller.current?.abort(); controller.current = null; }; }, [run]);
  const remove = (kind: 'area' | 'filter', id: string, label: string) => Alert.alert('ลบรายการบันทึก?', label, [{ text: 'ยกเลิก', style: 'cancel' }, { text: 'ลบ', style: 'destructive', onPress: () => void run(signal => client.remove(kind, id, signal)) }]);
  return <ScrollView keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void run()} />} contentContainerStyle={{ paddingBottom: 24, gap: 12 }}>
    <Section title="บันทึกของฉัน">
      {selection && <><AppText style={s.center}>{areaInfo(selection.area_code).label} · {formatMonth(selection.target_period.slice(0, 7), 'th')} · T+{selection.horizon}</AppText>
        <Button icon={MapPin} secondary disabled={busy || areas.some(a => a.area_code === selection.area_code)} onPress={() => void run(signal => client.follow(selection.area_code, signal))}>{areas.some(a => a.area_code === selection.area_code) ? 'ติดตามพื้นที่นี้แล้ว' : 'ติดตามพื้นที่นี้'}</Button>
        <Input accessibilityLabel="ชื่อชุดตัวกรอง" placeholder="ชื่อชุดตัวกรอง" value={name} maxLength={80} onChangeText={setName} /><Button icon={BookmarkPlus} disabled={busy || !name.trim()} onPress={() => void run(signal => client.saveFilter(name, selection, signal))}>บันทึกชุดตัวกรอง</Button></>}
      {!!error && <Empty title={error} action="ลองอีกครั้ง" onAction={() => void run()} />}
    </Section>
    <Section title="พื้นที่ที่ติดตาม">{!areas.length && !busy && <Empty title="ยังไม่มีพื้นที่ที่ติดตาม" />}{areas.map(a => <View key={a.area_code} style={s.row}><View style={s.flex}><Button secondary onPress={() => onArea(a.area_code)}>{areaInfo(a.area_code).label}</Button></View><IconButton disabled={busy} icon={Trash2} label={`เลิกติดตาม ${areaInfo(a.area_code).label}`} onPress={() => remove('area', a.area_code, areaInfo(a.area_code).label)} /></View>)}</Section>
    <Section title="ชุดตัวกรอง">{!filters.length && !busy && <Empty title="ยังไม่มีชุดตัวกรอง" />}{filters.map(f => <View key={f.id} style={s.row}><View style={s.flex}><Button secondary onPress={() => onFilter(f)}>{f.name}</Button><AppText style={s.small}>{areaInfo(f.area_code).label} · {formatMonth(f.target_period.slice(0, 7), 'th')} · T+{f.horizon}</AppText></View><IconButton disabled={busy} icon={Trash2} label={`ลบ ${f.name}`} onPress={() => remove('filter', f.id, f.name)} /></View>)}</Section>
  </ScrollView>;
}
