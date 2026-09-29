const test = require('node:test');
const assert = require('node:assert/strict');
const ind = require('../utils/indicators');

const close = (actual, expected, tolerance = 0.01) => {
    assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`);
};

test('sma averages the last N values', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    assert.equal(ind.sma(values, 5), 8);
    assert.equal(ind.sma(values, 10), 5.5);
    assert.equal(ind.sma(values, 1), 10);
    assert.equal(ind.sma(values, 11), null);
    assert.equal(ind.sma([], 3), null);
});

// Worked example from StockCharts ChartSchool ("Relative Strength Index"), 14-day Wilder RSI
const STOCKCHARTS_CLOSES = [
    44.3389, 44.0902, 44.1497, 43.6124, 44.3278, 44.8264, 45.0955, 45.4245, 45.8433, 46.0826,
    45.8931, 46.0328, 45.6140, 46.2820, 46.2820, 46.0028, 46.0328, 46.4116, 46.2222, 45.6439,
    46.2122, 46.2521, 45.7137, 46.4515, 45.7835, 45.3548, 44.0288, 44.1783, 44.2181, 44.5672,
    43.4205, 42.6628, 43.1314
];
const STOCKCHARTS_RSI = [
    70.53, 66.32, 66.55, 69.41, 66.36, 57.97, 62.93, 63.26, 56.06, 62.38,
    54.71, 50.42, 39.99, 41.46, 41.87, 45.46, 37.30, 33.08, 37.77
];

test('Wilder RSI matches the StockCharts worked example', () => {
    const series = ind.rsiWilderSeries(STOCKCHARTS_CLOSES, 14);
    assert.equal(series.slice(0, 14).every((v) => v === null), true, 'no RSI before 14 changes');
    const computed = series.slice(14);
    assert.equal(computed.length, STOCKCHARTS_RSI.length);
    computed.forEach((value, i) => close(value, STOCKCHARTS_RSI[i], 0.01));
    close(ind.rsiWilder(STOCKCHARTS_CLOSES, 14), 37.77, 0.01);
});

test('RSI edge cases', () => {
    const up = Array.from({ length: 20 }, (_, i) => 100 + i);
    const down = Array.from({ length: 20 }, (_, i) => 100 - i);
    assert.equal(ind.rsiWilder(up, 14), 100);
    assert.equal(ind.rsiWilder(down, 14), 0);
    assert.equal(ind.rsiWilder(Array(20).fill(50), 14), 50);
    assert.equal(ind.rsiWilder(up.slice(0, 14), 14), null, 'needs period + 1 values');
});

test('log returns', () => {
    const r = ind.logReturns([100, 110, 99]);
    assert.equal(r.length, 2);
    close(r[0], Math.log(1.1), 1e-12);
    close(r[1], Math.log(0.9), 1e-12);
    assert.deepEqual(ind.logReturns([100, 0, 50]), [], 'non-positive prices are skipped');
});

test('annualized volatility uses sample stdev and sqrt(periods)', () => {
    const returns = [0.01, -0.01, 0.01, -0.01];
    // sample stdev = sqrt(4 * 0.0001 / 3) = 0.0115470
    close(ind.annualizedVolatility(returns, 252), 0.0115470 * Math.sqrt(252) * 100, 1e-3);
    close(ind.annualizedVolatility(returns, 252), 18.33, 0.01);
    close(ind.annualizedVolatility(returns, 365), 22.06, 0.01);
    assert.equal(ind.annualizedVolatility([0.01], 252), null);
    assert.equal(ind.annualizedVolatility([0.02, 0.02, 0.02], 252), 0);
});

test('max drawdown finds the worst peak-to-trough fall', () => {
    close(ind.maxDrawdown([100, 120, 90, 130, 104]), -25, 1e-9);
    assert.equal(ind.maxDrawdown([1, 2, 3, 4]), 0);
    close(ind.maxDrawdown([50, 40, 30, 20]), -60, 1e-9);
    assert.equal(ind.maxDrawdown([]), null);
});

test('period and total returns', () => {
    const values = [100, 105, 110, 99];
    close(ind.periodReturn(values, 1), -10, 1e-9);
    close(ind.periodReturn(values, 2), (99 / 105 - 1) * 100, 1e-9);
    close(ind.periodReturn(values, 3), -1, 1e-9);
    assert.equal(ind.periodReturn(values, 4), null, 'not enough history');
    close(ind.totalReturn(values), -1, 1e-9);
    assert.equal(ind.totalReturn([100]), null);
});

test('rounding helpers', () => {
    assert.equal(ind.round(1.23456, 2), 1.23);
    assert.equal(ind.round(null), null);
    assert.equal(ind.roundPrice(509.2200012207031), 509.22);
    assert.equal(ind.roundPrice(0.0957412), 0.0957);
    assert.equal(ind.roundPrice(0.00001234567), 0.000012);
    assert.equal(ind.priceDecimals(null), 2);
    close(ind.percentDiff(110, 100), 10, 1e-9);
    assert.equal(ind.percentDiff(1, 0), null);
});
