type SessionRecord = { value: string | null }
export type AuthRecordStore = {
  read: (key: string) => Promise<SessionRecord | undefined>
  write: (key: string, record: SessionRecord) => Promise<void>
}
const unavailable = () =>
  new Error(
    'Your browser could not save your sign-in. Allow browser storage or try a normal browser window.',
  )
let opening: Promise<IDBDatabase> | undefined
function openDatabase(): Promise<IDBDatabase> {
  if (opening) return opening
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(unavailable())
      return
    }
    const request = globalThis.indexedDB.open('ascent-auth', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('sessions')
    request.onerror = () => reject(unavailable())
    request.onblocked = () => reject(unavailable())
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        opening = undefined
      }
      resolve(database)
    }
  }).catch((error) => {
    opening = undefined
    throw error
  })
  return opening
}
const records: AuthRecordStore = {
  async read(key) {
    const database = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('sessions', 'readonly')
      const request = transaction.objectStore('sessions').get(key)
      transaction.oncomplete = () => resolve(request.result as SessionRecord | undefined)
      transaction.onerror = transaction.onabort = () => reject(unavailable())
    })
  },
  async write(key, record) {
    const database = await openDatabase()
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('sessions', 'readwrite')
      transaction.objectStore('sessions').put(record, key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = transaction.onabort = () => reject(unavailable())
    })
  },
}

// Auth sessions have their own IndexedDB store; they do not compete with demo
// inventory, photos or guest carts for the small localStorage allocation.
export function createAuthStorage(store: AuthRecordStore, legacy = () => globalThis.localStorage) {
  const removeLegacy = (key: string) => {
    try {
      legacy()?.removeItem(key)
    } catch {
      /* The persisted record takes precedence. */
    }
  }
  return {
    async getItem(key: string): Promise<string | null> {
      const saved = await store.read(key)
      if (saved !== undefined) return saved.value
      let previous: string | null = null
      try {
        previous = legacy()?.getItem(key) ?? null
      } catch {
        /* Storage may be restricted. */
      }
      if (previous !== null) {
        await store.write(key, { value: previous })
        removeLegacy(key)
      }
      return previous
    },
    async setItem(key: string, value: string) {
      await store.write(key, { value })
      removeLegacy(key)
    },
    async removeItem(key: string) {
      // A tombstone prevents an inaccessible old localStorage token from being
      // imported again after logout.
      await store.write(key, { value: null })
      removeLegacy(key)
    },
  }
}
export const authStorage = createAuthStorage(records)
