const test = require('node:test');
const assert = require('node:assert/strict');
const yahoo = require('../services/yahooClient');
const stockService = require('../services/stockService');

const { withLivePrice, buildComparison, quoteFromChart } = stockService.helpers;

test('RSS parsing handles CDATA, entities, HTML and bad links', () => {
    const xml = `<?xml version="1.0"?><rss><channel>
        <item>
            <title><![CDATA[Apple &amp; Google <b>rally</b>]]></title>
            <link>https://finance.yahoo.com/news/a.html</link>
            <description>Shares rose &#8217;sharply&#x2019; &lt;p&gt;today&lt;/p&gt;</description>
            <pubDate>Mon, 28 Sep 2026 20:48:09 +0000</pubDate>
        </item>
        <item>
            <title>Older headline</title>
            <link>javascript:alert(1)</link>
            <description></description>
            <pubDate>Sun, 27 Sep 2026 10:00:00 +0000</pubDate>
        </item>
        <item>
            <title>Newest headline</title>
            <link>https://example.com/n</link>
            <pubDate>Tue, 29 Sep 2026 08:00:00 +0000</pubDate>
        </item>
        <item><title>Older headline</title><pubDate>not a date</pubDate></item>
    </channel></rss>`;

    const items = yahoo.parseRss(xml);
    assert.equal(items.length, 3, 'duplicate titles are dropped');
    assert.equal(items[0].title, 'Newest headline', 'newest first');
    assert.equal(items[1].title, 'Apple & Google rally');
    assert.equal(items[1].summary, 'Shares rose ’sharply’ today');
    assert.equal(items[1].publishedAt, '2026-09-28T20:48:09.000Z');
    assert.equal(items[2].link, null, 'javascript: links are removed');
    assert.deepEqual(yahoo.parseRss(''), []);
});

test('chart parsing skips null closes, keeps one bar per day and uses the exchange time zone', () => {
    const t = (iso) => Date.parse(iso) / 1000;
    const chart = yahoo.parseChart({
        meta: { gmtoffset: 19800, regularMarketPrice: 105 }, // India, UTC+5:30
        timestamp: [t('2026-09-24T03:45:00Z'), t('2026-09-25T03:45:00Z'), t('2026-09-28T03:45:00Z'), t('2026-09-28T09:59:00Z')],
        indicators: {
            quote: [{ close: [100, null, 104, 105], open: [99, null, 103, 104], high: [101, null, 105, 106], low: [98, null, 102, 103], volume: [1, null, 2, 3] }],
            adjclose: [{ adjclose: [99, null, 104, 105] }]
        }
    });
    assert.deepEqual(chart.points.map((p) => p.date), ['2026-09-24', '2026-09-28']);
    assert.equal(chart.points[0].adjClose, 99);
    assert.equal(chart.points[1].close, 105, 'the later bar of the same day wins');
    assert.equal(yahoo.toDateKey(t('2026-09-28T20:00:00Z'), -14400), '2026-09-28');
    assert.equal(yahoo.toDateKey(t('2026-09-28T23:30:00Z'), 36000), '2026-09-29');
});

test('live price replaces or extends the last bar without changing the cached array', () => {
    const points = [
        { date: '2026-09-25', close: 10, adjClose: 9.9 },
        { date: '2026-09-28', close: 11, adjClose: 11 }
    ];
    const same = withLivePrice(points, 11.5, '2026-09-28');
    assert.equal(same.length, 2);
    assert.equal(same[1].close, 11.5);
    assert.equal(points[1].close, 11, 'input untouched');

    const newer = withLivePrice(points, 12, '2026-09-29');
    assert.equal(newer.length, 3);
    assert.deepEqual([newer[2].date, newer[2].adjClose], ['2026-09-29', 12]);

    assert.equal(withLivePrice(points, 12, '2026-09-01'), points, 'older quotes are ignored');
    assert.equal(withLivePrice(points, null, '2026-09-29'), points);
});

test('quote fallback from chart data uses the previous bar as previous close', () => {
    const t = Date.parse('2026-09-28T20:00:00Z') / 1000;
    const quote = quoteFromChart({
        meta: { regularMarketPrice: 110, regularMarketTime: t, gmtoffset: -14400, currency: 'USD', instrumentType: 'EQUITY' },
        points: [{ date: '2026-09-25', close: 100, open: 99 }, { date: '2026-09-28', close: 110, open: 101 }]
    });
    assert.equal(quote.regularMarketPreviousClose, 100);
    assert.equal(quote.regularMarketChange, 10);
    assert.equal(quote.regularMarketChangePercent, 10);
    assert.equal(quote.regularMarketOpen, 101);
});

test('comparison metrics pick winners in the right direction', () => {
    const stock = (symbol, overrides) => ({
        symbol,
        yearPerformance: { percentChange: overrides.perf },
        riskScore: { score: overrides.risk },
        recommendation: { decision: overrides.decision, score: overrides.score },
        companyOverview: { peRatio: overrides.pe, marketCapRaw: overrides.cap, beta: overrides.beta, dividendYield: overrides.dy },
        indicators: { returns: { '1y': Number(overrides.perf), '3m': overrides.r3m }, volatility: overrides.vol, maxDrawdown: overrides.dd, rsi14: 50 }
    });
    const a = stock('AAA', { perf: '12.00', risk: 4, decision: 'BUY', score: '3', pe: '25.00', cap: 2e12, beta: 1.1, dy: 0.005, r3m: 4, vol: 25, dd: -15 });
    const b = stock('BBB', { perf: '-3.50', risk: 6, decision: 'HOLD', score: '1', pe: 'N/A', cap: 1e12, beta: 1.4, dy: 0.02, r3m: 6, vol: 35, dd: -30 });

    const cmp = buildComparison(a, b);
    assert.deepEqual(cmp.performance, { winner: 'AAA', difference: '15.50%' });
    assert.deepEqual(cmp.risk, { lowerRisk: 'AAA', scoreDifference: 2 });
    assert.equal(cmp.recommendation.stronger, 'AAA');

    const byKey = Object.fromEntries(cmp.metrics.map((m) => [m.key, m]));
    assert.deepEqual(Object.keys(byKey), ['return1y', 'return3m', 'volatility', 'maxDrawdown', 'riskScore', 'rsi14', 'peRatio', 'marketCap', 'beta', 'dividendYield']);
    assert.equal(byKey.return1y.better, 'stock1');
    assert.equal(byKey.return3m.better, 'stock2');
    assert.equal(byKey.volatility.better, 'stock1', 'lower volatility wins');
    assert.equal(byKey.maxDrawdown.better, 'stock1', 'smaller drawdown wins');
    assert.equal(byKey.riskScore.better, 'stock1');
    assert.equal(byKey.rsi14.better, null, 'RSI has no winner');
    assert.equal(byKey.peRatio.stock2, null);
    assert.equal(byKey.peRatio.better, null, 'missing P/E means no winner');
    assert.equal(byKey.marketCap.better, null);
    assert.equal(byKey.dividendYield.stock2, 2, 'yield is shown in percent');
    assert.equal(byKey.dividendYield.better, 'stock2');

    const tie = buildComparison(a, a);
    assert.equal(tie.risk.lowerRisk, 'Equal');
    assert.equal(tie.recommendation.stronger, 'Equal');
    assert.equal(tie.metrics[0].better, 'tie');
});
