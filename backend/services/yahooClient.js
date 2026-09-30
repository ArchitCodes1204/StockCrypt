const axios = require('axios');
const { cached, dedupe, get: cacheGet, set: cacheSet, del: cacheDel } = require('../utils/cache');
const { NotFoundError, UpstreamError } = require('../utils/errors');
const { isNum } = require('../utils/indicators');

/**
 * Thin client for the public Yahoo Finance endpoints.
 *
 * - Every request sends `User-Agent: Mozilla/5.0` (a full browser UA string gets HTTP 429).
 * - The v7 quote and v10 quoteSummary endpoints need a cookie + "crumb" pair. We fetch
 *   it once, keep it for an hour and refresh it once if Yahoo answers 401.
 * - Every response is cached, and identical requests that run at the same time share
 *   one upstream call.
 *
 * Symbols passed to this module must already be in Yahoo form (BRK-B, not BRK.B).
 */

const http = axios.create({
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
});

const QUERY1 = 'https://query1.finance.yahoo.com';
const QUERY2 = 'https://query2.finance.yahoo.com';

// Cache lifetimes in seconds
const TTL = {
    session: 60 * 60,
    quote: 90,
    chart: 20 * 60,
    profile: 24 * 60 * 60,
    news: 15 * 60,
    search: 10 * 60,
    spark: 10 * 60
};

// Set DEBUG_YAHOO=1 to log every upstream call (useful to check what is cached)
if (process.env.DEBUG_YAHOO) {
    const log = (config, status) => {
        const { crumb, ...params } = config.params || {};
        const took = Date.now() - (config.startedAt || Date.now());
        console.log(`[yahoo] ${status} ${config.url} ${JSON.stringify(params)} ${took}ms`);
    };
    http.interceptors.request.use((config) => {
        config.startedAt = Date.now();
        return config;
    });
    http.interceptors.response.use(
        (res) => { log(res.config, res.status); return res; },
        (err) => { if (err.config) log(err.config, err.response?.status || err.code); return Promise.reject(err); }
    );
}

const numOrNull = (v) => (isNum(v) ? v : null);

// Yahoo wraps many numbers as { raw, fmt }
const raw = (v) => (isNum(v) ? v : isNum(v?.raw) ? v.raw : null);

const chunk = (list, size) => {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
};

/** Calendar date (YYYY-MM-DD) of a Unix timestamp in the exchange's time zone */
function toDateKey(epochSeconds, gmtOffsetSeconds = 0) {
    return new Date((epochSeconds + (gmtOffsetSeconds || 0)) * 1000).toISOString().slice(0, 10);
}

/** Wrap an axios error in an UpstreamError with a short, readable message */
function upstream(err, what) {
    if (err instanceof NotFoundError || err instanceof UpstreamError) return err;
    let reason = err.code || err.message;
    if (err.response) reason = `HTTP ${err.response.status}`;
    else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') reason = 'timed out';
    return new UpstreamError(`Yahoo Finance ${what} request failed (${reason})`, err);
}

/**
 * Run one async job per batch. Batches that fail are skipped; if every batch
 * fails the first error is thrown.
 */
async function runBatches(batches, job) {
    const results = await Promise.allSettled(batches.map(job));
    const failures = results.filter((r) => r.status === 'rejected');
    if (batches.length && failures.length === batches.length) throw failures[0].reason;
}

// ---------------------------------------------------------------------------
// Cookie + crumb session
// ---------------------------------------------------------------------------

let session = null; // { cookie, crumb, expiresAt }

async function createSession() {
    let cookie = '';
    try {
        // fc.yahoo.com answers 404, but the response sets the cookie Yahoo wants
        const res = await http.get('https://fc.yahoo.com', { maxRedirects: 0, validateStatus: () => true });
        cookie = (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
    } catch {
        // No cookie; the crumb request below will tell us if that is a problem
    }

    let res;
    try {
        res = await http.get(`${QUERY1}/v1/test/getcrumb`, {
            headers: cookie ? { Cookie: cookie } : {},
            responseType: 'text'
        });
    } catch (err) {
        throw upstream(err, 'crumb');
    }

    const crumb = String(res.data || '').trim();
    if (!crumb || crumb.length > 64 || /[\s<>{}]/.test(crumb)) {
        throw new UpstreamError('Yahoo Finance did not return a valid crumb');
    }
    return { cookie, crumb, expiresAt: Date.now() + TTL.session * 1000 };
}

async function getSession(forceRefresh = false) {
    if (!forceRefresh && session && session.expiresAt > Date.now()) return session;
    session = await dedupe('yahoo:session', createSession);
    return session;
}

/** GET an endpoint that needs the crumb; refreshes the crumb once on 401/403 */
async function authedGet(url, params = {}) {
    for (let attempt = 1; ; attempt++) {
        const { cookie, crumb } = await getSession(attempt > 1);
        try {
            return await http.get(url, {
                params: { ...params, crumb },
                headers: cookie ? { Cookie: cookie } : {}
            });
        } catch (err) {
            const status = err.response?.status;
            if (attempt === 1 && (status === 401 || status === 403)) continue;
            throw err;
        }
    }
}

// ---------------------------------------------------------------------------
// Quotes (v7, batched)
// ---------------------------------------------------------------------------

/**
 * Latest quotes for many symbols in as few calls as possible.
 * @param {string[]} symbols Yahoo symbols
 * @returns {Promise<Object<string, object|null>>} raw Yahoo quote rows by symbol; null means Yahoo does not know it
 */
async function getQuotes(symbols) {
    const wanted = [...new Set(symbols.filter(Boolean))];
    const result = {};
    const missing = [];

    for (const symbol of wanted) {
        const hit = cacheGet(`quote:${symbol}`);
        if (hit !== undefined) result[symbol] = hit;
        else missing.push(symbol);
    }

    await runBatches(chunk(missing, 50), async (batch) => {
        const rows = await dedupe(`quotes:${batch.join(',')}`, async () => {
            try {
                const res = await authedGet(`${QUERY1}/v7/finance/quote`, { symbols: batch.join(',') });
                return res.data?.quoteResponse?.result || [];
            } catch (err) {
                throw upstream(err, 'quote');
            }
        });

        const bySymbol = new Map(rows.map((row) => [String(row.symbol).toUpperCase(), row]));
        for (const symbol of batch) {
            const row = bySymbol.get(symbol) || null;
            cacheSet(`quote:${symbol}`, row, TTL.quote);
            result[symbol] = row;
        }
    });

    return result;
}

// ---------------------------------------------------------------------------
// Daily price history (v8 chart)
// ---------------------------------------------------------------------------

/**
 * Turn a chart result into { meta, points } where each point is
 * { date, open, high, low, close, adjClose, volume }, oldest first, without null closes.
 */
function parseChart(result) {
    const meta = result.meta || {};
    const offset = Number(meta.gmtoffset) || 0;
    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const adjclose = result.indicators?.adjclose?.[0]?.adjclose || [];
    const points = [];

    for (let i = 0; i < timestamps.length; i++) {
        const close = quote.close?.[i];
        if (!isNum(close)) continue; // Yahoo leaves gaps as null

        const point = {
            date: toDateKey(timestamps[i], offset),
            open: numOrNull(quote.open?.[i]),
            high: numOrNull(quote.high?.[i]),
            low: numOrNull(quote.low?.[i]),
            close,
            adjClose: isNum(adjclose[i]) ? adjclose[i] : close,
            volume: numOrNull(quote.volume?.[i])
        };

        // The live bar can share a date with the day's bar: keep the newest one
        if (points.length && points[points.length - 1].date === point.date) points[points.length - 1] = point;
        else points.push(point);
    }

    return { meta, points };
}

/** Daily bars for a symbol. Throws NotFoundError for unknown symbols. */
async function getChart(symbol, range = '1y') {
    return cached(`chart:${symbol}:${range}`, TTL.chart, async () => {
        let res;
        try {
            res = await http.get(`${QUERY1}/v8/finance/chart/${encodeURIComponent(symbol)}`, {
                params: { range, interval: '1d', includeAdjustedClose: true }
            });
        } catch (err) {
            if (err.response?.status === 404) throw new NotFoundError(symbol);
            throw upstream(err, 'chart');
        }

        const result = res.data?.chart?.result?.[0];
        if (!result) {
            if (res.data?.chart?.error) throw new NotFoundError(symbol);
            throw new UpstreamError('Yahoo Finance returned an empty chart');
        }
        return parseChart(result);
    });
}

// ---------------------------------------------------------------------------
// Sparklines (v7 spark, max 20 symbols per call)
// ---------------------------------------------------------------------------

/**
 * Recent daily closes for many symbols.
 * @returns {Promise<Object<string, { closes: number[], meta: object|null }>>}
 */
async function getSpark(symbols, range = '1mo') {
    const wanted = [...new Set(symbols.filter(Boolean))];
    const result = {};
    const missing = [];

    for (const symbol of wanted) {
        const hit = cacheGet(`spark:${symbol}:${range}`);
        if (hit !== undefined) result[symbol] = hit;
        else missing.push(symbol);
    }

    await runBatches(chunk(missing, 20), async (batch) => {
        const rows = await dedupe(`sparks:${range}:${batch.join(',')}`, async () => {
            try {
                const res = await http.get(`${QUERY1}/v7/finance/spark`, {
                    params: { symbols: batch.join(','), range, interval: '1d' }
                });
                return res.data?.spark?.result || [];
            } catch (err) {
                throw upstream(err, 'spark');
            }
        });

        const bySymbol = new Map(rows.map((row) => [String(row.symbol).toUpperCase(), row]));
        for (const symbol of batch) {
            const response = bySymbol.get(symbol)?.response?.[0];
            const entry = {
                closes: (response?.indicators?.quote?.[0]?.close || []).filter(isNum),
                meta: response?.meta || null
            };
            cacheSet(`spark:${symbol}:${range}`, entry, TTL.spark);
            result[symbol] = entry;
        }
    });

    return result;
}

// ---------------------------------------------------------------------------
// Company profile (v10 quoteSummary)
// ---------------------------------------------------------------------------

/**
 * Sector, description, beta, dividend yield...
 * Returns null when Yahoo has no profile (unknown symbol, some funds).
 */
async function getProfile(symbol) {
    return cached(`profile:${symbol}`, TTL.profile, async () => {
        let res;
        try {
            res = await authedGet(`${QUERY2}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`, {
                modules: 'assetProfile,summaryDetail,defaultKeyStatistics'
            });
        } catch (err) {
            if (err.response?.status === 404) return null;
            throw upstream(err, 'profile');
        }

        const data = res.data?.quoteSummary?.result?.[0];
        if (!data) return null;

        const asset = data.assetProfile || {};
        const summary = data.summaryDetail || {};
        const stats = data.defaultKeyStatistics || {};

        return {
            description: asset.longBusinessSummary || asset.description || '',
            sector: asset.sectorDisp || asset.sector || null,
            industry: asset.industryDisp || asset.industry || null,
            website: asset.website || null,
            employees: numOrNull(asset.fullTimeEmployees),
            // Funds report a 3-year beta instead of summaryDetail.beta
            beta: raw(summary.beta) ?? raw(stats.beta) ?? raw(stats.beta3Year),
            // Funds report "yield" instead of dividendYield (both are fractions)
            dividendYield: raw(summary.dividendYield) ?? raw(summary.yield) ?? raw(summary.trailingAnnualDividendYield)
        };
    });
}

// ---------------------------------------------------------------------------
// News (RSS)
// ---------------------------------------------------------------------------

const ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
    mdash: '—', ndash: '–', hellip: '…'
};

function decodeEntities(text) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
        if (code[0] === '#') {
            const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
            return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
        }
        return ENTITIES[code.toLowerCase()] ?? match;
    });
}

/** Text content of an RSS field: unwrap CDATA, decode entities, drop HTML tags */
function cleanText(value) {
    const unwrapped = String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    return decodeEntities(unwrapped)
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function readTag(block, name) {
    const match = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
    return match ? match[1] : '';
}

/**
 * Parse Yahoo's RSS feed into [{ title, link, summary, publishedAt }], newest first.
 */
function parseRss(xml) {
    const items = [];
    const seen = new Set();
    const itemPattern = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemPattern.exec(String(xml || '')))) {
        const block = match[1];
        const title = cleanText(readTag(block, 'title'));
        if (!title || seen.has(title.toLowerCase())) continue;
        seen.add(title.toLowerCase());

        const link = cleanText(readTag(block, 'link'));
        const published = new Date(cleanText(readTag(block, 'pubDate')));
        let summary = cleanText(readTag(block, 'description'));
        if (summary.length > 300) summary = `${summary.slice(0, 297).trimEnd()}...`;

        items.push({
            title,
            // Only pass on real web links (never javascript: or relative URLs)
            link: /^https?:\/\//i.test(link) ? link : null,
            summary,
            publishedAt: Number.isNaN(published.getTime()) ? null : published.toISOString()
        });
    }

    return items.sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
}

/** Recent headlines for a symbol (may be an empty list) */
async function getNews(symbol) {
    return cached(`news:${symbol}`, TTL.news, async () => {
        try {
            const res = await http.get('https://feeds.finance.yahoo.com/rss/2.0/headline', {
                params: { s: symbol, region: 'US', lang: 'en-US' },
                responseType: 'text'
            });
            return parseRss(res.data);
        } catch (err) {
            throw upstream(err, 'news');
        }
    });
}

// ---------------------------------------------------------------------------
// Symbol search
// ---------------------------------------------------------------------------

/** Raw Yahoo search matches for a query ([] for an empty query) */
async function search(query) {
    const q = String(query || '').trim().slice(0, 64);
    if (!q) return [];
    return cached(`search:${q.toLowerCase()}`, TTL.search, async () => {
        try {
            const res = await http.get(`${QUERY1}/v1/finance/search`, {
                params: { q, quotesCount: 12, newsCount: 0 }
            });
            return res.data?.quotes || [];
        } catch (err) {
            throw upstream(err, 'search');
        }
    });
}

/** Forget cached market data for one symbol so the next read goes to Yahoo (profile is kept) */
function invalidateSymbol(symbol) {
    cacheDel(
        `quote:${symbol}`,
        `quotes:${symbol}`,
        `news:${symbol}`,
        ...['1y', '1mo', '5d'].map((range) => `chart:${symbol}:${range}`)
    );
}

module.exports = {
    getQuotes,
    getChart,
    getSpark,
    getProfile,
    getNews,
    search,
    invalidateSymbol,
    // exported for tests
    parseChart,
    parseRss,
    toDateKey
};
