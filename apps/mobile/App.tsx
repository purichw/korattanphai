import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { theme } from './src/theme';
import { backend } from './src/backend';
import { Empty, FontsReady } from './src/ui';
import { Login } from './src/Login';
import { Workspace } from './src/Workspace';

const brandFonts = {
  [theme.fonts.regular]: require('@expo-google-fonts/google-sans/400Regular/GoogleSans_400Regular.ttf'),
  [theme.fonts.semibold]: require('@expo-google-fonts/google-sans/600SemiBold/GoogleSans_600SemiBold.ttf'),
  [theme.fonts.bold]: require('@expo-google-fonts/google-sans/700Bold/GoogleSans_700Bold.ttf'),
};
export default function App() {
  const [fonts, fontError] = useFonts(brandFonts);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!backend) { setReady(true); return; }
    let live = true, changed = false;
    setReady(false); setError(false);
    const { data } = backend.auth.onAuthStateChange((_event, next) => {
      changed = true;
      if (live) { setSession(next); setReady(true); setError(false); }
    });
    void backend.auth.getSession().then(result => {
      if (!live || changed) return;
      setSession(result.data.session); setError(!!result.error); setReady(true);
    }).catch(() => { if (live && !changed) { setError(true); setReady(true); } });
    const update = (state: string) => state === 'active' ? backend!.auth.startAutoRefresh() : backend!.auth.stopAutoRefresh();
    update(AppState.currentState);
    const listener = AppState.addEventListener('change', update);
    return () => { live = false; data.subscription.unsubscribe(); listener.remove(); backend!.auth.stopAutoRefresh(); };
  }, [attempt]);
  return <SafeAreaProvider><FontsReady.Provider value={fonts}><SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
    <StatusBar style="dark" />
    {!ready || (!fonts && !fontError) ? <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="กำลังเปิดแอป" color={theme.colors.primary} /></View>
      : error ? <Empty title="ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ" action="ลองอีกครั้ง" onAction={() => setAttempt(n => n + 1)} />
      : session ? <Workspace key={session.user.id} userId={session.user.id} email={session.user.email ?? ''} /> : <Login />}
  </SafeAreaView></FontsReady.Provider></SafeAreaProvider>;
}
