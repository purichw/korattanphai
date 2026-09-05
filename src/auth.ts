import { readBrowserStorage, writeBrowserStorage } from "./browserStorage";

export type LoginUser = {
  id: "pointy" | "somsak";
  name: "Pointy" | "Somsak";
};

export const LOGIN_STORAGE_KEY = "korat-tan-phai-login-user";

export const loginUsers: LoginUser[] = [
  { id: "pointy", name: "Pointy" },
  { id: "somsak", name: "Somsak" },
];

export function authenticateUsername(value: string): LoginUser | null {
  const normalized = value.trim().toLowerCase();
  return loginUsers.find((user) => user.id === normalized) ?? null;
}

export function readStoredLogin(): LoginUser | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = readBrowserStorage(LOGIN_STORAGE_KEY);
    if (!stored) return null;
    return authenticateUsername(stored);
  } catch {
    return null;
  }
}

export function writeStoredLogin(user: LoginUser) {
  return writeBrowserStorage(LOGIN_STORAGE_KEY, user.name);
}

export function clearStoredLogin() {
  return writeBrowserStorage(LOGIN_STORAGE_KEY, null);
}
