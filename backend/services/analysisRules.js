/**
 * Rule-based analysis built from real market data.
 *
 * Every function here is pure: it takes numbers computed from Yahoo Finance data
 * and returns a decision together with the sentences that explain it, so each
 * result can be traced back to the numbers that produced it.
 * This is technical analysis, not a prediction, and it is not financial advice.
 */
const {
    isNum, round, roundPrice, sma, rsiWilder, logReturns, annualizedVolatility,
    maxDrawdown, periodReturn, totalReturn, percentDiff
} = require('../utils/indicators');
const { formatMoney, formatCompactNumber, signed } = require('../utils/format');

// Trading-day offsets for the return periods. Crypto trades every day, so it uses calendar days.
const PERIOD_OFFSETS = {
    stock: { '1w': 5, '1m': 21, '3m': 63, '6m': 126 },
    crypto: { '1w': 7, '1m': 30, '3m': 91, '6m': 182 }
};

const FULL_YEAR_DAYS = 300;             // history spanning ~10+ months counts as a 1-year window
const MIN_RETURNS_FOR_VOLATILITY = 10;  // fewer daily returns than this is too noisy to annualize
const AT_AVERAGE_BAND = 0.5;            // % - closer than this to an average counts as "at" it

const moved = (value) => (value >= 0 ? `rose ${value.toFixed(1)}%` : `fell ${Math.abs(value).toFixed(1)}%`);

// ---------------------------------------------------------------------------
// Indicators
// ---------------------------------------------------------------------------

/**
 * Indicator bundle from daily closes (oldest first; the last value is the current price).
 * Returns null when there are fewer than 2 closes.
 */
function buildIndicators(closes, { periodsPerYear = 252, spanDays = 0, fiftyTwoWeekHigh = null, fiftyTwoWeekLow = null } = {}) {
    if (!Array.isArray(closes) || closes.length < 2) return null;

    const price = closes[closes.length - 1];
    const offsets = periodsPerYear >= 365 ? PERIOD_OFFSETS.crypto : PERIOD_OFFSETS.stock;

    const returns = {};
    for (const [key, periods] of Object.entries(offsets)) returns[key] = round(periodReturn(closes, periods), 2);
    returns['1y'] = spanDays >= FULL_YEAR_DAYS ? round(totalReturn(closes), 2) : null;

    const daily = logReturns(closes);
    const volatility = daily.length >= MIN_RETURNS_FOR_VOLATILITY ? annualizedVolatility(daily, periodsPerYear) : null;

    // Prefer Yahoo's 52-week range (intraday highs/lows); fall back to the closes we have
    const high = isNum(fiftyTwoWeekHigh) ? Math.max(fiftyTwoWeekHigh, price) : Math.max(...closes);
    const low = isNum(fiftyTwoWeekLow) ? Math.min(fiftyTwoWeekLow, price) : Math.min(...closes);
    const fromHigh = percentDiff(price, high);

    const sma50 = sma(closes, 50);
    const sma200 = sma(closes, 200);

    return {
        sma20: roundPrice(sma(closes, 20)),
        sma50: roundPrice(sma50),
        sma200: roundPrice(sma200),
        rsi14: round(rsiWilder(closes, 14), 2),
        volatility: round(volatility, 2),
        maxDrawdown: round(maxDrawdown(closes), 2),
        returns,
        fiftyTwoWeekHigh: roundPrice(high),
        fiftyTwoWeekLow: roundPrice(low),
        distanceFromHigh: fromHigh === null ? null : round(Math.min(0, fromHigh), 2),
        goldenCross: sma50 !== null && sma200 !== null && sma50 > sma200
    };
}

/**
 * Medium-term trend: price > SMA50 > SMA200 is bullish, price < SMA50 < SMA200 is bearish,
 * anything else is sideways. Short histories use SMA20/SMA50, or with under 50 days the
 * price against its SMA20 confirmed by the 1-month change; no history uses the day's change.
 */
function classifyTrend(price, ind, changePercent) {
    let fast = null;
    let slow = null;
    if (ind && isNum(ind.sma50) && isNum(ind.sma200)) [fast, slow] = [ind.sma50, ind.sma200];
    else if (ind && isNum(ind.sma20) && isNum(ind.sma50)) [fast, slow] = [ind.sma20, ind.sma50];

    if (isNum(price) && fast !== null) {
        if (price > fast && fast > slow) return 'bullish';
        if (price < fast && fast < slow) return 'bearish';
        return 'sideways';
    }

    const r1m = ind?.returns?.['1m'];
    if (isNum(price) && isNum(ind?.sma20) && isNum(r1m)) {
        if (price > ind.sma20 && r1m > 0) return 'bullish';
        if (price < ind.sma20 && r1m < 0) return 'bearish';
        return 'sideways';
    }

    if (isNum(changePercent) && changePercent > 0) return 'bullish';
    if (isNum(changePercent) && changePercent < 0) return 'bearish';
    return 'sideways';
}

// ---------------------------------------------------------------------------
// Recommendation (points system)
// ---------------------------------------------------------------------------

function makeSignal(label, value, points, reason, available = true) {
    const verdict = points > 0 ? 'positive' : points < 0 ? 'negative' : 'neutral';
    return { label, value, verdict, points, reason, available };
}

/** The six technical signals, each worth -1, 0 or +1 point */
function buildSignals({ price, currency, ind }) {
    const money = (v) => formatMoney(v, currency);
    const unavailable = (label) => makeSignal(label, 'N/A', 0, null, false);
    const signals = [];

    // 1-2. Price against its 50-day and 200-day averages
    for (const days of [50, 200]) {
        const label = `Price vs ${days}-day average`;
        const avg = ind?.[`sma${days}`];
        const diff = percentDiff(price, avg);
        if (diff === null) {
            signals.push(unavailable(label));
            continue;
        }
        const value = `${signed(diff, 1)}% (avg ${money(avg)})`;
        if (Math.abs(diff) < AT_AVERAGE_BAND) {
            signals.push(makeSignal(label, value, 0, `Price (${money(price)}) is right at its ${days}-day average (${money(avg)})`));
        } else if (diff > 0) {
            signals.push(makeSignal(label, value, 1, `Price (${money(price)}) is ${diff.toFixed(1)}% above its ${days}-day average (${money(avg)})`));
        } else {
            signals.push(makeSignal(label, value, -1, `Price (${money(price)}) is ${Math.abs(diff).toFixed(1)}% below its ${days}-day average (${money(avg)})`));
        }
    }

    // 3. 50-day vs 200-day average (golden cross / death cross)
    const crossLabel = 'Trend (50 vs 200-day)';
    const gap = percentDiff(ind?.sma50, ind?.sma200);
    if (gap === null) {
        signals.push(unavailable(crossLabel));
    } else if (Math.abs(gap) < AT_AVERAGE_BAND) {
        signals.push(makeSignal(crossLabel, 'Flat', 0,
            `The 50-day average (${money(ind.sma50)}) and 200-day average (${money(ind.sma200)}) are almost equal, so the long-term trend is flat`));
    } else if (gap > 0) {
        signals.push(makeSignal(crossLabel, 'Golden cross', 1,
            `The 50-day average (${money(ind.sma50)}) is ${gap.toFixed(1)}% above the 200-day average (${money(ind.sma200)}), a "golden cross" uptrend`));
    } else {
        signals.push(makeSignal(crossLabel, 'Death cross', -1,
            `The 50-day average (${money(ind.sma50)}) is ${Math.abs(gap).toFixed(1)}% below the 200-day average (${money(ind.sma200)}), a "death cross" downtrend`));
    }

    // 4. 3-month momentum
    const momentumLabel = '3-month momentum';
    const r3m = ind?.returns?.['3m'];
    if (!isNum(r3m)) signals.push(unavailable(momentumLabel));
    else if (r3m > 5) signals.push(makeSignal(momentumLabel, `${signed(r3m, 1)}%`, 1, `Up ${r3m.toFixed(1)}% over the past 3 months`));
    else if (r3m < -5) signals.push(makeSignal(momentumLabel, `${signed(r3m, 1)}%`, -1, `Down ${Math.abs(r3m).toFixed(1)}% over the past 3 months`));
    else signals.push(makeSignal(momentumLabel, `${signed(r3m, 1)}%`, 0, `Little change over the past 3 months (${signed(r3m, 1)}%)`));

    // 5. RSI: overbought counts against, oversold counts in favour (contrarian)
    const rsiLabel = 'RSI (14)';
    const rsi = ind?.rsi14;
    if (!isNum(rsi)) signals.push(unavailable(rsiLabel));
    else if (rsi > 70) signals.push(makeSignal(rsiLabel, `${rsi.toFixed(1)} (overbought)`, -1, `RSI(14) is ${rsi.toFixed(1)}, above 70, which signals overbought conditions after a strong run`));
    else if (rsi < 30) signals.push(makeSignal(rsiLabel, `${rsi.toFixed(1)} (oversold)`, 1, `RSI(14) is ${rsi.toFixed(1)}, below 30, which signals oversold conditions that sometimes come before a rebound`));
    else signals.push(makeSignal(rsiLabel, `${rsi.toFixed(1)} (neutral)`, 0, `RSI(14) is ${rsi.toFixed(1)}, inside the neutral 30-70 range`));

    // 6. Distance from the 52-week high
    const highLabel = 'Distance from 52-week high';
    const fromHigh = ind?.distanceFromHigh;
    const high = ind?.fiftyTwoWeekHigh;
    if (!isNum(fromHigh)) signals.push(unavailable(highLabel));
    else if (fromHigh === 0) signals.push(makeSignal(highLabel, '0.0%', 1, `Trading at its 52-week high (${money(high)})`));
    else if (fromHigh >= -5) signals.push(makeSignal(highLabel, `${signed(fromHigh, 1)}%`, 1, `Trading only ${Math.abs(fromHigh).toFixed(1)}% below its 52-week high (${money(high)})`));
    else if (fromHigh <= -20) signals.push(makeSignal(highLabel, `${signed(fromHigh, 1)}%`, -1, `Trading ${Math.abs(fromHigh).toFixed(1)}% below its 52-week high (${money(high)})`));
    else signals.push(makeSignal(highLabel, `${signed(fromHigh, 1)}%`, 0, `Trading ${Math.abs(fromHigh).toFixed(1)}% below its 52-week high (${money(high)})`));

    return signals;
}

/**
 * BUY / HOLD / SELL from the sum of the signal points:
 * +3 or more is BUY, -3 or less is SELL, anything in between is HOLD.
 */
function buildRecommendation({ price, currency = 'USD', ind, historyPoints = 0 }) {
    const signals = buildSignals({ price, currency, ind });
    const score = signals.reduce((sum, s) => sum + s.points, 0);
    const available = signals.filter((s) => s.available).length;
    const positives = signals.filter((s) => s.points > 0).length;
    const negatives = signals.filter((s) => s.points < 0).length;

    const decision = score >= 3 ? 'BUY' : score <= -3 ? 'SELL' : 'HOLD';

    // Confidence: how strong the score is and how much the signals agree
    let confidence;
    if (available < 4) confidence = 'Low';
    else if (decision === 'HOLD') confidence = positives >= 2 && negatives >= 2 ? 'Low' : 'Moderate';
    else {
        const opposing = decision === 'BUY' ? negatives : positives;
        confidence = Math.abs(score) >= 5 || (Math.abs(score) >= 4 && opposing === 0) ? 'High' : 'Moderate';
    }

    // Reasons: signals supporting the decision first, then those against it, then neutral ones
    const direction = decision === 'BUY' ? 1 : decision === 'SELL' ? -1 : 0;
    const rank = (s) => {
        if (direction === 0) return s.points !== 0 ? 0 : 1;
        if (Math.sign(s.points) === direction) return 0;
        return s.points !== 0 ? 1 : 2;
    };
    const reasons = signals
        .filter((s) => s.reason)
        .sort((a, b) => rank(a) - rank(b))
        .map((s) => s.reason);

    if (available === 0) {
        reasons.push('Price history is unavailable right now, so no technical signals could be calculated');
    } else if (available < signals.length) {
        reasons.push(`Only ${historyPoints} days of price history are available, so ${signals.length - available} of ${signals.length} signals could not be calculated`);
    }
    reasons.push(`Total score ${signed(score, 0)} from ${available} signals (BUY at +3 or more, SELL at -3 or less)`);

    return {
        decision,
        confidence,
        score: String(score),
        reasons,
        signals: signals.map(({ label, value, verdict, points }) => ({ label, value, verdict, points }))
    };
}

// ---------------------------------------------------------------------------
// Risk score (1-10)
// ---------------------------------------------------------------------------

// Annualized volatility (%) thresholds for each step: <=10% scores 1, >90% scores 10
const VOLATILITY_STEPS = [10, 15, 20, 27, 35, 45, 55, 70, 90];

/**
 * Risk from annualized volatility, adjusted by the worst drawdown and beta.
 * Base score = 1 + number of VOLATILITY_STEPS exceeded, then:
 *   drawdown worse than -50% +2, worse than -30% +1, milder than -10% -1;
 *   beta >= 1.5 +1, beta <= 0.6 -1; fewer than 60 days of history +1.
 */
function buildRiskScore({ ind, beta = null, historyPoints = 0, fullYear = true, isCrypto = false }) {
    const factors = [];
    const adjustments = [];
    const volatility = ind?.volatility;
    const drawdown = ind?.maxDrawdown;
    let score;

    if (isNum(volatility)) {
        score = 1 + VOLATILITY_STEPS.filter((step) => volatility > step).length;
        factors.push(`Annualized volatility: ${volatility.toFixed(1)}%`);
        adjustments.push(`Base ${score}/10 from ${volatility.toFixed(1)}% annualized volatility`);
    } else {
        score = 5;
        factors.push('Not enough price history to measure volatility');
        adjustments.push('Base 5/10 because volatility could not be measured');
    }

    if (isNum(drawdown)) {
        factors.push(`Max drawdown (${fullYear ? '1y' : `${historyPoints} days`}): ${drawdown.toFixed(1)}%`);
        if (drawdown <= -50) { score += 2; adjustments.push('+2 for a drawdown worse than -50%'); }
        else if (drawdown <= -30) { score += 1; adjustments.push('+1 for a drawdown worse than -30%'); }
        else if (drawdown > -10 && isNum(volatility)) { score -= 1; adjustments.push('-1 for a drawdown milder than -10%'); }
    }

    if (isNum(beta)) {
        factors.push(`Beta: ${beta.toFixed(2)}`);
        if (beta >= 1.5) { score += 1; adjustments.push('+1 for beta of 1.5 or more (moves more than the market)'); }
        else if (beta <= 0.6) { score -= 1; adjustments.push('-1 for beta of 0.6 or less (moves less than the market)'); }
    }

    if (historyPoints > 0 && historyPoints < 60) {
        score += 1;
        factors.push(`Limited price history: ${historyPoints} days`);
        adjustments.push('+1 for less than 60 days of history');
    }

    if (isCrypto) factors.push('Cryptocurrency: trades around the clock and can move sharply');

    score = Math.min(10, Math.max(1, Math.round(score)));
    const level = score <= 3 ? 'Low Risk' : score <= 6 ? 'Moderate Risk' : 'High Risk';

    return { score, level, factors, adjustments };
}

// ---------------------------------------------------------------------------
// Outlook (describes the current trend; never promises returns)
// ---------------------------------------------------------------------------

function buildOutlook({ price, currency = 'USD', ind }) {
    const money = (v) => formatMoney(v, currency);
    if (!ind) {
        return {
            shortTerm: 'Not enough price history to describe the short-term trend.',
            longTerm: 'Not enough price history to describe the long-term trend. Past trends do not predict future returns.',
            confidence: 'Low'
        };
    }

    // Short term: 1-month change, position against the 20-day average, RSI extremes
    const r1m = ind.returns?.['1m'];
    const vsSma20 = percentDiff(price, ind.sma20);
    let shortDir = 0;
    let shortTerm;
    if (isNum(r1m) && isNum(vsSma20)) {
        if (r1m > 2 && vsSma20 > 0) {
            shortDir = 1;
            shortTerm = `Short-term momentum is positive: the price ${moved(r1m)} over the past month and is ${vsSma20.toFixed(1)}% above its 20-day average (${money(ind.sma20)}).`;
        } else if (r1m < -2 && vsSma20 < 0) {
            shortDir = -1;
            shortTerm = `Short-term momentum is negative: the price ${moved(r1m)} over the past month and is ${Math.abs(vsSma20).toFixed(1)}% below its 20-day average (${money(ind.sma20)}).`;
        } else {
            shortTerm = `Short-term momentum is mixed: the price ${moved(r1m)} over the past month and is ${vsSma20 >= 0 ? 'above' : 'below'} its 20-day average (${money(ind.sma20)}).`;
        }
    } else {
        shortTerm = 'Not enough recent price history to judge short-term momentum.';
    }
    if (isNum(ind.rsi14) && ind.rsi14 > 70) shortTerm += ` An RSI of ${ind.rsi14.toFixed(0)} is overbought, so a pause or pullback would not be unusual.`;
    else if (isNum(ind.rsi14) && ind.rsi14 < 30) shortTerm += ` An RSI of ${ind.rsi14.toFixed(0)} is oversold, which sometimes comes before a bounce.`;

    // Long term: 50 vs 200-day averages plus the 1-year (or 6-month) change
    const longReturn = isNum(ind.returns?.['1y'])
        ? { value: ind.returns['1y'], label: 'the past year' }
        : isNum(ind.returns?.['6m']) ? { value: ind.returns['6m'], label: 'the past 6 months' } : null;
    let longDir = 0;
    let longTerm;
    if (isNum(ind.sma50) && isNum(ind.sma200)) {
        const aboveLong = price > ind.sma200;
        if (ind.goldenCross && aboveLong) {
            longDir = 1;
            longTerm = `The long-term trend is up: the 50-day average (${money(ind.sma50)}) is above the 200-day average (${money(ind.sma200)}) and the price is above both`;
        } else if (!ind.goldenCross && !aboveLong) {
            longDir = -1;
            longTerm = `The long-term trend is down: the 50-day average (${money(ind.sma50)}) is below the 200-day average (${money(ind.sma200)}) and the price is below the 200-day average`;
        } else {
            longTerm = `The long-term trend is unclear: the 50-day average is ${ind.goldenCross ? 'above' : 'below'} the 200-day average (${money(ind.sma200)}), but the price is ${aboveLong ? 'above' : 'below'} it`;
        }
        if (longReturn) longTerm += `. Over ${longReturn.label} the price ${moved(longReturn.value)}`;
        longTerm += '.';
    } else if (longReturn) {
        longTerm = `There is not enough history for a 200-day average yet. Over ${longReturn.label} the price ${moved(longReturn.value)}.`;
    } else {
        longTerm = 'Not enough price history to describe the long-term trend.';
    }
    longTerm += ' Past trends do not predict future returns.';

    // Confidence in the description: do both horizons agree, and how noisy is the price?
    const vol = ind.volatility;
    let confidence = 'Moderate';
    if (shortDir !== 0 && shortDir === longDir && isNum(vol) && vol < 30) confidence = 'High';
    else if ((shortDir !== 0 && longDir !== 0 && shortDir !== longDir) || (shortDir === 0 && longDir === 0) || !isNum(vol) || vol > 50) confidence = 'Low';

    return { shortTerm, longTerm, confidence };
}

// ---------------------------------------------------------------------------
// Investor fit
// ---------------------------------------------------------------------------

function buildInvestmentTypes({ ind, risk, avgVolume = null }) {
    const vol = ind?.volatility;
    const has1y = isNum(ind?.returns?.['1y']);
    const longReturn = has1y ? ind.returns['1y'] : ind?.returns?.['6m'] ?? null;
    const returnLabel = has1y ? '1-year' : '6-month';
    const liquidity = isNum(avgVolume) ? ` and an average daily volume of ${formatCompactNumber(avgVolume)}` : '';

    // Short-term traders want price swings and liquidity
    let shortTerm;
    if (!isNum(vol)) shortTerm = { suitability: 'Moderate', reason: 'Not enough price history to measure how much the price swings' };
    else if (vol >= 40) shortTerm = { suitability: 'High', reason: `Large price swings (${vol.toFixed(1)}% annualized volatility)${liquidity} create frequent trading opportunities` };
    else if (vol >= 25) shortTerm = { suitability: 'Moderate', reason: `Moderate price swings (${vol.toFixed(1)}% annualized volatility)${liquidity}` };
    else shortTerm = { suitability: 'Low', reason: `Small day-to-day moves (${vol.toFixed(1)}% annualized volatility) leave little room for short-term trades` };

    // Long-term investors want an established uptrend without extreme risk
    let longTerm;
    const returnText = isNum(longReturn) ? `a ${returnLabel} return of ${signed(longReturn, 1)}%` : null;
    if (!ind) {
        longTerm = { suitability: 'Moderate', reason: `Risk score of ${risk.score}/10, but not enough price history to judge the long-term trend` };
    } else if (risk.score >= 8 || (isNum(longReturn) && longReturn < -20)) {
        longTerm = { suitability: 'Low', reason: `Risk score of ${risk.score}/10${returnText ? ` and ${returnText}` : ''} make for a bumpy long-term hold` };
    } else if (risk.score <= 6 && isNum(longReturn) && longReturn > 0 && ind.goldenCross) {
        longTerm = { suitability: 'High', reason: `${returnText[0].toUpperCase()}${returnText.slice(1)}, the 50-day average above the 200-day and a risk score of ${risk.score}/10` };
    } else {
        longTerm = {
            suitability: 'Moderate',
            reason: `Risk score of ${risk.score}/10${returnText ? ` with ${returnText}` : ''}; ${ind.goldenCross ? 'the long-term uptrend is intact' : 'no confirmed long-term uptrend'}`
        };
    }

    // High-risk takers look for big moves
    const drawdown = ind?.maxDrawdown;
    const volText = isNum(vol) ? ` (${vol.toFixed(1)}% annualized volatility)` : '';
    let highRisk;
    if (risk.score >= 7) highRisk = { suitability: 'High', reason: `Risk score of ${risk.score}/10${isNum(drawdown) ? ` with a max drawdown of ${drawdown.toFixed(1)}%` : ''}: large moves in both directions` };
    else if (risk.score >= 4) highRisk = { suitability: 'Moderate', reason: `Risk score of ${risk.score}/10: noticeable swings${volText}, but not extreme` };
    else highRisk = { suitability: 'Low', reason: `Risk score of ${risk.score}/10: price moves${volText} are too small for aggressive strategies` };

    return [
        { type: 'Short-term Traders', ...shortTerm },
        { type: 'Long-term Investors', ...longTerm },
        { type: 'High-risk Takers', ...highRisk }
    ];
}

// ---------------------------------------------------------------------------
// News sentiment fallback and screener rating
// ---------------------------------------------------------------------------

/** Used when there are no headlines: describe recent price action instead */
function priceActionSentiment({ ind, changePercent }) {
    const r1m = ind?.returns?.['1m'];
    const basis = isNum(r1m)
        ? { value: r1m, label: 'the past month', threshold: 3 }
        : isNum(changePercent) ? { value: changePercent, label: 'the last session', threshold: 1 } : null;
    const sentiment = !basis ? 'neutral' : basis.value > basis.threshold ? 'positive' : basis.value < -basis.threshold ? 'negative' : 'neutral';

    return {
        sentiment,
        summary: basis
            ? `No recent headlines found. Price action over ${basis.label} is ${sentiment} (${signed(basis.value, 1)}%)`
            : 'No recent headlines or price data available',
        note: 'No Yahoo Finance headlines were available, so this is based on price action instead',
        score: 0,
        counts: { positive: 0, negative: 0, neutral: 0 },
        source: 'price-action'
    };
}

/**
 * Screener rating from the quote alone: price vs 50-day and 200-day averages,
 * 50-day vs 200-day, and the day's move (beyond +/-1%). Each is worth one point.
 */
function technicalRating({ price, fiftyDayAverage, twoHundredDayAverage, changePercent }) {
    let points = 0;
    if (isNum(price) && isNum(fiftyDayAverage)) points += price > fiftyDayAverage ? 1 : -1;
    if (isNum(price) && isNum(twoHundredDayAverage)) points += price > twoHundredDayAverage ? 1 : -1;
    if (isNum(fiftyDayAverage) && isNum(twoHundredDayAverage)) points += fiftyDayAverage > twoHundredDayAverage ? 1 : -1;
    if (isNum(changePercent) && changePercent > 1) points += 1;
    else if (isNum(changePercent) && changePercent < -1) points -= 1;

    let rating = 'Neutral';
    if (points >= 3) rating = 'Strong Buy';
    else if (points >= 1) rating = 'Buy';
    else if (points <= -3) rating = 'Strong Sell';
    else if (points <= -1) rating = 'Sell';
    return { rating, points };
}

module.exports = {
    buildIndicators,
    classifyTrend,
    buildSignals,
    buildRecommendation,
    buildRiskScore,
    buildOutlook,
    buildInvestmentTypes,
    priceActionSentiment,
    technicalRating,
    PERIOD_OFFSETS,
    FULL_YEAR_DAYS
};
