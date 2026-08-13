// ============================================================================
// LRU CACHE IMPLEMENTATION (WITH PERSISTENCE)
// ============================================================================

import { SimpleIDB } from "./indexed-db.ts";

export interface CacheEntry {
  data: string; // base64
  size: number;
  timestamp: number;
  lastAccessed?: number;
}

interface PersistentCacheStorage {
  getAll(): Promise<unknown[]>;
  getAllKeys(): Promise<IDBValidKey[]>;
  set(key: IDBValidKey, value: unknown): Promise<void>;
  delete(key: IDBValidKey): Promise<void>;
  clear(): Promise<void>;
}

export class LRUCache {
  private cache: Map<number, CacheEntry>;
  private maxTabs: number;
  private maxBytes: number;
  private currentBytes: number;
  private accessOrder: Map<number, true>;
  private storage: PersistentCacheStorage;
  public ready: Promise<void>;

  constructor(
    maxTabs = 30,
    maxBytes = 20 * 1024 * 1024,
    storage: PersistentCacheStorage = new SimpleIDB("TabFlowDB", "screenshots"),
  ) {
    this.cache = new Map(); // Map for O(1) access
    this.maxTabs = maxTabs;
    this.maxBytes = maxBytes;
    this.currentBytes = 0;
    this.accessOrder = new Map(); // Oldest key first, newest key last

    // Persistence
    this.storage = storage;
    this.ready = this._restoreFromStorage();
  }

  resize(maxTabs: number, maxBytes: number): void {
    const normalizedTabs = Math.max(1, Math.floor(maxTabs));
    const normalizedBytes = Math.max(1, Math.floor(maxBytes));
    this.maxTabs = normalizedTabs;
    this.maxBytes = normalizedBytes;

    while (
      (this.cache.size > this.maxTabs || this.currentBytes > this.maxBytes) &&
      this.cache.size > 0
    ) {
      this._evictLRU();
    }
  }

  // Restore cache from IndexedDB on startup
  private async _restoreFromStorage(): Promise<void> {
    try {
      const keys = await this.storage.getAllKeys();
      if (keys.length === 0) return;

      const values = await this.storage.getAll();

      const restoredEntries: Array<[number, CacheEntry]> = [];

      keys.forEach((key, index) => {
        const raw = values[index];
        if (typeof key !== "number" || !raw || typeof raw !== "object") return;

        const value = raw as Partial<CacheEntry>;
        if (
          typeof value.data === "string" &&
          typeof value.size === "number" &&
          typeof value.timestamp === "number"
        ) {
          restoredEntries.push([
            key,
            {
              data: value.data,
              size: value.size,
              timestamp: value.timestamp,
              lastAccessed:
                typeof value.lastAccessed === "number"
                  ? value.lastAccessed
                  : value.timestamp,
            },
          ]);
        }
      });

      // Reconstruct oldest-to-newest order so eviction remains O(1).
      restoredEntries.sort(
        (a, b) =>
          (a[1].lastAccessed ?? a[1].timestamp) -
          (b[1].lastAccessed ?? b[1].timestamp),
      );

      for (const [key, entry] of restoredEntries) {
        this.cache.set(key, entry);
        this.currentBytes += entry.size;
        this._touch(key);

        // Enforce current limits during restore so persisted caches cannot
        // remain above runtime memory/tab budgets.
        while (
          (this.cache.size > this.maxTabs ||
            this.currentBytes > this.maxBytes) &&
          this.cache.size > 0
        ) {
          this._evictLRU();
        }
      }

      console.log(
        `[CACHE] Restored ${this.cache.size} screenshots from storage`
      );
    } catch (error) {
      console.error("[CACHE] Failed to restore from storage:", error);
    }
  }

  // Get item and mark as recently used
  get(key: number): CacheEntry | null {
    if (!this.cache.has(key)) return null;

    const entry = this.cache.get(key)!;
    entry.lastAccessed = Date.now();
    this._touch(key);

    return entry;
  }

  // Check if entry is fresh without updating access order
  isFresh(key: number, maxAgeMs: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp <= maxAgeMs;
  }

  // Get item only if it is younger than maxAgeMs. Used to decide whether a
  // re-capture is warranted — NOT to decide whether a preview is displayable.
  // A stale entry is deliberately left in place: it stays available to `get`
  // so the UI can show an old thumbnail instead of a blank card, and eviction
  // remains the LRU's job alone.
  getIfFresh(key: number, maxAgeMs: number): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > maxAgeMs) return null;
    return this.get(key);
  }

  // Set item with automatic eviction
  set(key: number, value: string): void {
    const size = this._estimateSize(value);

    // Remove existing entry if updating. It has to leave `cache` as well as
    // `accessOrder`, otherwise it still counts towards `maxTabs` below and a
    // replacement would evict an unrelated tab to make room for itself.
    if (this.cache.has(key)) {
      const oldSize = this.cache.get(key)!.size;
      this.currentBytes -= oldSize;
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }

    // Evict if necessary
    while (
      (this.cache.size >= this.maxTabs ||
        this.currentBytes + size > this.maxBytes) &&
      this.cache.size > 0
    ) {
      this._evictLRU();
    }

    // Add new entry
    const now = Date.now();
    const entry = { data: value, size, timestamp: now, lastAccessed: now };
    this.cache.set(key, entry);
    this.currentBytes += size;
    this._touch(key);

    // Persist to storage
    this.storage
      .set(key, entry)
      .catch((e) => console.error("Failed to persist screenshot", e));
  }

  // Remove specific entry
  delete(key: number): boolean {
    if (!this.cache.has(key)) return false;

    const entry = this.cache.get(key);
    if (!entry) return false;
    this.currentBytes -= entry.size;
    this.cache.delete(key);
    this.accessOrder.delete(key);

    // Remove from storage
    this.storage
      .delete(key)
      .catch((e) => console.error("Failed to delete screenshot", e));

    return true;
  }

  // Evict least recently used entry
  private _evictLRU(): void {
    const lruKey = this.accessOrder.keys().next().value as number | undefined;
    if (lruKey === undefined) return;

    this.accessOrder.delete(lruKey);
    const entry = this.cache.get(lruKey);

    if (entry) {
      this.currentBytes -= entry.size;
      this.cache.delete(lruKey);
      this.storage
        .delete(lruKey)
        .catch((e) => console.warn("Failed to evict from storage", e));

      console.debug(
        `[LRU] Evicted tab ${lruKey} (${(entry.size / 1024).toFixed(1)}KB)`
      );
    }
  }

  // Estimate size of base64 screenshot
  _estimateSize(data: string): number {
    // Data URLs live as JS strings in memory, so heap impact is closer to
    // UTF-16 string storage than decoded binary size.
    return data.length * 2;
  }

  private _touch(key: number): void {
    this.accessOrder.delete(key);
    this.accessOrder.set(key, true);
  }

  // Get cache statistics
  getStats(): {
    entries: number;
    bytes: number;
    maxTabs: number;
    maxBytes: number;
    utilizationPercent: string;
  } {
    return {
      entries: this.cache.size,
      bytes: this.currentBytes,
      maxTabs: this.maxTabs,
      maxBytes: this.maxBytes,
      utilizationPercent: ((this.currentBytes / this.maxBytes) * 100).toFixed(
        1
      ),
    };
  }

  // Clear all entries
  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.currentBytes = 0;
    this.storage
      .clear()
      .catch((e) => console.error("Failed to clear storage", e));
  }
}




