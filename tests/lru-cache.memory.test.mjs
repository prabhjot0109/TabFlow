import assert from "node:assert/strict";
import test from "node:test";

import { LRUCache } from "../src/background/cache/lru-cache.ts";

class FakeStorage {
  values = new Map();
  writes = [];
  deletes = [];

  async getAllKeys() {
    return Array.from(this.values.keys());
  }

  async getAll() {
    return Array.from(this.values.values());
  }

  async set(key, value) {
    this.writes.push({ key, value });
    this.values.set(key, value);
  }

  async delete(key) {
    this.deletes.push(key);
    this.values.delete(key);
  }

  async clear() {
    this.values.clear();
  }
}

test("fresh cache reads update memory recency without rewriting screenshot blobs", async () => {
  const storage = new FakeStorage();
  const cache = new LRUCache(3, 1024 * 1024, storage);
  await cache.ready;

  const screenshot = "data:image/jpeg;base64," + "a".repeat(4096);
  cache.set(1, screenshot);
  assert.equal(storage.writes.length, 1);

  storage.writes = [];
  const cached = cache.getIfFresh(1, 60_000);

  assert.equal(cached?.data, screenshot);
  assert.equal(storage.writes.length, 0);
});

test("cache evicts the least recently used entry after a fresh read", async () => {
  const storage = new FakeStorage();
  const cache = new LRUCache(2, 1024 * 1024, storage);
  await cache.ready;

  cache.set(1, "data:image/jpeg;base64,one");
  cache.set(2, "data:image/jpeg;base64,two");

  assert.equal(cache.getIfFresh(1, 60_000)?.data, "data:image/jpeg;base64,one");
  cache.set(3, "data:image/jpeg;base64,three");

  assert.equal(cache.getIfFresh(1, 60_000)?.data, "data:image/jpeg;base64,one");
  assert.equal(cache.getIfFresh(2, 60_000), null);
  assert.equal(cache.getIfFresh(3, 60_000)?.data, "data:image/jpeg;base64,three");
});
