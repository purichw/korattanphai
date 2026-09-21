import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, Segments, s } from './ui';
import { exportHorizons, forecastTargetPeriod, formatMonth, riskColors, summarizeExportRisks, type ExportLocation } from './domain';

export function ForecastChart({ rows, origin, horizon, onHorizon }: { rows: ExportLocation[]; origin: string; horizon: number; onHorizon: (h: number) => void }) {
  const [unit, setUnit] = useState('percent');
  const totals = exportHorizons.map(h => summarizeExportRisks(rows, h));
  const max = unit === 'percent' ? 100 : Math.max(4, Math.ceil(Math.max(0, ...totals.map(t => t.valid)) / 4) * 4);
  const selected = totals[horizon - 1];
  return <View style={{ gap: 14 }}>
    <Segments value={unit} options={[{ value: 'percent', label: 'เปอร์เซ็นต์ (%)' }, { value: 'count', label: 'จำนวนตำบล' }]} onChange={setUnit} />
    <View style={{ flexDirection: 'row', height: 218 }}>
      <View style={{ width: 34, height: 166, justifyContent: 'space-between' }}>{[1, .75, .5, .25, 0].map(n => <AppText key={n} style={{ fontSize: 10, lineHeight: 14, color: '#65726b' }}>{Math.round(max * n)}{unit === 'percent' ? '%' : ''}</AppText>)}</View>
      <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>{totals.map((total, i) => {
        // Only risks 1/2 form the risk bar; 0 remains part of the valid denominator.
        const values = [total.counts[1], total.counts[2]].map(n => unit === 'percent' ? total.valid ? n / total.valid * 100 : 0 : n);
        const top = values[0] + values[1];
        return <Pressable key={i} accessibilityRole="button" accessibilityLabel={`T+${i + 1} ${formatMonth(forecastTargetPeriod(origin, i + 1), 'th')} เสี่ยงปานกลาง ${total.counts[1]} เสี่ยงสูง ${total.counts[2]} มีค่า ${total.valid} จาก ${total.total} ตำบล`} accessibilityState={{ selected: i + 1 === horizon }} onPress={() => onHorizon(i + 1)} style={{ flex: 1, alignItems: 'center', backgroundColor: i + 1 === horizon ? '#eef7fa' : 'transparent', borderRadius: 6 }}>
          <View style={{ height: 166, width: '100%', justifyContent: 'flex-end', alignItems: 'center', borderBottomWidth: 1, borderColor: '#d8ded7' }}>
            <AppText weight="semibold" style={{ fontSize: 11, lineHeight: 18 }}>{total.valid ? `${Number(top.toFixed(1))}${unit === 'percent' ? '%' : ''}` : '—'}</AppText>
            <View style={{ width: '65%', height: values[1] / max * 140, backgroundColor: riskColors[2] }} />
            <View style={{ width: '65%', height: values[0] / max * 140, backgroundColor: riskColors[1] }} />
          </View>
          <AppText weight="semibold" style={{ fontSize: 12, lineHeight: 20 }}>T+{i + 1}</AppText><AppText style={{ fontSize: 10, lineHeight: 16, textAlign: 'center' }}>{formatMonth(forecastTargetPeriod(origin, i + 1), 'th')}</AppText>
        </Pressable>;
      })}</View>
    </View>
    <AppText style={[s.small, s.center]}>T+{horizon} · มีค่าพยากรณ์ {selected.valid}/{selected.total} ตำบล · นอกขอบเขต {selected.counts[3]} · ไม่มีข้อมูล {selected.counts[4]}</AppText>
  </View>;
}
