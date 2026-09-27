import { describe, expect, it } from 'vitest';
import { createSeenStore } from '../src/lib/seen';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => {
      data.delete(k);
    },
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

describe('createSeenStore', () => {
  it('remembers ids across store instances', () => {
    const storage = memoryStorage();
    createSeenStore(10, storage).add('a');
    expect(createSeenStore(10, storage).load()).toEqual(new Set(['a']));
  });

  it('keeps only the most recent ids', () => {
    const store = createSeenStore(2, memoryStorage());
    store.add('a');
    store.add('b');
    store.add('c');
    expect(store.load()).toEqual(new Set(['b', 'c']));
  });

  it('refreshes an id that is seen again', () => {
    const store = createSeenStore(2, memoryStorage());
    store.add('a');
    store.add('b');
    store.add('a');
    store.add('c');
    expect(store.load()).toEqual(new Set(['a', 'c']));
  });

  it('ignores corrupt data and missing storage', () => {
    const storage = memoryStorage();
    storage.setItem('ajb:seen', '{not json');
    expect(createSeenStore(10, storage).load().size).toBe(0);
    const noStorage = createSeenStore(10, null);
    noStorage.add('a');
    expect(noStorage.load()).toEqual(new Set(['a']));
  });
});
