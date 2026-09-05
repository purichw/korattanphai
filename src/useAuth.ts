import { useEffect, useRef, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { authErrorMessage, clearLegacyLogin, type LoginUser } from "./auth";
import { getSupabaseClient } from "./supabase";

type AuthState =
  | { status: "checking" | "signedOut" | "unconfigured" | "error"; user: null }
  | { status: "signedIn"; user: LoginUser };
type ClientLoader = () => Promise<SupabaseClient | null>;

export function useAuth(loadClient: ClientLoader = getSupabaseClient) {
  const [state, setState] = useState<AuthState>({ status: "checking", user: null });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<"signIn" | "signOut" | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);
  const userRef = useRef<LoginUser | null>(null);
  const mounted = useRef(false);
  const revision = useRef(0);
  const operation = useRef(0);
  const busyRef = useRef<typeof busy>(null);
  const signedOutBarrier = useRef(false);

  const applySession = (session: Session | null) => {
    userRef.current = session?.user ?? null;
    setState(session?.user ? { status: "signedIn", user: session.user } : { status: "signedOut", user: null });
  };

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    mounted.current = true;
    signedOutBarrier.current = false;
    userRef.current = null;
    clearLegacyLogin();
    setState({ status: "checking", user: null });
    clientRef.current = null;
    const initialRevision = ++revision.current;

    void loadClient().then(async (client) => {
      if (!active) return;
      if (!client) {
        setState({ status: "unconfigured", user: null });
        return;
      }
      clientRef.current = client;
      const { data } = client.auth.onAuthStateChange((event, session) => {
        // getSession owns initialization; newer auth events invalidate its result.
        if (!active || event === "INITIAL_SESSION") return;
        revision.current += 1;
        if (session && (busyRef.current === "signOut" || signedOutBarrier.current)) return;
        if (event === "SIGNED_OUT") signedOutBarrier.current = true;
        applySession(session);
      });
      unsubscribe = () => data.subscription.unsubscribe();
      const result = await client.auth.getSession();
      if (!active || revision.current !== initialRevision) return;
      if (result.error) setState({ status: "error", user: null });
      else applySession(result.data.session);
    }).catch(() => {
      if (active && revision.current === initialRevision) setState({ status: "error", user: null });
    });
    return () => {
      active = false;
      mounted.current = false;
      revision.current += 1;
      operation.current += 1;
      unsubscribe?.();
    };
  }, [loadClient, attempt]);

  const signIn = async (email: string, password: string) => {
    const client = clientRef.current;
    if (!client || busyRef.current) return;
    const currentOperation = ++operation.current;
    const startedAtRevision = ++revision.current;
    busyRef.current = "signIn";
    signedOutBarrier.current = false;
    setBusy("signIn");
    setSignInError(null);
    setSignOutError(null);
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (!mounted.current || operation.current !== currentOperation) return;
      if (error) setSignInError(authErrorMessage(error));
      else if (revision.current === startedAtRevision) {
        if (data.session) applySession(data.session);
        else setSignInError("ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (error) {
      if (mounted.current && operation.current === currentOperation) setSignInError(authErrorMessage(error));
    } finally {
      if (mounted.current && operation.current === currentOperation) { busyRef.current = null; setBusy(null); }
    }
  };

  const signOut = async (): Promise<boolean> => {
    const client = clientRef.current;
    if (!client || busyRef.current === "signOut") return false;
    const currentOperation = ++operation.current;
    revision.current += 1;
    busyRef.current = "signOut";
    setBusy("signOut");
    setSignOutError(null);
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (!mounted.current || operation.current !== currentOperation) return false;
      if (error) {
        setSignOutError(userRef.current
          ? "ออกจากระบบไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองใหม่"
          : "ออกจากระบบบนเครื่องนี้แล้ว แต่ยังยืนยันการออกจากระบบกับเซิร์ฟเวอร์ไม่ได้");
      } else {
        signedOutBarrier.current = true;
        applySession(null);
      }
      return userRef.current === null;
    } catch {
      if (mounted.current && operation.current === currentOperation) {
        setSignOutError(userRef.current
          ? "ออกจากระบบไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองใหม่"
          : "ออกจากระบบบนเครื่องนี้แล้ว แต่ยังยืนยันการออกจากระบบกับเซิร์ฟเวอร์ไม่ได้");
      }
      return userRef.current === null;
    } finally {
      if (mounted.current && operation.current === currentOperation) { busyRef.current = null; setBusy(null); }
    }
  };

  return { ...state, signIn, signOut, signingIn: busy === "signIn", signingOut: busy === "signOut", signInError, signOutError,
    retrySession: () => setAttempt((value) => value + 1) };
}
