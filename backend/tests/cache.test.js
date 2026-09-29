const test = require('node:test');
const assert = require('node:assert/strict');
const cache = require('../utils/cache');

test.beforeEach(() => cache.flush());

test('concurrent misses share one call and later reads hit the cache', async () => {
    let calls = 0;
    const load = async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { value: 42 };
    };

    const [a, b, c] = await Promise.all([
        cache.cached('k', 60, load),
        cache.cached('k', 60, load),
        cache.cached('k', 60, load)
    ]);
    assert.equal(calls, 1);
    assert.equal(a, b);
    assert.equal(b, c);

    await cache.cached('k', 60, load);
    assert.equal(calls, 1);
    assert.equal(cache.has('k'), true);
});

test('del forces a new fetch', async () => {
    let calls = 0;
    const load = async () => ++calls;
    assert.equal(await cache.cached('x', 60, load), 1);
    cache.del('x');
    assert.equal(await cache.cached('x', 60, load), 2);
});

test('errors are not cached', async () => {
    let calls = 0;
    const failing = async () => {
        calls += 1;
        throw new Error('boom');
    };
    await assert.rejects(cache.cached('e', 60, failing), /boom/);
    await assert.rejects(cache.cached('e', 60, failing), /boom/);
    assert.equal(calls, 2);
});

test('null is a cacheable value', async () => {
    let calls = 0;
    const load = async () => { calls += 1; return null; };
    assert.equal(await cache.cached('n', 60, load), null);
    assert.equal(await cache.cached('n', 60, load), null);
    assert.equal(calls, 1);
});

test('dedupe shares in-flight work without storing it', async () => {
    let calls = 0;
    const load = async () => { calls += 1; return calls; };
    const [a, b] = await Promise.all([cache.dedupe('d', load), cache.dedupe('d', load)]);
    assert.equal(a, 1);
    assert.equal(b, 1);
    assert.equal(await cache.dedupe('d', load), 2);
});
