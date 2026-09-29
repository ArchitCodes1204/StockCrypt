const NodeCache = require('node-cache');

/**
 * Small caching helpers on top of node-cache.
 *
 * Values are stored by reference (useClones: false) so large objects such as a
 * full analysis are not deep-copied on every read. Treat anything returned from
 * the cache as read-only: copy it before changing it.
 */
const store = new NodeCache({ stdTTL: 300, checkperiod: 120, useClones: false });

// Promises for work that is currently running, keyed like the cache
const inFlight = new Map();

/**
 * Run fn() at most once at a time per key: concurrent callers with the same key
 * share the same promise. Nothing is stored after the promise settles.
 */
function dedupe(key, fn) {
    if (inFlight.has(key)) return inFlight.get(key);

    const promise = Promise.resolve()
        .then(fn)
        .finally(() => {
            if (inFlight.get(key) === promise) inFlight.delete(key);
        });

    inFlight.set(key, promise);
    return promise;
}

/**
 * Return the cached value for key, or compute it with fn(), cache it for
 * ttlSeconds and return it. Concurrent misses for the same key share one call
 * to fn(). Errors are not cached, so the next call tries again.
 */
function cached(key, ttlSeconds, fn) {
    const hit = store.get(key);
    if (hit !== undefined) return Promise.resolve(hit);
    if (inFlight.has(key)) return inFlight.get(key);

    const promise = Promise.resolve()
        .then(fn)
        .then((value) => {
            // Skip storing if the key was invalidated with del() while we were fetching
            if (inFlight.get(key) === promise && value !== undefined) {
                store.set(key, value, ttlSeconds);
            }
            return value;
        })
        .finally(() => {
            if (inFlight.get(key) === promise) inFlight.delete(key);
        });

    inFlight.set(key, promise);
    return promise;
}

/** Read a cached value (undefined when missing or expired) */
function get(key) {
    return store.get(key);
}

/** Store a value directly */
function set(key, value, ttlSeconds) {
    store.set(key, value, ttlSeconds);
}

/** True if a fresh value is cached for key */
function has(key) {
    return store.has(key);
}

/** Remove one or more keys, including any fetch for them that is still running */
function del(...keys) {
    for (const key of keys.flat()) {
        store.del(key);
        inFlight.delete(key);
    }
}

/** Empty the whole cache (used by tests) */
function flush() {
    store.flushAll();
    inFlight.clear();
}

module.exports = { cached, dedupe, get, set, has, del, flush };
