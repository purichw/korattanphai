import { createContext, useContext, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextProps, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronDown, Search, SearchX, X, type LucideIcon } from 'lucide-react-native';
import { theme } from './theme';
import { areaMatchesSearch } from '../../../src/forecastAnalysis';

export const FontsReady = createContext(true);
export function AppText({ weight = 'regular', style, ...props }: TextProps & { weight?: keyof typeof theme.fonts }) {
  const ready = useContext(FontsReady);
  return <Text {...props} style={[s.text, { fontFamily: ready ? theme.fonts[weight] : undefined, fontWeight: ready ? 'normal' : weight === 'regular' ? '400' : weight === 'bold' ? '700' : '600' }, style]} />;
}
export function IconButton({ icon: Icon, label, onPress, disabled = false, active = false }: { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean; active?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected: active }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.iconButton, active && s.active, (pressed || disabled) && s.dim]}><Icon size={22} color={theme.colors.primary} /></Pressable>;
}
export function Button({ children, onPress, icon: Icon, busy = false, disabled = false, secondary = false }: { children: ReactNode; onPress: () => void; icon?: LucideIcon; busy?: boolean; disabled?: boolean; secondary?: boolean }) {
  const color = secondary ? theme.colors.primary : '#ffffff';
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (pressed || disabled || busy) && s.dim]}>
    {busy ? <ActivityIndicator color={color} /> : Icon && <Icon size={20} color={color} />}<AppText weight="semibold" style={{ color, flexShrink: 1, textAlign: 'center' }}>{children}</AppText>
  </Pressable>;
}
export function Input(props: TextInputProps) {
  const fonts = useContext(FontsReady);
  return <TextInput placeholderTextColor={theme.colors.muted} {...props} style={[s.input, { fontFamily: fonts ? theme.fonts.regular : undefined }, props.style]} />;
}
function HeadingRow({ title, action }: { title: string; action?: ReactNode }) {
  return <View style={s.headingRow}>
    {action && <View style={s.headingAction} />}
    <AppText accessibilityRole="header" weight="bold" style={[s.heading, s.flex, s.center]}>{title}</AppText>
    {action && <View style={s.headingAction}>{action}</View>}
  </View>;
}
export function Sheet({ title, visible, onClose, children, scroll = true }: { title: string; visible: boolean; onClose: () => void; children: ReactNode; scroll?: boolean }) {
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={s.sheet} edges={['bottom', 'left', 'right']}>
      <View style={s.sheetHeader}><HeadingRow title={title} action={<IconButton icon={X} label="ปิด" onPress={onClose} />} /></View>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent}>{children}</ScrollView> : children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
export type Choice = { value: string; label: string; detail?: string; search?: string };
export function Select({ label, value, options, onChange, searchable = true }: { label: string; value: string; options: Choice[]; onChange: (value: string) => void; searchable?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const choices = options.filter(o => areaMatchesSearch(search, o.label, o.detail ?? '', o.search ?? '', o.value));
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${options.find(o => o.value === value)?.label ?? value}`} onPress={() => { setSearch(''); setOpen(true); }} style={s.select}>
      <View style={s.selectAccessory} /><View style={s.flex}><AppText style={[s.small, s.center]}>{label}</AppText><AppText weight="semibold" style={s.center}>{options.find(o => o.value === value)?.label ?? value}</AppText></View><ChevronDown color={theme.colors.muted} size={18} />
    </Pressable>
    <Sheet title={label} visible={open} onClose={() => setOpen(false)} scroll={false}>
      {searchable && <View style={s.search}><Search color={theme.colors.muted} size={20} /><Input accessibilityLabel={`ค้นหา${label}`} placeholder="ค้นหาชื่อหรือรหัส" value={search} onChangeText={setSearch} style={s.searchInput} autoCorrect={false} /></View>}
      <FlatList data={choices} keyExtractor={o => o.value} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Empty title="ไม่พบรายการ" detail="ลองค้นหาด้วยชื่อหรือรหัสอื่น" />}
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: item.value === value }} onPress={() => { onChange(item.value); setOpen(false); }} style={[s.choice, item.value === value && s.active]}>
          <View style={s.flex}><AppText weight={item.value === value ? 'semibold' : 'regular'}>{item.label}</AppText>{item.detail && <AppText style={s.small}>{item.detail}</AppText>}</View>
          {item.value === value && <Check size={21} color={theme.colors.primary} />}
        </Pressable>} />
    </Sheet>
  </>;
}
export function Empty({ title, detail, action, onAction }: { title: string; detail?: string; action?: string; onAction?: () => void }) {
  return <View style={s.empty}><SearchX color={theme.colors.muted} size={32} /><AppText weight="semibold" style={s.center}>{title}</AppText>{detail && <AppText style={[s.small, s.center]}>{detail}</AppText>}{action && onAction && <Button secondary onPress={onAction}>{action}</Button>}</View>;
}
export function Section({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return <View style={s.section}>{title && <HeadingRow title={title} action={action} />}{children}</View>;
}
export function Segments({ value, options, onChange }: { value: string; options: Choice[]; onChange: (value: string) => void }) {
  return <View accessibilityRole="tablist" style={s.segments}>{options.map(o => <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: value === o.value }} onPress={() => onChange(o.value)} style={[s.segment, value === o.value && s.segmentSelected]}><AppText weight="semibold" style={{ textAlign: 'center', fontSize: 14, color: value === o.value ? theme.colors.primary : theme.colors.muted }}>{o.label}</AppText></Pressable>)}</View>;
}
export const s = StyleSheet.create({
  flex: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { fontSize: 16, lineHeight: 25, color: theme.colors.ink, letterSpacing: 0 },
  small: { fontSize: 13, lineHeight: 21, color: theme.colors.muted },
  heading: { fontSize: 19, lineHeight: 29, flexShrink: 1 }, center: { textAlign: 'center' },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headingAction: { width: 44, alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 48, padding: 12, borderRadius: 8, backgroundColor: theme.colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  secondary: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.lineStrong },
  dim: { opacity: 0.5 }, active: { backgroundColor: '#e6efe6' },
  input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: theme.colors.lineStrong, borderRadius: 8, color: theme.colors.ink, fontSize: 16 },
  sheet: { flex: 1, backgroundColor: theme.colors.surface },
  sheetHeader: { padding: 16, borderBottomWidth: 1, borderColor: theme.colors.line },
  sheetContent: { padding: 16, gap: 16, paddingBottom: 32 },
  select: { minHeight: 68, padding: 12, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surface },
  selectAccessory: { width: 18 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 8 },
  searchInput: { flex: 1, borderWidth: 0, paddingHorizontal: 0 },
  choice: { padding: 14, minHeight: 52, flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.line },
  empty: { padding: 24, gap: 12, alignItems: 'center', backgroundColor: theme.colors.surfaceMuted, borderRadius: 8 },
  section: { padding: 16, gap: 16, backgroundColor: theme.colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line },
  segments: { flexDirection: 'row', backgroundColor: theme.colors.bg, padding: 3, borderRadius: 8 },
  segment: { flex: 1, padding: 9, minHeight: 44, justifyContent: 'center', borderRadius: 6 },
  segmentSelected: { backgroundColor: theme.colors.surface },
});
