import { Buffer } from 'buffer';
type Store = { getItemAsync(key: string): Promise<string | null>; setItemAsync(key: string, value: string): Promise<void>; deleteItemAsync(key: string): Promise<void> };

// Each Keychain value stays below 2 KB; publish the new generation atomically.
export function sessionStorage(store: Store) {
  async function manifest(key: string): Promise<{ id: string; count: number } | null> {
    const raw = await store.getItemAsync(key);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      return typeof value.id === 'string' && /^[a-z0-9-]+$/.test(value.id) && Number.isInteger(value.count) && value.count > 0 && value.count < 100 ? value : null;
    } catch { return null; }
  }
  async function erase(key: string, value: Awaited<ReturnType<typeof manifest>>) {
    if (value) for (let i = 0; i < value.count; i++) await store.deleteItemAsync(`${key}.${value.id}.${i}`);
  }
  return {
    async getItem(key: string) {
      const info = await manifest(key);
      if (!info) return null;
      let encoded = '';
      for (let i = 0; i < info.count; i++) {
        const part = await store.getItemAsync(`${key}.${info.id}.${i}`);
        if (part === null) return null;
        encoded += part;
      }
      return Buffer.from(encoded, 'base64').toString('utf8');
    },
    async setItem(key: string, value: string) {
      const previous = await manifest(key);
      const encoded = Buffer.from(value).toString('base64');
      const next = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, count: Math.ceil(encoded.length / 1800) };
      if (next.count < 1 || next.count >= 100) throw new Error('Invalid session size');
      try {
        for (let i = 0; i < next.count; i++) await store.setItemAsync(`${key}.${next.id}.${i}`, encoded.slice(i * 1800, (i + 1) * 1800));
        await store.setItemAsync(key, JSON.stringify(next));
      } catch (error) { await erase(key, next); throw error; }
      await erase(key, previous);
    },
    async removeItem(key: string) {
      const previous = await manifest(key);
      await store.deleteItemAsync(key);
      await erase(key, previous);
    },
  };
}
