// Formatting helpers shared by every page. All functions are pure and never
// throw: anything that is not a usable number/date renders as EMPTY ('—').

export const EMPTY = '—';

const LOCALE = 'en-US';
const formatterCache = new Map();

function getFormatter(kind, options) {
    const key = kind + JSON.stringify(options);
    let formatter = formatterCache.get(key);
    if (!formatter) {
        formatter = kind === 'date'
            ? new Intl.DateTimeFormat(LOCALE, options)
            : new Intl.NumberFormat(LOCALE, options);
        formatterCache.set(key, formatter);
    }
    return formatter;
}

const NUMERIC_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/**
 * Parse a number from a number, a plain numeric string ('509.22', '1,234.5')
 * or a percent string ('-1.35%', '+0.42%'). Returns null for anything else
 * ('N/A', '$3.2B', '', null, NaN, Infinity).
 */
export function toNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    let s = value.trim().replace(/,/g, '');
    if (s.endsWith('%')) s = s.slice(0, -1).trim();
    if (!NUMERIC_RE.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

function safeCurrency(currency) {
    const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
    if (!/^[A-Z]{3}$/.test(code)) return 'USD';
    try {
        getFormatter('number', { style: 'currency', currency: code });
        return code;
    } catch {
        return 'USD';
    }
}

// Units that compact notation uses, largest first.
const COMPACT_UNITS = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K']
];

function compactParts(abs) {
    for (const [size, suffix] of COMPACT_UNITS) {
        if (abs >= size) {
            const scaled = abs / size;
            // 3.78T, 45.68B, 512.4M: two decimals below 100, one above.
            const digits = scaled >= 100 ? 1 : 2;
            let rounded = Number(scaled.toFixed(digits));
            // 999.95K rounds to 1000K; bump to the next unit instead.
            if (rounded >= 1000 && size < 1e12) {
                return compactParts(rounded * size);
            }
            rounded = Number(rounded.toFixed(digits));
            return { scaled: rounded, suffix, digits };
        }
    }
    return { scaled: abs, suffix: '', digits: 2 };
}

/**
 * 3780000000000 -> '3.78T', 512430000 -> '512.4M', 1234 -> '1.23K', 999 -> '999'.
 */
export function formatCompact(value) {
    const n = toNumber(value);
    if (n === null) return EMPTY;
    const abs = Math.abs(n);
    const { scaled, suffix, digits } = compactParts(abs);
    const body = getFormatter('number', {
        minimumFractionDigits: 0,
        maximumFractionDigits: suffix ? digits : 2
    }).format(scaled);
    return (n < 0 ? '-' : '') + body + suffix;
}

/**
 * Currency with sensible precision:
 *  - default: 2 decimals; prices under 1 get up to 6 significant digits
 *    (DOGE 0.123456 -> '$0.123456', SHIB 0.00001234 -> '$0.00001234')
 *  - { compact: true }: '$3.78T', '$512.4M'
 *  - { decimals: n }: exactly n decimals
 * Unknown currency codes fall back to USD.
 */
export function formatCurrency(value, currency = 'USD', { compact = false, decimals } = {}) {
    const n = toNumber(value);
    if (n === null) return EMPTY;
    const code = safeCurrency(currency);

    if (compact && Math.abs(n) >= 1000) {
        const symbolOnly = getFormatter('number', {
            style: 'currency',
            currency: code,
            currencyDisplay: 'narrowSymbol',
            maximumFractionDigits: 0
        }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? '';
        const body = formatCompact(Math.abs(n));
        return (n < 0 ? '-' : '') + symbolOnly + body;
    }

    let minimumFractionDigits = 2;
    let maximumFractionDigits = 2;
    if (Number.isInteger(decimals) && decimals >= 0 && decimals <= 10) {
        minimumFractionDigits = decimals;
        maximumFractionDigits = decimals;
    } else {
        const abs = Math.abs(n);
        if (abs > 0 && abs < 1) {
            const magnitude = Math.floor(Math.log10(abs)); // -1 for 0.2, -5 for 0.00001
            maximumFractionDigits = Math.min(10, Math.max(2, 5 - magnitude));
        }
    }
    return getFormatter('number', {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits,
        maximumFractionDigits
    }).format(n);
}

/**
 * Percent from a percent NUMBER (1.35 means 1.35%). Accepts '-1.35%' strings.
 * formatPercent(1.2) -> '+1.20%', formatPercent(-3) -> '-3.00%', formatPercent(0) -> '0.00%'
 */
export function formatPercent(value, { sign = true, digits = 2 } = {}) {
    const n = toNumber(value);
    if (n === null) return EMPTY;
    const rounded = Number(n.toFixed(digits));
    const body = getFormatter('number', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    }).format(Math.abs(rounded));
    const prefix = rounded < 0 ? '-' : sign && rounded > 0 ? '+' : '';
    return `${prefix}${body}%`;
}

/**
 * Grouped number. formatNumber(1234.5) -> '1,234.5'; formatNumber(1234.5, 2) -> '1,234.50'.
 */
export function formatNumber(value, digits) {
    const n = toNumber(value);
    if (n === null) return EMPTY;
    const options = Number.isInteger(digits) && digits >= 0 && digits <= 10
        ? { minimumFractionDigits: digits, maximumFractionDigits: digits }
        : { maximumFractionDigits: 2 };
    return getFormatter('number', options).format(n);
}

/** Parse Date | ISO string | 'YYYY-MM-DD' (as a LOCAL date) | epoch ms. */
export function toDate(dateLike) {
    if (dateLike instanceof Date) return Number.isNaN(dateLike.getTime()) ? null : dateLike;
    if (typeof dateLike === 'number') {
        const d = new Date(dateLike);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof dateLike === 'string' && dateLike.trim()) {
        const s = dateLike.trim();
        const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
        const d = dateOnly
            ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
            : new Date(s);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
}

const DATE_STYLES = {
    short: { month: 'short', day: 'numeric' },                 // Mar 4
    medium: { month: 'short', day: 'numeric', year: 'numeric' }, // Mar 4, 2026
    long: { month: 'long', day: 'numeric', year: 'numeric' },    // March 4, 2026
    month: { month: 'short', year: '2-digit' },                  // Mar 26 (see formatDate)
    time: { hour: 'numeric', minute: '2-digit' }                 // 4:05 PM
};

/**
 * formatDate(d, 'short') -> 'Mar 4', 'medium' -> 'Mar 4, 2026',
 * 'long' -> 'March 4, 2026', 'month' -> "Mar '26", 'time' -> '4:05 PM'.
 */
export function formatDate(dateLike, style = 'medium') {
    const d = toDate(dateLike);
    if (!d) return EMPTY;
    const options = DATE_STYLES[style] || DATE_STYLES.medium;
    if (style === 'month') {
        const parts = getFormatter('date', options).formatToParts(d);
        const month = parts.find((p) => p.type === 'month')?.value ?? '';
        const year = parts.find((p) => p.type === 'year')?.value ?? '';
        return `${month} '${year}`;
    }
    return getFormatter('date', options).format(d);
}

/** '5m ago', '3h ago', '2d ago', then a medium date. */
export function timeAgo(dateLike, now = new Date()) {
    const d = toDate(dateLike);
    if (!d) return EMPTY;
    const seconds = Math.round((now.getTime() - d.getTime()) / 1000);
    if (seconds < 0) return formatDate(d, 'medium');
    if (seconds < 45) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(d, 'medium');
}

export function getGreeting(date = new Date()) {
    const d = toDate(date) || new Date();
    const h = d.getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    return 'Good evening';
}

const NY_PARTS = { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' };

/**
 * US equity session from New York time (exchange holidays not included):
 * pre 4:00-9:30, open 9:30-16:00, after 16:00-20:00, Mon-Fri; otherwise closed.
 * Returns { state: 'open'|'pre'|'after'|'closed', label, detail }.
 */
export function marketStatus(now = new Date()) {
    const d = toDate(now) || new Date();
    const parts = getFormatter('date', NY_PARTS).formatToParts(d);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const weekday = get('weekday');
    const minutes = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
    const weekend = weekday === 'Sat' || weekday === 'Sun';

    if (!weekend && minutes >= 570 && minutes < 960) {
        return { state: 'open', label: 'Market open', detail: 'US markets close at 4:00 PM ET' };
    }
    if (!weekend && minutes >= 240 && minutes < 570) {
        return { state: 'pre', label: 'Pre-market', detail: 'US markets open at 9:30 AM ET' };
    }
    if (!weekend && minutes >= 960 && minutes < 1200) {
        return { state: 'after', label: 'After hours', detail: 'After-hours trading until 8:00 PM ET' };
    }
    return {
        state: 'closed',
        label: 'Market closed',
        detail: weekend || (weekday === 'Fri' && minutes >= 1200)
            ? 'US markets open Monday 9:30 AM ET'
            : 'US markets open at 9:30 AM ET'
    };
}

const PALETTE_SIZE = 7; // chart-8 is the neutral "other" slot; avatars skip it

/** Deterministic palette color for a symbol: 'var(--sc-chart-N)'. */
export function symbolColor(symbol) {
    const s = String(symbol || '').toUpperCase();
    let hash = 0;
    for (let i = 0; i < s.length; i += 1) {
        hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    }
    return `var(--sc-chart-${(hash % PALETTE_SIZE) + 1})`;
}

/** 'BTC-USD' -> 'BTC', 'RELIANCE.NS' -> 'RELIANCE', '^GSPC' -> 'GSPC', 'BRK-B' -> 'BRK'. */
export function baseSymbol(symbol) {
    const s = String(symbol || '').toUpperCase().replace(/^\^/, '');
    return s.split(/[-.=]/)[0] || s;
}
