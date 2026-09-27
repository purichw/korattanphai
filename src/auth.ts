import type { User } from "@supabase/supabase-js";
import { writeBrowserStorage } from "./browserStorage";

export type LoginUser = User;

export function clearLegacyLogin() {
  return writeBrowserStorage("korat-tan-phai-login-user", null);
}

export function getAccountDisplayName(user: LoginUser): string {
  for (const key of ["full_name", "display_name", "name"]) {
    const value = user.user_metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return user.email || "บัญชีผู้ใช้งาน";
}

export function safeInternalRedirect(value: string | null, origin: string): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || ['/login', '/login/', '/admin/login', '/admin/login/'].includes(url.pathname)) return "/";
    return url.pathname + url.search + url.hash;
  } catch { return "/"; }
}

export function authErrorMessage(error: unknown): string {
  const detail = error && typeof error === "object" ? error as { status?: number; name?: string; code?: string } : {};
  if (detail.status === 429) return "เข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
  if (detail.name === "AuthRetryableFetchError" || detail.name === "TypeError" || detail.status === 0 || (detail.status ?? 0) >= 500) {
    return "ติดต่อระบบเข้าสู่ระบบไม่ได้ กรุณาตรวจการเชื่อมต่อแล้วลองใหม่";
  }
  if (detail.status === 400 || detail.status === 401 || detail.status === 403 || detail.code === "invalid_credentials") {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  }
  return "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง";
}
