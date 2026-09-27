/**
 * Remembers which tiles this visitor has recently seen, so the next visit leads with fresh
 * ones. Stored only in the visitor's own browser. Storage can be unavailable (private mode,
 * blocked site data), in which case everything quietly falls back to a plain shuffle.
 */
const STORAGE_KEY = 'ajb:seen';

export interface SeenStore {
  load(): Set<string>;
  add(id: string): void;
}

export function createSeenStore(
  limit: number,
  storage: Storage | null = safeLocalStorage(),
): SeenStore {
  // Most recent first, so trimming to `limit` drops the oldest.
  let ids: string[] = read();

  function read(): string[] {
    try {
      const parsed: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  function write(): void {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // Quota or access error: remembering is a nicety, not a requirement.
    }
  }

  return {
    load: () => new Set(ids),
    add(id) {
      if (ids[0] === id) return;
      ids = [id, ...ids.filter((x) => x !== id)].slice(0, limit);
      write();
    },
  };
}

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
