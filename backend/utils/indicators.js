/**
 * Technical indicator math. All functions are pure and work on plain arrays of
 * numbers ordered oldest -> newest. They return null instead of throwing when
 * there is not enough data.
 */

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Round to a fixed number of decimals (null stays null) */
function round(value, decimals = 2) {
    if (!isNum(value)) return null;
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

/** Decimals that keep a price readable: 2 for normal prices, more for sub-dollar assets */
function priceDecimals(value) {
    if (!isNum(value)) return 2;
    const abs = Math.abs(value);
    if (abs >= 1 || abs === 0) return 2;
    if (abs >= 0.01) return 4;
    return 6;
}

/** Round a price with priceDecimals() */
function roundPrice(value) {
    return isNum(value) ? round(value, priceDecimals(value)) : null;
}

/** Simple moving average of the last `period` values */
function sma(values, period) {
    if (!Array.isArray(values) || period <= 0 || values.length < period) return null;
    let sum = 0;
    for (let i = values.length - period; i < values.length; i++) sum += values[i];
    return sum / period;
}

/**
 * Wilder's RSI for every point of the series.
 * The first average gain/loss is a simple mean of the first `period` changes;
 * after that each average is smoothed: avg = (prevAvg * (period - 1) + current) / period.
 * Returns an array aligned with `values` (null until there are `period` changes).
 */
function rsiWilderSeries(values, period = 14) {
    const out = new Array(Array.isArray(values) ? values.length : 0).fill(null);
    if (!Array.isArray(values) || values.length < period + 1) return out;

    const toRsi = (gain, loss) => {
        if (loss === 0) return gain === 0 ? 50 : 100; // flat series is neutral
        return 100 - 100 / (1 + gain / loss);
    };

    let gain = 0;
    let loss = 0;
    for (let i = 1; i <= period; i++) {
        const diff = values[i] - values[i - 1];
        if (diff > 0) gain += diff;
        else loss -= diff;
    }
    let avgGain = gain / period;
    let avgLoss = loss / period;
    out[period] = toRsi(avgGain, avgLoss);

    for (let i = period + 1; i < values.length; i++) {
        const diff = values[i] - values[i - 1];
        avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
        out[i] = toRsi(avgGain, avgLoss);
    }
    return out;
}

/** Latest Wilder RSI value (null if fewer than period + 1 values) */
function rsiWilder(values, period = 14) {
    const series = rsiWilderSeries(values, period);
    return series.length ? series[series.length - 1] : null;
}

/** Daily log returns ln(p[i] / p[i-1]), skipping non-positive prices */
function logReturns(values) {
    const out = [];
    if (!Array.isArray(values)) return out;
    for (let i = 1; i < values.length; i++) {
        if (values[i] > 0 && values[i - 1] > 0) out.push(Math.log(values[i] / values[i - 1]));
    }
    return out;
}

/** Sample standard deviation (n - 1) */
function standardDeviation(values) {
    if (!Array.isArray(values) || values.length < 2) return null;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
}

/**
 * Annualized volatility in percent: stdev(daily returns) * sqrt(periodsPerYear) * 100.
 * Use 252 for stocks/ETFs (trading days) and 365 for crypto (trades every day).
 */
function annualizedVolatility(returns, periodsPerYear = 252) {
    const sd = standardDeviation(returns);
    return sd === null ? null : sd * Math.sqrt(periodsPerYear) * 100;
}

/** Largest peak-to-trough fall in percent (0 or negative) */
function maxDrawdown(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    let peak = values[0];
    let worst = 0;
    for (const v of values) {
        if (v > peak) peak = v;
        if (peak > 0) worst = Math.min(worst, (v / peak - 1) * 100);
    }
    return worst;
}

/** Percent change between the value `periods` steps back and the latest value */
function periodReturn(values, periods) {
    if (!Array.isArray(values) || periods <= 0 || values.length <= periods) return null;
    const base = values[values.length - 1 - periods];
    const last = values[values.length - 1];
    if (!(base > 0) || !isNum(last)) return null;
    return (last / base - 1) * 100;
}

/** Percent change from the first to the last value */
function totalReturn(values) {
    if (!Array.isArray(values) || values.length < 2) return null;
    return periodReturn(values, values.length - 1);
}

/** Percent difference of a from b, e.g. price vs its moving average */
function percentDiff(a, b) {
    if (!isNum(a) || !isNum(b) || b === 0) return null;
    return (a / b - 1) * 100;
}

module.exports = {
    isNum,
    round,
    priceDecimals,
    roundPrice,
    sma,
    rsiWilder,
    rsiWilderSeries,
    logReturns,
    standardDeviation,
    annualizedVolatility,
    maxDrawdown,
    periodReturn,
    totalReturn,
    percentDiff
};
