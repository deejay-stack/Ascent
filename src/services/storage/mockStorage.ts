// The only browser persistence boundary. Replace during database integration.
export const mockStorage = {
  read<T>(key: string, fallback: T): T {
    try { const raw = globalThis.localStorage?.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
  },
  write<T>(key: string, value: T): void {
    // Reject business mutations before publishing if persistence fails.
    globalThis.localStorage?.setItem(key, JSON.stringify(value))
  },
  getText(key: string) { try { return globalThis.localStorage?.getItem(key) ?? null } catch { return null } },
  setText(key: string, value: string) { globalThis.localStorage?.setItem(key, value) },
  remove(key: string) { globalThis.localStorage?.removeItem(key) },
}
