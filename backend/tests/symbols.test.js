const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSymbol } = require('../utils/symbols');

test('share classes use a dash for Yahoo but keep the dot for display', () => {
    assert.deepEqual(normalizeSymbol('BRK.B'), { display: 'BRK.B', yahoo: 'BRK-B', valid: true });
    assert.deepEqual(normalizeSymbol('brk.a'), { display: 'BRK.A', yahoo: 'BRK-A', valid: true });
    assert.equal(normalizeSymbol('BRK-B').yahoo, 'BRK-B');
});

test('exchange suffixes keep their dot', () => {
    assert.equal(normalizeSymbol('RELIANCE.NS').yahoo, 'RELIANCE.NS');
    assert.equal(normalizeSymbol('tcs.ns').yahoo, 'TCS.NS');
    assert.equal(normalizeSymbol('VOD.L').yahoo, 'VOD.L');
    assert.equal(normalizeSymbol('7203.T').yahoo, '7203.T');
    assert.equal(normalizeSymbol('SHOP.TO').yahoo, 'SHOP.TO');
});

test('crypto, indices and plain tickers', () => {
    assert.equal(normalizeSymbol('btc-usd').yahoo, 'BTC-USD');
    assert.equal(normalizeSymbol('^GSPC').yahoo, '^GSPC');
    assert.deepEqual(normalizeSymbol('  tsla '), { display: 'TSLA', yahoo: 'TSLA', valid: true });
    assert.equal(normalizeSymbol('M&M.NS').valid, true);
});

test('invalid input', () => {
    assert.equal(normalizeSymbol('').valid, false);
    assert.equal(normalizeSymbol(null).display, '');
    assert.equal(normalizeSymbol('AAPL MSFT').valid, false);
    assert.equal(normalizeSymbol('<script>').valid, false);
    assert.equal(normalizeSymbol('A'.repeat(25)).valid, false);
});
