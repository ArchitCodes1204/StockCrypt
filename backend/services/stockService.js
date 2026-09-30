const axios = require('axios');
const yahoo = require('./yahooClient');
const rules = require('./analysisRules');
const sentiment = require('./sentiment');
const { cached, get: cacheGet, set: cacheSet, has: cacheHas, del: cacheDel } = require('../utils/cache');
const { normalizeSymbol } = require('../utils/symbols');
const { NotFoundError, UpstreamError, BadRequestError } = require('../utils/errors');
const { isNum, round, roundPrice, priceDecimals } = require('../utils/indicators');
const fmt = require('../utils/format');

// Cache lifetimes in seconds (the Yahoo client caches each data source separately)
const TTL = { analysis: 90, screener: 300, screenerSample: 60, trending: 90 };

// Curated lists for the screener (Yahoo symbols)
const SCREENER_MARKETS = {
    stocks: [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'BRK-B', 'V', 'JNJ',
        'WMT', 'JPM', 'MA', 'PG', 'UNH', 'DIS', 'HD', 'VZ', 'KO', 'PFE',
        'INTC', 'CMCSA', 'PEP', 'CSCO', 'WFC', 'BAC', 'ADBE', 'CRM', 'NFLX', 'AMD'
    ],
    crypto: [
        'BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'XRP-USD', 'ADA-USD',
        'DOGE-USD', 'AVAX-USD', 'DOT-USD', 'LINK-USD', 'LTC-USD', 'TRX-USD'
    ]
};

const TRENDING_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN'];

// Search results we show: stocks, ETFs, crypto and indices (no futures, options or currencies)
const SEARCH_TYPES = new Set(['EQUITY', 'ETF', 'CRYPTOCURRENCY', 'INDEX']);

const num = (v) => (isNum(v) ? v : null);
const firstNum = (...values) => values.find(isNum) ?? null;
const mean = (values) => {
    const nums = values.filter(isNum);
    return nums.length ? nums.reduce((sum, v) => sum + v, 0) / nums.length : null;
};
const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
const fixedPrice = (value) => (isNum(value) ? value.toFixed(priceDecimals(value)) : 'N/A');

/**
 * Merge a live price into daily bars: replace the last bar when it is the same
 * trading day, or append a bar when the quote is newer than the cached chart.
 * Returns a new array; cached chart data is shared and must not be changed.
 */
function withLivePrice(points, price, dateKey) {
    if (!points.length || !isNum(price) || !dateKey) return points;
    const last = points[points.length - 1];
    if (dateKey === last.date) return [...points.slice(0, -1), { ...last, close: price, adjClose: price }];
    if (dateKey > last.date) {
        return [...points, { date: dateKey, open: null, high: null, low: null, close: price, adjClose: price, volume: null }];
    }
    return points;
}

/**
 * Build a quote row (same field names as Yahoo's v7 quote) from chart data.
 * Used when the quote endpoint fails or does not know the symbol.
 */
function quoteFromChart(chart) {
    const meta = chart.meta || {};
    const points = chart.points || [];
    const last = points[points.length - 1];
    const price = firstNum(meta.regularMarketPrice, last?.close);
    const liveDate = isNum(meta.regularMarketTime) ? yahoo.toDateKey(meta.regularMarketTime, meta.gmtoffset) : last?.date;

    // The previous close is the bar before the latest session
    let previousClose = null;
    if (last && liveDate > last.date) previousClose = last.close;
    else if (points.length >= 2) previousClose = points[points.length - 2].close;
    const change = isNum(price) && isNum(previousClose) ? price - previousClose : null;

    return {
        symbol: meta.symbol,
        longName: meta.longName,
        shortName: meta.shortName,
        currency: meta.currency,
        quoteType: meta.instrumentType,
        fullExchangeName: meta.fullExchangeName || meta.exchangeName,
        regularMarketPrice: price,
        regularMarketPreviousClose: previousClose,
        regularMarketChange: change,
        regularMarketChangePercent: firstNum(change !== null && previousClose ? (change / previousClose) * 100 : null, meta.regularMarketChangePercent),
        regularMarketOpen: last && liveDate === last.date ? last.open : null,
        regularMarketDayHigh: meta.regularMarketDayHigh,
        regularMarketDayLow: meta.regularMarketDayLow,
        regularMarketVolume: meta.regularMarketVolume,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
        regularMarketTime: meta.regularMarketTime,
        gmtOffSetMilliseconds: isNum(meta.gmtoffset) ? meta.gmtoffset * 1000 : 0,
        marketState: null
    };
}

/** The light quote returned by /api/stock/quote and used for portfolio prices */
function toLightQuote(display, row) {
    const price = num(row.regularMarketPrice);
    const previousClose = num(row.regularMarketPreviousClose);
    const change = firstNum(row.regularMarketChange, isNum(price) && isNum(previousClose) ? price - previousClose : null);
    const changePercent = firstNum(row.regularMarketChangePercent, isNum(change) && previousClose ? (change / previousClose) * 100 : null);
    const time = num(row.regularMarketTime);

    return {
        symbol: display,
        name: row.longName || row.shortName || display,
        price: roundPrice(price),
        change: round(change, priceDecimals(price)),
        changePercent: round(changePercent, 2),
        currency: row.currency || 'USD',
        marketState: row.marketState || null,
        quoteType: row.quoteType || null,
        previousClose: roundPrice(previousClose),
        exchange: row.fullExchangeName || row.exchange || null,
        marketTime: time ? new Date(time * 1000).toISOString() : null,
        // Trading day of the quote in the exchange's time zone
        marketDate: time ? yahoo.toDateKey(time, (row.gmtOffSetMilliseconds || 0) / 1000) : null
    };
}

function volatilityNote(volatility) {
    if (!isNum(volatility)) return 'Volatility unavailable (not enough price history)';
    const level = volatility < 20 ? 'Low' : volatility < 40 ? 'Moderate' : 'High';
    return `${level} volatility (${volatility.toFixed(1)}% annualized)`;
}

/** Side-by-side metrics and the legacy winner fields for /compare */
function buildComparison(stock1, stock2) {
    const s1 = stock1.symbol;
    const s2 = stock2.symbol;

    // Legacy fields
    const perf1 = parseFloat(stock1.yearPerformance?.percentChange);
    const perf2 = parseFloat(stock2.yearPerformance?.percentChange);
    let winner = 'Equal';
    if (isNum(perf1) && isNum(perf2)) winner = perf1 === perf2 ? 'Equal' : perf1 > perf2 ? s1 : s2;
    else if (isNum(perf1)) winner = s1;
    else if (isNum(perf2)) winner = s2;

    const risk1 = stock1.riskScore.score;
    const risk2 = stock2.riskScore.score;

    // BUY beats HOLD beats SELL; the same decision is split by the points score
    const rank = { BUY: 2, HOLD: 1, SELL: 0 };
    const d1 = rank[stock1.recommendation.decision];
    const d2 = rank[stock2.recommendation.decision];
    const score1 = parseFloat(stock1.recommendation.score);
    const score2 = parseFloat(stock2.recommendation.score);
    let stronger = 'Equal';
    if (d1 !== d2) stronger = d1 > d2 ? s1 : s2;
    else if (isNum(score1) && isNum(score2) && score1 !== score2) stronger = score1 > score2 ? s1 : s2;

    // Metrics table: better = which stock wins ('higher' or 'lower' is better), null when there is no winner
    const metric = (key, label, v1, v2, better, format) => {
        const a = num(v1);
        const b = num(v2);
        let result = null;
        if (better && a !== null && b !== null) {
            if (round(a, 4) === round(b, 4)) result = 'tie';
            else result = (better === 'higher' ? a > b : a < b) ? 'stock1' : 'stock2';
        }
        return { key, label, stock1: a, stock2: b, better: result, format };
    };
    const ind1 = stock1.indicators || {};
    const ind2 = stock2.indicators || {};
    const pe = (s) => {
        const v = parseFloat(s.companyOverview?.peRatio);
        return isNum(v) && v > 0 ? v : null;
    };
    const yieldPct = (s) => (isNum(s.companyOverview?.dividendYield) ? round(s.companyOverview.dividendYield * 100, 2) : null);

    const metrics = [
        metric('return1y', '1Y return', ind1.returns?.['1y'], ind2.returns?.['1y'], 'higher', 'percent'),
        metric('return3m', '3M return', ind1.returns?.['3m'], ind2.returns?.['3m'], 'higher', 'percent'),
        metric('volatility', 'Volatility (annualized)', ind1.volatility, ind2.volatility, 'lower', 'percent'),
        metric('maxDrawdown', 'Max drawdown (1Y)', ind1.maxDrawdown, ind2.maxDrawdown, 'higher', 'percent'),
        metric('riskScore', 'Risk score', risk1, risk2, 'lower', 'score'),
        metric('rsi14', 'RSI (14)', ind1.rsi14, ind2.rsi14, null, 'number'),
        metric('peRatio', 'P/E ratio', pe(stock1), pe(stock2), 'lower', 'number'),
        metric('marketCap', 'Market cap', stock1.companyOverview?.marketCapRaw, stock2.companyOverview?.marketCapRaw, null, 'compact'),
        metric('beta', 'Beta', stock1.companyOverview?.beta, stock2.companyOverview?.beta, 'lower', 'number'),
        metric('dividendYield', 'Dividend yield', yieldPct(stock1), yieldPct(stock2), 'higher', 'percent')
    ];

    return {
        performance: {
            winner,
            difference: isNum(perf1) && isNum(perf2) ? `${Math.abs(perf1 - perf2).toFixed(2)}%` : 'N/A'
        },
        risk: {
            lowerRisk: risk1 === risk2 ? 'Equal' : risk1 < risk2 ? s1 : s2,
            scoreDifference: Math.abs(risk1 - risk2)
        },
        recommendation: { stronger },
        metrics
    };
}

/** One screener row from a v7 quote row and a sparkline */
function screenerRow(symbol, quote, spark) {
    const meta = spark?.meta || {};
    const closes = spark?.closes || [];
    const price = firstNum(quote?.regularMarketPrice, meta.regularMarketPrice, closes[closes.length - 1]);
    const previous = firstNum(quote?.regularMarketPreviousClose, closes.length >= 2 ? closes[closes.length - 2] : null);
    const change = firstNum(quote?.regularMarketChange, isNum(price) && isNum(previous) ? price - previous : null);
    const changePercent = firstNum(quote?.regularMarketChangePercent, isNum(change) && previous ? (change / previous) * 100 : null);
    const fiftyDayAverage = num(quote?.fiftyDayAverage);
    const twoHundredDayAverage = num(quote?.twoHundredDayAverage);
    const { rating, points } = rules.technicalRating({ price, fiftyDayAverage, twoHundredDayAverage, changePercent });

    return {
        symbol,
        name: quote?.longName || quote?.shortName || meta.longName || meta.shortName || symbol,
        price: roundPrice(price),
        change: round(change, priceDecimals(price)),
        changePercent: round(changePercent, 2),
        volume: firstNum(quote?.regularMarketVolume, meta.regularMarketVolume),
        marketCap: num(quote?.marketCap),
        peRatio: round(num(quote?.trailingPE), 2),
        eps: round(num(quote?.epsTrailingTwelveMonths), 2),
        fiftyDayAverage: roundPrice(fiftyDayAverage),
        twoHundredDayAverage: roundPrice(twoHundredDayAverage),
        yearHigh: roundPrice(firstNum(quote?.fiftyTwoWeekHigh, meta.fiftyTwoWeekHigh)),
        yearLow: roundPrice(firstNum(quote?.fiftyTwoWeekLow, meta.fiftyTwoWeekLow)),
        technicalRating: rating,
        ratingScore: points,
        sparkline: closes.map(roundPrice),
        currency: quote?.currency || meta.currency || 'USD',
        quoteType: quote?.quoteType || meta.instrumentType || null,
        avgVolume: num(quote?.averageDailyVolume3Month),
        marketState: quote?.marketState || null,
        isSample: false
    };
}

class StockAnalysisService {
    /**
     * Full analysis of one symbol, built from live Yahoo Finance data (cached for 90 s).
     * @param {string} input symbol as typed by the user ("msft", "BRK.B", "BTC-USD")
     * @param {{ fresh?: boolean }} options fresh: true ignores cached data for this symbol
     */
    async analyzeStock(input, { fresh = false } = {}) {
        const { display, yahoo: yahooSymbol, valid } = normalizeSymbol(input);
        if (!display) throw new BadRequestError('Stock symbol is required');
        if (!valid) throw new NotFoundError(display);

        const key = `analysis:${display}`;
        if (fresh) {
            cacheDel(key);
            yahoo.invalidateSymbol(yahooSymbol);
        }
        return cached(key, TTL.analysis, () => this.buildAnalysis(display, yahooSymbol));
    }

    /** True if an analysis for this symbol would be served from the cache */
    isAnalysisCached(input) {
        return cacheHas(`analysis:${normalizeSymbol(input).display}`);
    }

    /**
     * Fetch quote, 1-year history, profile and news in parallel. One failing source
     * never breaks the analysis; only when neither a quote nor a chart is available
     * do we give up (404 for unknown symbols, 502 for provider problems).
     */
    async buildAnalysis(display, yahooSymbol) {
        const sources = ['quote', 'chart', 'profile', 'news'];
        const results = await Promise.allSettled([
            yahoo.getQuotes([yahooSymbol]).then((rows) => rows[yahooSymbol]),
            yahoo.getChart(yahooSymbol, '1y'),
            yahoo.getProfile(yahooSymbol),
            yahoo.getNews(yahooSymbol)
        ]);
        const [quoteResult, chartResult, profileResult, newsResult] = results;
        const valueOf = (r) => (r.status === 'fulfilled' ? r.value : null);

        let quote = valueOf(quoteResult);
        const chart = valueOf(chartResult);
        const hasQuote = isNum(quote?.regularMarketPrice);
        const hasChart = !!chart && (chart.points.length > 0 || isNum(chart.meta?.regularMarketPrice));

        results.forEach((r, i) => {
            if (r.status === 'rejected' && !(r.reason instanceof NotFoundError)) {
                console.warn(`${display}: ${sources[i]} unavailable - ${r.reason.message}`);
            }
        });

        if (!hasQuote && !hasChart) {
            const unknownToYahoo = (quoteResult.status === 'fulfilled' && !quote)
                || (chartResult.status === 'rejected' && chartResult.reason instanceof NotFoundError);
            if (unknownToYahoo) throw new NotFoundError(display);

            const fallback = await this.twelveDataFallback(display);
            if (fallback) return fallback;
            throw new UpstreamError(`Market data for "${display}" is unavailable right now. Please try again in a minute.`);
        }

        if (!hasQuote) quote = quoteFromChart(chart);

        return this.assembleAnalysis({
            display,
            quote,
            liveQuote: hasQuote,
            chart: hasChart ? chart : null,
            profile: valueOf(profileResult),
            newsItems: valueOf(newsResult) || [],
            dataSource: 'Yahoo Finance'
        });
    }

    /** Turn raw quote / chart / profile / news data into the analysis object */
    assembleAnalysis({ display, quote, liveQuote = true, chart, profile, newsItems, dataSource }) {
        const meta = chart?.meta || {};
        const currency = quote.currency || meta.currency || 'USD';
        const quoteType = quote.quoteType || meta.instrumentType || 'EQUITY';
        const isCrypto = quoteType === 'CRYPTOCURRENCY';

        // Price and the day's change
        const price = num(quote.regularMarketPrice);
        const previousClose = num(quote.regularMarketPreviousClose);
        const change = firstNum(quote.regularMarketChange, isNum(price) && isNum(previousClose) ? price - previousClose : null);
        const changePercent = firstNum(quote.regularMarketChangePercent, isNum(change) && previousClose ? (change / previousClose) * 100 : null);
        const decimals = priceDecimals(price);

        // Daily history (dividend-adjusted closes) with the live price as the last point
        const liveTime = firstNum(quote.regularMarketTime, meta.regularMarketTime);
        const offsetSeconds = isNum(quote.gmtOffSetMilliseconds) ? quote.gmtOffSetMilliseconds / 1000 : num(meta.gmtoffset) || 0;
        const liveDate = liveTime ? yahoo.toDateKey(liveTime, offsetSeconds) : null;
        const points = chart ? withLivePrice(chart.points, price, liveDate) : [];
        const closes = points.map((p) => p.adjClose);
        const spanDays = points.length >= 2 ? daysBetween(points[0].date, points[points.length - 1].date) : 0;
        const fullYear = spanDays >= rules.FULL_YEAR_DAYS;

        const indicators = rules.buildIndicators(closes, {
            periodsPerYear: isCrypto ? 365 : 252,
            spanDays,
            fiftyTwoWeekHigh: firstNum(quote.fiftyTwoWeekHigh, meta.fiftyTwoWeekHigh),
            fiftyTwoWeekLow: firstNum(quote.fiftyTwoWeekLow, meta.fiftyTwoWeekLow)
        });

        // Rounded once so the overview and the risk factors show the same beta
        const beta = round(num(profile?.beta), 2);
        // v7 reports dividendYield in percent; the profile and trailing yield are fractions
        const dividendYield = firstNum(
            profile?.dividendYield,
            isNum(quote.dividendYield) ? quote.dividendYield / 100 : null,
            quote.trailingAnnualDividendYield
        );
        const avgVolume = firstNum(quote.averageDailyVolume3Month, mean(points.slice(-63).map((p) => p.volume)));

        const recommendation = rules.buildRecommendation({ price, currency, ind: indicators, historyPoints: points.length });
        const riskScore = rules.buildRiskScore({ ind: indicators, beta, historyPoints: points.length, fullYear, isCrypto });

        // News: newest six headlines, each scored with the keyword model
        const news = newsItems.slice(0, 6).map((item) => {
            const scored = sentiment.scoreHeadline(item);
            return {
                title: item.title,
                link: item.link,
                summary: item.summary,
                publishedAt: item.publishedAt,
                publisher: 'Yahoo Finance',
                sentiment: scored.sentiment,
                keywords: scored.keywords
            };
        });
        const newsSentiment = news.length
            ? { ...sentiment.aggregate(news), note: 'Keyword-based sentiment of recent Yahoo Finance headlines', source: 'headlines' }
            : rules.priceActionSentiment({ ind: indicators, changePercent });

        const firstClose = points.length ? points[0].adjClose : null;
        const periodChange = points.length >= 2 ? (closes[closes.length - 1] / firstClose - 1) * 100 : null;
        const peRatio = num(quote.trailingPE);
        const marketCap = num(quote.marketCap);

        return {
            symbol: display,
            quoteType,
            currency,
            dataSource,
            companyOverview: {
                name: quote.longName || quote.shortName || meta.longName || meta.shortName || display,
                description: profile?.description || '',
                sector: profile?.sector || 'N/A',
                industry: profile?.industry || 'N/A',
                marketCap: fmt.formatCompactMoney(marketCap, currency),
                marketCapRaw: marketCap,
                peRatio: fmt.fixed(peRatio, 2),
                eps: round(num(quote.epsTrailingTwelveMonths), 2),
                beta,
                dividendYield: round(dividendYield, 4),
                exchange: quote.fullExchangeName || meta.fullExchangeName || meta.exchangeName || 'N/A',
                website: profile?.website || null,
                employees: num(profile?.employees)
            },
            currentMarketStatus: {
                currentPrice: fixedPrice(price),
                change: fmt.fixed(change, decimals),
                changePercent: fmt.signedPercent(changePercent),
                changePercentRaw: round(changePercent, 2),
                priceRaw: roundPrice(price),
                trend: rules.classifyTrend(price, indicators, changePercent),
                open: roundPrice(num(quote.regularMarketOpen)),
                previousClose: roundPrice(previousClose),
                dayHigh: roundPrice(num(quote.regularMarketDayHigh)),
                dayLow: roundPrice(num(quote.regularMarketDayLow)),
                volume: num(quote.regularMarketVolume),
                avgVolume: isNum(avgVolume) ? Math.round(avgVolume) : null,
                marketState: quote.marketState || null,
                lastUpdated: liveTime ? new Date(liveTime * 1000).toISOString() : new Date().toISOString()
            },
            priceHistory: points.map((p) => ({ date: p.date, close: roundPrice(p.adjClose) })),
            indicators,
            recommendation,
            yearPerformance: {
                percentChange: fmt.fixed(periodChange, 2),
                yearAgoPrice: fixedPrice(firstClose),
                currentPrice: fixedPrice(price),
                high: fixedPrice(firstNum(indicators?.fiftyTwoWeekHigh, quote.fiftyTwoWeekHigh, meta.fiftyTwoWeekHigh)),
                low: fixedPrice(firstNum(indicators?.fiftyTwoWeekLow, quote.fiftyTwoWeekLow, meta.fiftyTwoWeekLow)),
                volatilityNote: volatilityNote(indicators?.volatility),
                periodStart: points.length ? points[0].date : null,
                fullYear
            },
            growthForecast: rules.buildOutlook({ price, currency, ind: indicators }),
            riskScore,
            investmentType: rules.buildInvestmentTypes({ ind: indicators, risk: riskScore, avgVolume }),
            newsSentiment,
            news,
            dataAvailability: {
                quote: liveQuote,
                history: points.length > 0,
                profile: !!profile,
                news: news.length > 0
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Last resort when Yahoo is down: a price-only analysis from TwelveData.
     * Only used with a real (non-demo) TWELVE_DATA_API_KEY.
     */
    async twelveDataFallback(display) {
        const apiKey = process.env.TWELVE_DATA_API_KEY;
        if (!apiKey || apiKey === 'demo') return null;

        try {
            const res = await axios.get('https://api.twelvedata.com/quote', {
                params: { symbol: display, apikey: apiKey },
                timeout: 10000
            });
            const d = res.data || {};
            const n = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : null);
            if (d.status === 'error' || n(d.close) === null) return null;

            const quote = {
                longName: d.name,
                currency: d.currency,
                fullExchangeName: d.exchange,
                quoteType: 'EQUITY',
                regularMarketPrice: n(d.close),
                regularMarketChange: n(d.change),
                regularMarketChangePercent: n(d.percent_change),
                regularMarketPreviousClose: n(d.previous_close),
                regularMarketOpen: n(d.open),
                regularMarketDayHigh: n(d.high),
                regularMarketDayLow: n(d.low),
                regularMarketVolume: n(d.volume),
                averageDailyVolume3Month: n(d.average_volume),
                fiftyTwoWeekHigh: n(d.fifty_two_week?.high),
                fiftyTwoWeekLow: n(d.fifty_two_week?.low),
                regularMarketTime: n(d.timestamp),
                marketState: d.is_market_open ? 'REGULAR' : 'CLOSED'
            };
            return this.assembleAnalysis({ display, quote, chart: null, profile: null, newsItems: [], dataSource: 'TwelveData' });
        } catch (error) {
            console.warn(`TwelveData fallback failed for ${display}: ${error.message}`);
            return null;
        }
    }

    /**
     * Resolve light quotes for many symbols with one batched Yahoo call.
     * Symbols missing from the batch (or every symbol, if the batch fails) fall back to chart data.
     * @returns {Promise<Map<string, { quote?: object, error?: Error }>>} keyed by display symbol
     */
    async resolveQuotes(inputs) {
        const symbols = new Map();
        for (const input of inputs) {
            const n = normalizeSymbol(input);
            if (n.display) symbols.set(n.display, n);
        }

        let rows = {};
        const validSymbols = [...symbols.values()].filter((s) => s.valid);
        try {
            rows = await yahoo.getQuotes(validSymbols.map((s) => s.yahoo));
        } catch (error) {
            console.warn(`Quote batch failed, using chart data instead: ${error.message}`);
        }

        const out = new Map();
        await Promise.all([...symbols.values()].map(async ({ display, yahoo: yahooSymbol, valid }) => {
            if (!valid) {
                out.set(display, { error: new NotFoundError(display) });
                return;
            }
            const row = rows[yahooSymbol];
            if (isNum(row?.regularMarketPrice)) {
                out.set(display, { quote: toLightQuote(display, row) });
                return;
            }
            try {
                const chart = await yahoo.getChart(yahooSymbol, '1y');
                if (!chart.points.length && !isNum(chart.meta?.regularMarketPrice)) throw new NotFoundError(display);
                out.set(display, { quote: toLightQuote(display, quoteFromChart(chart)) });
            } catch (error) {
                out.set(display, { error: error instanceof NotFoundError ? new NotFoundError(display) : error });
            }
        }));
        return out;
    }

    /** Light quote for one symbol; throws NotFoundError (404) or UpstreamError (502) */
    async getQuote(input) {
        const { display } = normalizeSymbol(input);
        if (!display) throw new BadRequestError('Stock symbol is required');
        const result = (await this.resolveQuotes([display])).get(display);
        if (result.quote) return result.quote;
        throw result.error;
    }

    /**
     * Light quotes for many symbols (portfolio prices).
     * @returns {Promise<Object<string, object|null>>} keyed by display symbol; null when no price is available
     */
    async getQuotes(inputs) {
        const resolved = await this.resolveQuotes(inputs);
        const out = {};
        for (const [display, result] of resolved) {
            if (result.error && !(result.error instanceof NotFoundError)) {
                console.warn(`No price for ${display}: ${result.error.message}`);
            }
            out[display] = result.quote || null;
        }
        return out;
    }

    /**
     * Raw daily closes (split-adjusted, not dividend-adjusted) for valuing holdings,
     * with the latest live price merged in.
     * @returns {Promise<{ symbol: string, currency: string, points: { date: string, close: number }[] }>}
     */
    async getDailyCloses(input, liveQuote = null) {
        const { display, yahoo: yahooSymbol } = normalizeSymbol(input);
        const chart = await yahoo.getChart(yahooSymbol, '1y');
        const points = liveQuote ? withLivePrice(chart.points, liveQuote.price, liveQuote.marketDate) : chart.points;
        return {
            symbol: display,
            currency: chart.meta?.currency || 'USD',
            points: points.map((p) => ({ date: p.date, close: p.close }))
        };
    }

    /**
     * Compare two symbols. Legacy fields plus comparison.metrics.
     */
    async compareStocks(symbol1, symbol2) {
        const results = await Promise.allSettled([this.analyzeStock(symbol1), this.analyzeStock(symbol2)]);
        const failures = results.filter((r) => r.status === 'rejected').map((r) => r.reason);
        if (failures.length) {
            // An unknown symbol is the most useful error to report
            throw failures.find((e) => e instanceof NotFoundError) || failures[0];
        }

        const [stock1, stock2] = results.map((r) => r.value);
        return { stock1, stock2, comparison: buildComparison(stock1, stock2) };
    }

    /**
     * Screener rows for a market ("stocks" or "crypto"): one batched quote call plus
     * sparklines, cached for 5 minutes. If Yahoo fails completely, clearly labelled
     * sample rows (isSample: true) are returned instead.
     */
    async getScreenerStocks(market = 'stocks') {
        const symbols = SCREENER_MARKETS[market];
        if (!symbols) throw new BadRequestError('market must be "stocks" or "crypto"');

        const sample = cacheGet(`screener:${market}:sample`);
        if (sample) return sample;

        try {
            return await cached(`screener:${market}`, TTL.screener, () => this.buildScreener(symbols));
        } catch (error) {
            console.warn(`Screener (${market}) is showing SAMPLE data because Yahoo Finance failed: ${error.message}`);
            const rows = this.getMockScreenerData(symbols);
            cacheSet(`screener:${market}:sample`, rows, TTL.screenerSample);
            return rows;
        }
    }

    async buildScreener(symbols) {
        const [quotesResult, sparkResult] = await Promise.allSettled([
            yahoo.getQuotes(symbols),
            yahoo.getSpark(symbols, '1mo')
        ]);
        const quotes = quotesResult.status === 'fulfilled' ? quotesResult.value : {};
        const sparks = sparkResult.status === 'fulfilled' ? sparkResult.value : {};
        if (quotesResult.status === 'rejected') console.warn(`Screener quotes failed: ${quotesResult.reason.message}`);
        if (sparkResult.status === 'rejected') console.warn(`Screener sparklines failed: ${sparkResult.reason.message}`);

        const rows = symbols.map((symbol) => screenerRow(symbol, quotes[symbol], sparks[symbol]));
        if (!rows.some((row) => isNum(row.price))) {
            throw new UpstreamError('Yahoo Finance returned no screener prices');
        }
        return rows;
    }

    /** Randomly generated rows, only used when Yahoo is unreachable (always isSample: true) */
    getMockScreenerData(symbols) {
        const ratings = ['Strong Buy', 'Buy', 'Neutral', 'Sell', 'Strong Sell'];
        return symbols.map((symbol) => {
            const price = Math.random() * 500 + 50;
            const sparkline = [price];
            for (let i = 1; i < 21; i++) sparkline.unshift(sparkline[0] * (1 + (Math.random() - 0.5) * 0.04));
            return {
                symbol,
                name: `${symbol} (sample)`,
                price: round(price, 2),
                change: round((Math.random() - 0.5) * 10, 2),
                changePercent: round((Math.random() - 0.5) * 5, 2),
                volume: Math.floor(Math.random() * 100000000),
                marketCap: Math.floor(Math.random() * 1000000000000),
                peRatio: round(Math.random() * 50 + 10, 2),
                eps: round(Math.random() * 10, 2),
                fiftyDayAverage: round(price * (0.9 + Math.random() * 0.2), 2),
                twoHundredDayAverage: round(price * (0.85 + Math.random() * 0.3), 2),
                yearHigh: round(price * 1.2, 2),
                yearLow: round(price * 0.7, 2),
                technicalRating: ratings[Math.floor(Math.random() * ratings.length)],
                sparkline: sparkline.map((v) => round(v, 2)),
                currency: 'USD',
                isSample: true
            };
        });
    }

    /**
     * Quick signals for a few popular stocks (legacy shape plus changePercentRaw and sparkline).
     */
    async getTrending() {
        try {
            return await cached('trending', TTL.trending, async () => {
                // Fetch all five quotes in one call first; the analyses below reuse them
                await yahoo.getQuotes(TRENDING_SYMBOLS).catch(() => {});
                const results = await Promise.allSettled(TRENDING_SYMBOLS.map((symbol) => this.analyzeStock(symbol)));

                const rows = results
                    .filter((r) => r.status === 'fulfilled')
                    .map(({ value: a }) => ({
                        symbol: a.symbol,
                        name: a.companyOverview.name,
                        price: a.currentMarketStatus.currentPrice,
                        change: a.currentMarketStatus.changePercent,
                        trend: a.currentMarketStatus.trend,
                        recommendation: a.recommendation.decision,
                        riskScore: a.riskScore.score,
                        changePercentRaw: a.currentMarketStatus.changePercentRaw,
                        sparkline: a.priceHistory.slice(-30).map((p) => p.close),
                        currency: a.currency
                    }));

                if (!rows.length) throw new UpstreamError('No trending data available');
                return rows;
            });
        } catch (error) {
            console.warn(`Trending stocks unavailable: ${error.message}`);
            return [];
        }
    }

    /** Symbol autocomplete: up to 8 stocks, ETFs, crypto or indices */
    async searchSymbols(query) {
        const q = String(query || '').trim();
        if (!q) return [];

        const matches = await yahoo.search(q);
        return matches
            .filter((m) => m.symbol && SEARCH_TYPES.has(m.quoteType))
            .slice(0, 8)
            .map((m) => ({
                symbol: m.symbol,
                name: m.longname || m.shortname || m.symbol,
                exchange: m.exchDisp || m.exchange || '',
                type: m.quoteType,
                typeLabel: m.typeDisp || m.quoteType
            }));
    }
}

const service = new StockAnalysisService();

// Pure helpers, exported for tests
service.helpers = { withLivePrice, quoteFromChart, toLightQuote, buildComparison, screenerRow };
service.SCREENER_MARKETS = SCREENER_MARKETS;

module.exports = service;
