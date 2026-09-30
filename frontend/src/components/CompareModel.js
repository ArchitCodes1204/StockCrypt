// Compare page helpers: symbols, pair orientation, date alignment for the
// rebased chart and metric formatting. Pure functions only (no React).
import { formatCompact, formatCurrency, formatNumber, formatPercent, toNumber } from '../utils/format';

export const POPULAR_PAIRS = [
    ['AAPL', 'MSFT'],
    ['NVDA', 'AMD'],
    ['BTC-USD', 'ETH-USD'],
    ['KO', 'PEP'],
    ['TSLA', 'RIVN']
];

// Identity colours: the first symbol is always chart-1, the second chart-3.
export const SIDE_COLORS = ['var(--sc-chart-1)', 'var(--sc-chart-3)'];

const PEERS = {
    AAPL: 'MSFT', MSFT: 'GOOGL', GOOGL: 'META', META: 'GOOGL', AMZN: 'WMT', WMT: 'COST', NVDA: 'AMD', AMD: 'NVDA',
    INTC: 'AMD', TSLA: 'RIVN', RIVN: 'TSLA', KO: 'PEP', PEP: 'KO', JPM: 'BAC', BAC: 'JPM', V: 'MA', MA: 'V',
    NFLX: 'DIS', DIS: 'NFLX', 'BTC-USD': 'ETH-USD', 'ETH-USD': 'BTC-USD', 'SOL-USD': 'ETH-USD'
};

const BENCHMARKS = [
    { symbol: 'SPY', note: 'S&P 500 ETF' },
    { symbol: 'QQQ', note: 'Nasdaq-100 ETF' },
    { symbol: 'BTC-USD', note: 'Bitcoin' },
    { symbol: 'ETH-USD', note: 'Ethereum' }
];

export function cleanSymbol(value) {
    return String(value ?? '').trim().toUpperCase().slice(0, 20);
}

/** Order-insensitive key: swapping the two symbols reuses the loaded data. */
export function pairKey(a, b) {
    return [a, b].sort().join('|');
}

/** Up to four "compare with" ideas for a single symbol. */
export function suggestionsFor(symbol) {
    const list = [];
    const peer = PEERS[symbol];
    if (peer) list.push({ symbol: peer, note: 'Peer' });
    BENCHMARKS.forEach((b) => {
        if (b.symbol !== symbol && !list.some((x) => x.symbol === b.symbol)) list.push(b);
    });
    return list.slice(0, 4);
}

/** The symbol named in a backend 404 message: 'No data found for symbol "XYZ"'. */
export function symbolFromError(message) {
    const match = /"([^"]+)"/.exec(String(message || ''));
    return match ? cleanSymbol(match[1]) : null;
}

const flipBetter = { stock1: 'stock2', stock2: 'stock1' };

/** Returns the comparison with stock1 === first (flips it if the pair was loaded the other way round). */
export function orient(data, first) {
    if (!data?.stock1 || !data?.stock2) return null;
    if (cleanSymbol(data.stock1.symbol) === first || cleanSymbol(data.stock2.symbol) !== first) return data;
    const comparison = data.comparison || {};
    return {
        stock1: data.stock2,
        stock2: data.stock1,
        comparison: {
            ...comparison,
            metrics: (comparison.metrics || []).map((m) => ({
                ...m,
                stock1: m.stock2,
                stock2: m.stock1,
                better: flipBetter[m.better] || m.better
            }))
        }
    };
}

export const RANGES = [
    { label: '1M', value: '1m', months: 1 },
    { label: '3M', value: '3m', months: 3 },
    { label: '6M', value: '6m', months: 6 },
    { label: '1Y', value: '1y', months: 12 }
];

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/;

function isoDay(value) {
    const match = ISO_RE.exec(String(value || ''));
    return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function monthsBefore(iso, months) {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCMonth(date.getUTCMonth() - months);
    return date.toISOString().slice(0, 10);
}

function closesByDay(history) {
    const map = new Map();
    (Array.isArray(history) ? history : []).forEach((p) => {
        const day = isoDay(p?.date);
        const close = toNumber(p?.close);
        if (day && close !== null && close > 0) map.set(day, close);
    });
    return map;
}

/**
 * Both price histories on one date axis, rebased to 100 on the first day of
 * the window where both actually traded. Dates are the union of both
 * calendars (crypto trades every day, stocks only on weekdays). On a day a
 * symbol did not trade its line value is null (the chart connects across the
 * gap instead of drawing weekend steps), while `ia` / `ib` and the prices
 * carry the last close forward for the tooltip.
 */
export function alignSeries(historyA, historyB, months) {
    const a = closesByDay(historyA);
    const b = closesByDay(historyB);
    if (a.size < 2 || b.size < 2) return null;

    const days = [...new Set([...a.keys(), ...b.keys()])].sort();
    const lastDay = days[days.length - 1];
    const cutoff = monthsBefore(lastDay, months);

    const points = [];
    let lastA = null;
    let lastB = null;
    let baseA = null;
    let baseB = null;
    days.forEach((day) => {
        if (a.has(day)) lastA = a.get(day);
        if (b.has(day)) lastB = b.get(day);
        if (day < cutoff || lastA === null || lastB === null) return;
        if (baseA === null) {
            if (!a.has(day) || !b.has(day)) return;
            baseA = lastA;
            baseB = lastB;
        }
        const ia = (lastA / baseA) * 100;
        const ib = (lastB / baseB) * 100;
        points.push({
            date: day,
            a: a.has(day) ? ia : null,
            b: b.has(day) ? ib : null,
            ia,
            ib,
            priceA: lastA,
            priceB: lastB,
            closedA: !a.has(day),
            closedB: !b.has(day)
        });
    });
    if (points.length < 2) return null;

    const last = points[points.length - 1];
    const firstDay = points[0].date;
    // The window starts late when one symbol has a shorter history than the range.
    const lateStart = Date.parse(firstDay) - Date.parse(cutoff) > 6 * 86400000;
    return {
        points,
        returnA: last.ia - 100,
        returnB: last.ib - 100,
        lastA: [...points].reverse().find((p) => p.a !== null),
        lastB: [...points].reverse().find((p) => p.b !== null),
        start: firstDay,
        end: last.date,
        lateStart
    };
}

/** First available date of each calendar month after the first (x-axis ticks for long ranges). */
export function monthStarts(points) {
    const ticks = [];
    let previous = points[0]?.date.slice(0, 7);
    points.forEach((p) => {
        const month = p.date.slice(0, 7);
        if (month !== previous) ticks.push(p.date);
        previous = month;
    });
    return ticks;
}

/** Round-number axis ticks between lo and hi. */
export function niceTicks(lo, hi, count = 5) {
    const span = hi - lo;
    if (!(span > 0)) return [lo];
    const rough = span / (count - 1);
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= rough) || rough;
    const ticks = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
    return ticks;
}

const SIGNED = new Set(['return1y', 'return3m']);

export const METRIC_HINTS = {
    return1y: 'Higher is better',
    return3m: 'Higher is better',
    volatility: 'Lower is steadier',
    maxDrawdown: 'Smaller fall is better',
    riskScore: 'Lower is safer',
    rsi14: 'Over 70 overbought, under 30 oversold',
    peRatio: 'Lower is cheaper',
    marketCap: 'Size only, no winner',
    beta: 'Lower moves less with the market',
    dividendYield: 'Higher pays more'
};

export function formatMetric(metric, value, currency) {
    if (value === null || value === undefined) return '—';
    switch (metric.format) {
        case 'percent':
            return formatPercent(value, { sign: SIGNED.has(metric.key) });
        case 'currency':
            return formatCurrency(value, currency);
        case 'compact':
            return metric.key === 'marketCap' ? formatCurrency(value, currency, { compact: true }) : formatCompact(value);
        case 'score':
            return `${formatNumber(value, 0)}/10`;
        default:
            return formatNumber(value, 2);
    }
}

const TYPE_LABELS = { EQUITY: 'Stock', CRYPTOCURRENCY: 'Crypto', ETF: 'ETF', INDEX: 'Index', MUTUALFUND: 'Fund', CURRENCY: 'FX' };

export function typeLabel(quoteType) {
    return TYPE_LABELS[String(quoteType || '').toUpperCase()] || null;
}

/** Price, change and currency from an analysis object (legacy fields are strings). */
export function quoteOf(stock) {
    const status = stock?.currentMarketStatus || {};
    const price = toNumber(status.priceRaw) ?? toNumber(status.currentPrice);
    const change = toNumber(status.change);
    const changePercent = toNumber(status.changePercentRaw) ?? toNumber(status.changePercent);
    return { price, change, changePercent, currency: stock?.currency || 'USD' };
}
