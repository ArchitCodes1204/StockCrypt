/**
 * Keyword-based sentiment for news headlines.
 *
 * Deliberately simple and transparent: a headline scores +1 for every positive
 * finance word and -1 for every negative one. A word right after a negation
 * ("not", "fails to", ...) flips sign. Words in the title count double compared
 * with words in the summary. There is no machine learning involved.
 */

const POSITIVE_WORDS = [
    'beat', 'beats', 'beating', 'surge', 'surges', 'surged', 'surging', 'soar', 'soars', 'soared', 'soaring',
    'rally', 'rallies', 'rallied', 'rallying', 'jump', 'jumps', 'jumped', 'gain', 'gains', 'gained',
    'rise', 'rises', 'rising', 'rose', 'climb', 'climbs', 'climbed', 'rebound', 'rebounds', 'rebounded',
    'recover', 'recovers', 'recovery', 'record', 'upgrade', 'upgrades', 'upgraded', 'outperform', 'outperforms',
    'strong', 'stronger', 'strength', 'growth', 'grows', 'grew', 'profit', 'profits', 'profitable',
    'bullish', 'boost', 'boosts', 'boosted', 'tops', 'topped', 'exceeds', 'exceeded', 'raises', 'raised',
    'expands', 'expansion', 'wins', 'won', 'breakthrough', 'optimistic', 'optimism', 'upbeat', 'positive',
    'buyback', 'approval', 'approved', 'partnership', 'accelerates', 'higher', 'best', 'rewards', 'bull'
];

const NEGATIVE_WORDS = [
    'miss', 'misses', 'missed', 'fall', 'falls', 'fell', 'falling', 'drop', 'drops', 'dropped', 'dropping',
    'plunge', 'plunges', 'plunged', 'slump', 'slumps', 'slumped', 'decline', 'declines', 'declined',
    'loss', 'losses', 'lose', 'loses', 'downgrade', 'downgrades', 'downgraded', 'underperform', 'underperforms',
    'weak', 'weaker', 'weakness', 'bearish', 'cut', 'cuts', 'slash', 'slashes', 'slashed', 'lawsuit', 'sued',
    'probe', 'investigation', 'recall', 'recalls', 'layoff', 'layoffs', 'fraud', 'warning', 'warns', 'warned',
    'lower', 'selloff', 'crash', 'crashes', 'crashed', 'tumble', 'tumbles', 'tumbled', 'sink', 'sinks', 'sank',
    'slide', 'slides', 'slid', 'fear', 'fears', 'concern', 'concerns', 'delay', 'delays', 'delayed',
    'fined', 'penalty', 'halt', 'halts', 'halted', 'bankruptcy', 'bankrupt', 'negative', 'disappointing',
    'disappoints', 'plummet', 'plummets', 'plummeted', 'worst', 'volatile', 'turmoil', 'antitrust', 'hack', 'breach', 'bear'
];

// Multi-word phrases checked before single words
const POSITIVE_PHRASES = ['all-time high', 'record high', 'beats estimates', 'raises guidance', 'price target raised'];
const NEGATIVE_PHRASES = ['sell-off', 'misses estimates', 'cuts guidance', 'price target cut', 'record low', '52-week low'];

const NEGATIONS = new Set(['not', 'no', 'never', 'without', "isn't", "aren't", "wasn't", "doesn't", "don't", "didn't", "won't", "can't", 'fails', 'failed', 'fail']);

const POSITIVE = new Set(POSITIVE_WORDS);
const NEGATIVE = new Set(NEGATIVE_WORDS);

const tokenize = (text) => String(text || '').toLowerCase().replace(/[‘’]/g, "'").match(/[a-z0-9]+(?:'[a-z]+)?/g) || [];

/**
 * Score one piece of text.
 * @returns {{ score: number, positive: string[], negative: string[] }}
 */
function scoreText(text) {
    let lower = String(text || '').toLowerCase();
    const positive = [];
    const negative = [];

    // Phrases first; remove them so their words are not counted again
    for (const phrase of POSITIVE_PHRASES) {
        if (lower.includes(phrase)) { positive.push(phrase); lower = lower.split(phrase).join(' '); }
    }
    for (const phrase of NEGATIVE_PHRASES) {
        if (lower.includes(phrase)) { negative.push(phrase); lower = lower.split(phrase).join(' '); }
    }

    const tokens = tokenize(lower);
    tokens.forEach((token, i) => {
        let polarity = POSITIVE.has(token) ? 1 : NEGATIVE.has(token) ? -1 : 0;
        if (!polarity) return;

        // "fails to beat", "not strong": a negation up to two words back flips the word
        const negated = [tokens[i - 1], tokens[i - 2]].some((t) => t && NEGATIONS.has(t));
        if (negated) polarity = -polarity;

        const label = negated ? `not ${token}` : token;
        if (polarity > 0) positive.push(label);
        else negative.push(label);
    });

    return { score: positive.length - negative.length, positive, negative };
}

/**
 * Sentiment of one headline.
 * @param {{ title: string, summary?: string }} item
 * @returns {{ sentiment: 'positive'|'negative'|'neutral', score: number, keywords: string[] }}
 */
function scoreHeadline({ title, summary } = {}) {
    const inTitle = scoreText(title);
    const inSummary = scoreText(summary);
    const score = inTitle.score * 2 + inSummary.score;
    const keywords = [...new Set([...inTitle.positive, ...inTitle.negative, ...inSummary.positive, ...inSummary.negative])];

    return {
        sentiment: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral',
        score,
        keywords
    };
}

/**
 * Overall tone of a list of scored headlines.
 * score = (positive headlines - negative headlines) / all headlines, from -1 to 1.
 */
function aggregate(scored) {
    const counts = { positive: 0, negative: 0, neutral: 0 };
    for (const item of scored) counts[item.sentiment] += 1;

    const total = scored.length;
    const score = total ? Math.round(((counts.positive - counts.negative) / total) * 100) / 100 : 0;
    const sentiment = score >= 0.2 ? 'positive' : score <= -0.2 ? 'negative' : 'neutral';

    let summary;
    if (!total) summary = 'No recent headlines found';
    else if (sentiment === 'neutral') {
        summary = `Mixed or neutral: ${counts.positive} positive, ${counts.negative} negative and ${counts.neutral} neutral of ${total} recent headlines`;
    } else {
        summary = `${counts[sentiment]} of ${total} recent headlines lean ${sentiment}`;
    }

    return { sentiment, summary, score, counts };
}

module.exports = { scoreText, scoreHeadline, aggregate, tokenize };
