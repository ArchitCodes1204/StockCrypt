// Small helpers shared by the Portfolio page files (Portfolio*.jsx).
import { EMPTY, baseSymbol, formatCurrency, toNumber } from '../utils/format';

export const TX_PAGE_SIZE = 10;
export const QUICK_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'BTC-USD'];

const qtyFormatters = new Map();

/** Share / unit counts: 10, 2.5, 0.05, 0.00012345 (never rounds a small crypto amount to 0). */
export function formatQty(value) {
    const n = toNumber(value);
    if (n === null) return EMPTY;
    const abs = Math.abs(n);
    const max = abs === 0 ? 0 : abs < 1 ? 8 : abs < 1000 ? 4 : 2;
    let formatter = qtyFormatters.get(max);
    if (!formatter) {
        formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: max });
        qtyFormatters.set(max, formatter);
    }
    return formatter.format(n);
}

/** '+$632.20', '-$71.40', '$0.00' */
export function formatSignedCurrency(value, currency = 'USD') {
    const n = toNumber(value);
    if (n === null) return EMPTY;
    const rounded = Math.abs(n) < 0.005 ? 0 : n;
    const body = formatCurrency(Math.abs(rounded), currency);
    if (rounded > 0) return `+${body}`;
    if (rounded < 0) return `-${body}`;
    return body;
}

/** 'gain' | 'loss' | '' for coloring a signed figure. */
export function toneOf(value) {
    const n = toNumber(value);
    if (n === null || Math.abs(n) < 0.005) return '';
    return n > 0 ? 'gain' : 'loss';
}

const isCryptoSymbol = (symbol) => /-(USD|USDT|USDC|EUR|GBP|BTC|ETH)$/i.test(String(symbol || ''));

/** 'shares' / 'share', or the coin ticker for crypto ('BTC'). */
export function unitLabel(symbol, quantity) {
    if (isCryptoSymbol(symbol)) return baseSymbol(symbol);
    return toNumber(quantity) === 1 ? 'share' : 'shares';
}

const pad = (n) => String(n).padStart(2, '0');

/** Today as a local 'YYYY-MM-DD' (value/max for date inputs). */
export function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Stored transaction dates are UTC midnight of the chosen day ('2026-09-17T00:00:00.000Z').
 * Returns that calendar day as 'YYYY-MM-DD' so it never shifts with the viewer's time zone.
 */
export function txDateKey(value) {
    if (typeof value === 'string') {
        const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
        if (match) return match[1];
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 'AAPL', 'BRK.B', 'BTC-USD', 'RELIANCE.NS', '^GSPC' */
export const SYMBOL_PATTERN = /^\^?[A-Z0-9]{1,10}(?:[.\-=][A-Z0-9]{1,6})?$/;

/**
 * quantity x price. The API's stored `totalAmount` is not recomputed when a transaction
 * is edited, so the page always derives the total itself.
 */
export function txTotal(tx) {
    const q = toNumber(tx?.quantity);
    const p = toNumber(tx?.pricePerShare);
    return q !== null && p !== null ? q * p : toNumber(tx?.totalAmount);
}

export const researchPath = (symbol) => `/research?symbol=${encodeURIComponent(symbol)}`;
