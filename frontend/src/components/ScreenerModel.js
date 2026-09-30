// Screener data helpers: market list, technical ratings, row normalisation,
// filtering and sorting. Pure functions only (no React).
import { ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, Minus } from 'lucide-react';
import { toNumber } from '../utils/format';

export const MARKETS = {
    stocks: { label: 'Stocks', noun: 'stocks', subtitle: 'Thirty large-cap US stocks with live Yahoo Finance quotes, a one-month trend and a rule-based technical rating.' },
    crypto: { label: 'Crypto', noun: 'coins', subtitle: 'Twelve major cryptocurrencies with live Yahoo Finance quotes, a one-month trend and a rule-based technical rating.' }
};

export const RATINGS = [
    { value: 'Strong Buy', slug: 'strong-buy', tone: 'gain', icon: ChevronsUp, order: 2 },
    { value: 'Buy', slug: 'buy', tone: 'gain', icon: ChevronUp, order: 1 },
    { value: 'Neutral', slug: 'neutral', tone: 'neutral', icon: Minus, order: 0 },
    { value: 'Sell', slug: 'sell', tone: 'loss', icon: ChevronDown, order: -1 },
    { value: 'Strong Sell', slug: 'strong-sell', tone: 'loss', icon: ChevronsDown, order: -2 }
];

const NEUTRAL = RATINGS[2];

export function ratingInfo(label) {
    return RATINGS.find((r) => r.value === label) || NEUTRAL;
}

/** Plain-language reason for a row's rating (same rules as the backend). */
export function ratingReason(row) {
    const parts = [];
    if (row.price !== null && row.fiftyDayAverage !== null) {
        parts.push(`price ${row.price > row.fiftyDayAverage ? 'above' : 'below'} its 50-day average`);
    }
    if (row.price !== null && row.twoHundredDayAverage !== null) {
        parts.push(`${row.price > row.twoHundredDayAverage ? 'above' : 'below'} its 200-day average`);
    }
    if (row.fiftyDayAverage !== null && row.twoHundredDayAverage !== null) {
        parts.push(`50-day ${row.fiftyDayAverage > row.twoHundredDayAverage ? 'above' : 'below'} 200-day`);
    }
    if (row.changePercent !== null && Math.abs(row.changePercent) > 1) {
        parts.push(`${row.changePercent > 0 ? 'up' : 'down'} more than 1% today`);
    }
    const text = parts.join(', ');
    return text ? `${row.technicalRating}: ${text}` : row.technicalRating;
}

const NUMERIC = ['price', 'change', 'changePercent', 'volume', 'avgVolume', 'marketCap', 'peRatio', 'eps',
    'fiftyDayAverage', 'twoHundredDayAverage', 'yearHigh', 'yearLow', 'ratingScore'];

/** Numbers parsed, 1M return and 52-week position added. */
export function normalizeRows(list) {
    return (Array.isArray(list) ? list : []).filter((r) => r && r.symbol).map((raw) => {
        const row = { ...raw, symbol: String(raw.symbol).toUpperCase(), name: raw.name || raw.symbol };
        NUMERIC.forEach((key) => { row[key] = toNumber(raw[key]); });
        const spark = (Array.isArray(raw.sparkline) ? raw.sparkline : []).map(toNumber).filter((v) => v !== null);
        row.sparkline = spark;
        row.month = spark.length >= 2 && spark[0] ? ((spark[spark.length - 1] - spark[0]) / spark[0]) * 100 : null;
        row.rangePos = row.price !== null && row.yearHigh !== null && row.yearLow !== null && row.yearHigh > row.yearLow
            ? Math.min(1, Math.max(0, (row.price - row.yearLow) / (row.yearHigh - row.yearLow)))
            : null;
        row.rating = ratingInfo(raw.technicalRating);
        row.technicalRating = row.rating.value;
        row.ratingSort = row.ratingScore ?? row.rating.order;
        // Yahoo reports crypto volume in the quote currency already; stock volume is in shares.
        const crypto = String(raw.quoteType || '').toUpperCase() === 'CRYPTOCURRENCY';
        row.traded = crypto ? row.volume : row.price !== null && row.volume !== null ? row.price * row.volume : null;
        return row;
    });
}

export function filterRows(rows, query, rating) {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (rating === 'all' || r.technicalRating === rating)
        && (!q || r.symbol.toLowerCase().includes(q) || String(r.name).toLowerCase().includes(q)));
}

export function searchRows(rows, query) {
    return filterRows(rows, query, 'all');
}

const SORT_FIELD = { rating: 'ratingSort' };

/** Sort by a column; missing values always go last. */
export function sortRows(rows, key, dir) {
    const field = SORT_FIELD[key] || key;
    const sign = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
        const x = a[field];
        const y = b[field];
        const xMissing = x === null || x === undefined;
        const yMissing = y === null || y === undefined;
        if (xMissing || yMissing) return xMissing === yMissing ? 0 : xMissing ? 1 : -1;
        if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y)) * sign;
        return (x - y) * sign;
    });
}

export const DEFAULT_SORT = { key: 'marketCap', dir: 'desc' };

// Columns that only make sense for one market.
export const STOCK_ONLY = ['peRatio', 'eps'];
export const CRYPTO_ONLY = ['rangePos'];

export const SORT_OPTIONS = [
    { value: 'marketCap', label: 'Market cap' },
    { value: 'changePercent', label: 'Change today' },
    { value: 'month', label: '1M return' },
    { value: 'volume', label: 'Volume' },
    { value: 'price', label: 'Price' },
    { value: 'rating', label: 'Technical rating' },
    { value: 'symbol', label: 'Symbol' },
    { value: 'peRatio', label: 'P/E ratio' },
    { value: 'rangePos', label: '52-week position' }
];

export function sortableFor(market) {
    return SORT_OPTIONS.filter((o) => (market === 'crypto' ? !STOCK_ONLY.includes(o.value) : !CRYPTO_ONLY.includes(o.value)));
}
