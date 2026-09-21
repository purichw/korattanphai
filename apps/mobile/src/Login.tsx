import { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View, type TextInput } from 'react-native';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { backend } from './backend';
import { AppText, Button, IconButton, Input, s } from './ui';
import { theme } from './theme';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const signIn = async () => {
    if (!backend || locked.current) return;
    if (!email.trim() || !password) { setError('กรอกอีเมลและรหัสผ่าน'); return; }
    locked.current = true; setBusy(true); setError('');
    try {
      const result = await backend.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) setError('เข้าสู่ระบบไม่สำเร็จ ตรวจสอบอีเมล รหัสผ่าน และการเชื่อมต่อ');
      else setPassword('');
    } catch { setError('เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setBusy(false); locked.current = false; }
  };
  return <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 48, gap: 24, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <View style={{ gap: 12, alignItems: 'center' }}><Image source={require('../assets/korat-tan-phai-emblem.png')} style={{ width: 88, height: 88 }} accessibilityLabel="โคราชทันภัย" />
        <AppText accessibilityRole="header" weight="bold" style={[s.center, { fontSize: 30, lineHeight: 44, color: theme.colors.primary }]}>โคราชทันภัย</AppText>
        <AppText style={[s.center, { color: theme.colors.muted }]}>พยากรณ์ภัยแล้ง จังหวัดนครราชสีมา</AppText>
      </View>
      <View style={{ gap: 14, marginTop: 20 }}><AppText weight="bold" style={[s.heading, s.center]}>เข้าสู่ระบบ</AppText>
        <AppText style={s.small}>อีเมล</AppText><Input accessibilityLabel="อีเมล" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="username" autoCorrect={false} editable={!busy} placeholder="name@example.com" />
        <AppText style={s.small}>รหัสผ่าน</AppText><View style={s.row}><Input accessibilityLabel="รหัสผ่าน" value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" textContentType="password" autoComplete="current-password" editable={!busy} onSubmitEditing={() => void signIn()} returnKeyType="go" style={s.flex} /><IconButton label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} icon={visible ? EyeOff : Eye} onPress={() => setVisible(!visible)} /></View>
        {error !== '' && <AppText accessibilityRole="alert" style={{ color: '#b83b3f' }}>{error}</AppText>}
        {!backend && <AppText accessibilityRole="alert">ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase สำหรับแอป</AppText>}
        <Button busy={busy} disabled={!backend} icon={ArrowRight} onPress={() => void signIn()}>เข้าสู่ระบบ</Button>
      </View>
      <View style={[s.row, { marginTop: 'auto', paddingTop: 24, justifyContent: 'center' }]}><ShieldCheck size={20} color={theme.colors.primary} /><AppText style={[s.small, s.center, { flexShrink: 1 }]}>ใช้บัญชีโคราชทันภัยที่ได้รับจากผู้ดูแลระบบ</AppText></View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
