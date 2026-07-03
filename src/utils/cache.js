const store = new Map();

function getCached(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Wraps an async producer with a TTL cache keyed by `key`. */
async function cached(key, ttlMs, producer) {
  const hit = getCached(key);
  if (hit !== undefined) return hit;
  const value = await producer();
  setCached(key, value, ttlMs);
  return value;
}

module.exports = { cached, getCached, setCached };
