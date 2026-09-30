const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../services/analysisRules');

// Deterministic synthetic price series (260 trading days)
const series = (fn, length = 260) => Array.from({ length }, (_, i) => fn(i));
const uptrend = series((i) => 100 * Math.exp(0.002 * i + 0.01 * Math.sin(i)));
const downtrend = series((i) => 100 * Math.exp(-0.002 * i + 0.01 * Math.sin(i)));
const flat = series((i) => 100 + 0.1 * Math.sin(i));

const indicatorsFor = (closes, extra = {}) => rules.buildIndicators(closes, { spanDays: 365, ...extra });
const recommend = (closes) => rules.buildRecommendation({
    price: closes[closes.length - 1],
    currency: 'USD',
    ind: indicatorsFor(closes),
    historyPoints: closes.length
});

test('indicators bundle', () => {
    const ind = indicatorsFor(uptrend);
    assert.ok(ind.sma20 > ind.sma50 && ind.sma50 > ind.sma200, 'rising series has stacked averages');
    assert.equal(ind.goldenCross, true);
    assert.ok(ind.rsi14 >= 0 && ind.rsi14 <= 100);
    assert.ok(ind.volatility > 0);
    assert.ok(ind.maxDrawdown <= 0);
    assert.ok(ind.distanceFromHigh <= 0);
    assert.deepEqual(Object.keys(ind.returns), ['1w', '1m', '3m', '6m', '1y']);
    assert.ok(Math.abs(ind.returns['1y'] - (uptrend[259] / uptrend[0] - 1) * 100) < 0.01);
    assert.ok(Math.abs(ind.returns['3m'] - (uptrend[259] / uptrend[259 - 63] - 1) * 100) < 0.01);
});

test('short histories return nulls instead of throwing', () => {
    const recent = uptrend.slice(0, 30);
    const ind = rules.buildIndicators(recent, { spanDays: 42 });
    assert.equal(ind.sma50, null);
    assert.equal(ind.sma200, null);
    assert.equal(ind.goldenCross, false);
    assert.equal(ind.returns['1y'], null, 'not a full year of data');
    assert.equal(ind.returns['3m'], null);
    assert.notEqual(ind.returns['1m'], null);
    assert.equal(rules.buildIndicators([100], {}), null);
    assert.equal(rules.buildIndicators(uptrend.slice(0, 8), {}).volatility, null, 'too few returns to annualize');

    const rec = rules.buildRecommendation({ price: recent[29], ind, historyPoints: 30 });
    assert.equal(rec.confidence, 'Low');
    assert.equal(rec.signals.length, 6);
    assert.ok(rec.reasons.some((r) => r.includes('Only 30 days of price history')));

    const none = rules.buildRecommendation({ price: 10, ind: null, historyPoints: 0 });
    assert.equal(none.decision, 'HOLD');
    assert.equal(none.score, '0');
});

test('crypto uses calendar-day offsets for returns', () => {
    const closes = series((i) => 100 + i, 366);
    const ind = rules.buildIndicators(closes, { periodsPerYear: 365, spanDays: 365 });
    assert.ok(Math.abs(ind.returns['1w'] - (465 / 458 - 1) * 100) < 0.01, '7 days back');
    assert.ok(Math.abs(ind.returns['1m'] - (465 / 435 - 1) * 100) < 0.01, '30 days back');
});

test('uptrend is a BUY and the reasons quote real numbers', () => {
    const rec = recommend(uptrend);
    assert.equal(rec.decision, 'BUY');
    assert.equal(typeof rec.score, 'string', 'legacy string score');
    assert.ok(Number(rec.score) >= 3);
    const ind = indicatorsFor(uptrend);
    assert.ok(rec.reasons[0].includes(`$${ind.sma50.toFixed(2)}`), rec.reasons[0]);
    assert.ok(rec.signals.every((s) => ['positive', 'negative', 'neutral'].includes(s.verdict)));
});

test('downtrend is a SELL, flat series is a HOLD', () => {
    assert.equal(recommend(downtrend).decision, 'SELL');
    assert.equal(recommend(flat).decision, 'HOLD');
});

test('RSI extremes: overbought counts against, oversold in favour', () => {
    const base = indicatorsFor(flat);
    const hot = rules.buildSignals({ price: 100, ind: { ...base, rsi14: 80 } }).find((s) => s.label === 'RSI (14)');
    const cold = rules.buildSignals({ price: 100, ind: { ...base, rsi14: 20 } }).find((s) => s.label === 'RSI (14)');
    assert.equal(hot.points, -1);
    assert.equal(cold.points, 1);
});

test('risk score follows volatility and is higher for crypto-like swings', () => {
    const calm = series((i) => 100 * (1 + 0.005 * (i % 2 ? -1 : 1)));
    const wild = series((i) => 100 * (1 + 0.04 * (i % 2 ? -1 : 1)));
    const low = rules.buildRiskScore({ ind: indicatorsFor(calm), historyPoints: 260 });
    const high = rules.buildRiskScore({ ind: indicatorsFor(wild, { periodsPerYear: 365 }), historyPoints: 260, isCrypto: true });

    assert.ok(low.score <= 3, `calm series scored ${low.score}`);
    assert.equal(low.level, 'Low Risk');
    assert.ok(high.score >= 7, `wild series scored ${high.score}`);
    assert.equal(high.level, 'High Risk');
    assert.ok(low.factors[0].startsWith('Annualized volatility: '));
    assert.ok(Number.isInteger(low.score));

    const betaAdjusted = rules.buildRiskScore({ ind: indicatorsFor(calm), beta: 2, historyPoints: 260 });
    assert.equal(betaAdjusted.score, low.score + 1);
    assert.ok(betaAdjusted.factors.includes('Beta: 2.00'));

    const unknown = rules.buildRiskScore({ ind: null });
    assert.equal(unknown.score, 5);
});

test('outlook never promises returns', () => {
    const banned = /may see|potential (gain|return|growth)|expected to (rise|gain|grow|continue)|\d+\s*-\s*\d+%\s*(gain|return|growth)|will (rise|gain|grow)/i;
    for (const closes of [uptrend, downtrend, flat]) {
        const outlook = rules.buildOutlook({ price: closes[closes.length - 1], ind: indicatorsFor(closes) });
        assert.doesNotMatch(outlook.shortTerm, banned);
        assert.doesNotMatch(outlook.longTerm, banned);
        assert.match(outlook.longTerm, /Past trends do not predict future returns/);
        assert.ok(['High', 'Moderate', 'Low'].includes(outlook.confidence));
    }
    assert.equal(rules.buildOutlook({ price: 1, ind: null }).confidence, 'Low');
});

test('investment types keep the three legacy entries', () => {
    const ind = indicatorsFor(uptrend);
    const risk = rules.buildRiskScore({ ind, historyPoints: 260 });
    const types = rules.buildInvestmentTypes({ ind, risk, avgVolume: 25e6 });
    assert.deepEqual(types.map((t) => t.type), ['Short-term Traders', 'Long-term Investors', 'High-risk Takers']);
    types.forEach((t) => assert.ok(['High', 'Moderate', 'Low'].includes(t.suitability)));
    assert.match(types[0].reason, /\d+\.\d% annualized volatility/);
});

test('trend classification', () => {
    assert.equal(rules.classifyTrend(110, { sma50: 100, sma200: 90 }), 'bullish');
    assert.equal(rules.classifyTrend(80, { sma50: 90, sma200: 100 }), 'bearish');
    assert.equal(rules.classifyTrend(95, { sma50: 100, sma200: 90 }), 'sideways');
    assert.equal(rules.classifyTrend(10, { sma20: 9, sma50: 8, sma200: null }), 'bullish', 'short history uses 20/50');
    assert.equal(rules.classifyTrend(10, { sma20: 9, sma50: null, returns: { '1m': 2 } }, -3), 'bullish', 'under 50 days: price vs SMA20 + 1-month change');
    assert.equal(rules.classifyTrend(10, { sma20: 11, sma50: null, returns: { '1m': 2 } }, 1), 'sideways');
    assert.equal(rules.classifyTrend(10, null, -1.2), 'bearish', 'no history uses the day change');
});

test('screener technical rating', () => {
    assert.equal(rules.technicalRating({ price: 110, fiftyDayAverage: 100, twoHundredDayAverage: 90, changePercent: 2 }).rating, 'Strong Buy');
    assert.equal(rules.technicalRating({ price: 80, fiftyDayAverage: 90, twoHundredDayAverage: 100, changePercent: -2 }).rating, 'Strong Sell');
    assert.equal(rules.technicalRating({ price: 101, fiftyDayAverage: 100, twoHundredDayAverage: 105, changePercent: 0.2 }).rating, 'Sell');
    assert.equal(rules.technicalRating({ price: null }).rating, 'Neutral');
});
