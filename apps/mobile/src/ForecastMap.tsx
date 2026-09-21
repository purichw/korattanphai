import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, G, Line, Path, Pattern, Rect } from 'react-native-svg';
import { geoIdentity, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import { Crosshair, MapPin, Maximize2, Minus, Plus } from 'lucide-react-native';
import geometry from '../../../public/geodata/nakhon-ratchasima-subdistricts.geojson';
import { irrigationColors, irrigationLabels, irrigationStatusFromSource } from '../../../src/irrigation';
import { AppText, Button, IconButton, Input, Sheet, s } from './ui';
import { locateKoratPoint } from '../../../src/mapPoint';
import { areaInfo, exportRiskLabel, matchesRisk, riskColors, riskIndex, type ExportLocation, type SavedRiskCriterion } from './domain';
import { cameraMatrix } from './mapCamera';
import { useMapCamera } from './useMapCamera';

type Props = { areaCode: string; rows: ExportLocation[]; horizon: number; risk: SavedRiskCriterion; mode: 'forecast' | 'irrigation'; onArea: (code: string) => void };
export function ForecastMap(props: Props) {
  const [full, setFull] = useState(false);
  const [point, setPoint] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [error, setError] = useState('');
  return <><MapCanvas {...props} onFullscreen={() => setFull(true)} />
    <Button secondary icon={MapPin} onPress={() => { setError(''); setPoint(true); }}>ค้นหาจากพิกัด</Button>
    <Sheet title={`แผนที่ · ${areaInfo(props.areaCode).label}`} visible={full} onClose={() => setFull(false)}><MapCanvas {...props} onArea={code => { setFull(false); props.onArea(code); }} /></Sheet>
    <Sheet title="ค้นหาพิกัดในนครราชสีมา" visible={point} onClose={() => setPoint(false)}>
      <AppText style={s.small}>ละติจูด</AppText><Input accessibilityLabel="ละติจูด" placeholder="14.98" keyboardType="decimal-pad" value={latitude} onChangeText={setLatitude} />
      <AppText style={s.small}>ลองจิจูด</AppText><Input accessibilityLabel="ลองจิจูด" placeholder="102.09" keyboardType="decimal-pad" value={longitude} onChangeText={setLongitude} />
      {!!error && <AppText accessibilityLiveRegion="polite">{error}</AppText>}
      <Button onPress={() => {
        try {
          const result = locateKoratPoint(latitude, longitude, geometry.features as unknown as Parameters<typeof locateKoratPoint>[2]);
          setPoint(false); props.onArea(String(result.feature.properties.Admin_code));
        } catch (e) { setError(e instanceof Error ? e.message : 'ไม่พบพื้นที่'); }
      }}>ค้นหาตำบล</Button>
    </Sheet>
  </>;
}
function MapCanvas({ areaCode, rows, horizon, risk, mode, onArea, onFullscreen }: Props & { onFullscreen?: () => void }) {
  const map = useMapCamera(areaCode);
  const [selected, setSelected] = useState('');
  useEffect(() => { setSelected(''); }, [areaCode]);
  const paths = useMemo(() => {
    const features = geometry.features.filter(f => String(f.properties.Admin_code).startsWith(areaCode));
    const collection = { type: 'FeatureCollection', features } as FeatureCollection<Geometry>;
    const path = geoPath(geoIdentity().reflectY(true).fitExtent([[12, 12], [348, 328]], collection));
    return features.map(f => ({ code: String(f.properties.Admin_code), path: path(f as GeoJSON.Feature) ?? '' }));
  }, [areaCode]);
  const outlines = useMemo(() => paths.map(feature => feature.path).join(''), [paths]);
  const byCode = useMemo(() => new Map(rows.map(row => [row.subdistrictCode, row])), [rows]);
  const select = (code: string) => { if (Date.now() >= map.ignorePressUntil.current) setSelected(current => current === code ? '' : code); };
  const selectedRow = byCode.get(selected);
  const count = rows.filter(row => matchesRisk(row.risks[horizon - 1], risk)).length;
  return <View style={{ gap: 10 }}>
    <View ref={map.viewport} onLayout={map.measure} onTouchStart={map.measure} style={styles.map} {...map.responder.panHandlers}>
      <Svg accessibilityLabel={`แผนที่${areaInfo(areaCode).label} ${count} ตำบลตรงตัวกรอง`} width="100%" height="100%" viewBox="0 0 360 340">
        <Defs><Pattern id="out-of-scope" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(40)"><Rect width="8" height="8" fill={riskColors[3]} /><Line x1="0" y1="0" x2="0" y2="8" stroke="#aebdb5" strokeWidth="3" /></Pattern></Defs>
        <Rect width="360" height="340" fill="#e9f0ec" onPress={() => select('')} />
        <G ref={map.group} transform={cameraMatrix(map.camera.current)}>
          {paths.map(feature => {
            const row = byCode.get(feature.code);
            const value = row?.risks[horizon - 1];
            const matches = !!row && matchesRisk(value, risk);
            const fill = mode === 'irrigation' ? irrigationColors[irrigationStatusFromSource(row?.irrigationStatus)] : value === null ? 'url(#out-of-scope)' : riskColors[riskIndex(value)];
            return <Path key={feature.code} d={feature.path} fill={matches ? fill : '#d5dfda'} opacity={matches ? 1 : 0.45} onPress={() => select(feature.code)} />;
          })}
          <Path d={outlines} fill="none" stroke="#ffffff" strokeWidth={0.8} vectorEffect="non-scaling-stroke" pointerEvents="none" />
          {!!selected && <Path d={paths.find(feature => feature.code === selected)?.path} fill="none" stroke="#245947" strokeWidth={2.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
        </G>
      </Svg>
      <View style={styles.tools}><IconButton icon={Plus} label="ซูมเข้า" onPress={() => map.zoom(1.5)} /><IconButton icon={Minus} label="ซูมออก" onPress={() => map.zoom(1 / 1.5)} /><IconButton icon={Crosshair} label="คืนมุมมองแผนที่" onPress={() => { map.reset(); setSelected(''); }} />{onFullscreen && <IconButton icon={Maximize2} label="ขยายแผนที่" onPress={onFullscreen} />}</View>
    </View>
    <View style={styles.legend}>{mode === 'forecast' ? riskColors.slice(0, 4).map((color, i) => <View key={color} style={s.row}><View style={{ width: 10, height: 10, backgroundColor: color, borderRadius: 2 }} /><AppText style={s.small}>{['ไม่เสี่ยง', 'ปานกลาง', 'สูง', 'นอกขอบเขต'][i]}</AppText></View>) : Object.entries(irrigationColors).map(([key, color]) => <View key={key} style={s.row}><View style={{ width: 10, height: 10, backgroundColor: color }} /><AppText style={s.small}>{irrigationLabels[key as keyof typeof irrigationColors]}</AppText></View>)}</View>
    {selected && <View style={styles.preview}><AppText weight="semibold" style={s.center}>{areaInfo(selected).label}</AppText><AppText style={s.center}>{!selectedRow ? 'พื้นที่นี้ไม่ตรงกับตัวกรองชลประทาน' : mode === 'forecast' ? exportRiskLabel(selectedRow.risks[horizon - 1]) : irrigationLabels[irrigationStatusFromSource(selectedRow.irrigationStatus)]}</AppText>{selected !== areaCode && <Button secondary onPress={() => onArea(selected)}>ดูพยากรณ์ตำบล</Button>}</View>}
    {!count && <AppText style={[s.small, s.center]}>ไม่มีตำบลตรงตัวกรอง · ขอบเขตแผนที่ยังเป็นพื้นที่เดิม</AppText>}
  </View>;
}
const styles = StyleSheet.create({ map: { aspectRatio: 360 / 340, width: '100%', overflow: 'hidden', borderRadius: 8 }, tools: { position: 'absolute', top: 8, right: 8, backgroundColor: '#ffffffee', borderRadius: 8 }, legend: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }, preview: { padding: 12, gap: 8, backgroundColor: '#eef5f1', borderRadius: 8 } });
