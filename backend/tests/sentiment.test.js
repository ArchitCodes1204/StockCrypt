const test = require('node:test');
const assert = require('node:assert/strict');
const sentiment = require('../services/sentiment');

test('positive and negative headlines', () => {
    const good = sentiment.scoreHeadline({ title: 'Apple beats estimates as iPhone sales surge' });
    assert.equal(good.sentiment, 'positive');
    assert.ok(good.keywords.includes('beats estimates'));
    assert.ok(good.keywords.includes('surge'));

    const bad = sentiment.scoreHeadline({ title: 'Tesla shares plunge after recall and downgrade' });
    assert.equal(bad.sentiment, 'negative');
    assert.equal(bad.score, -6, 'three negative title words count double');
});

test('neutral headline', () => {
    const result = sentiment.scoreHeadline({ title: 'Microsoft to hold annual shareholder meeting in December' });
    assert.equal(result.sentiment, 'neutral');
    assert.equal(result.score, 0);
    assert.deepEqual(result.keywords, []);
});

test('negation flips the next words', () => {
    assert.equal(sentiment.scoreHeadline({ title: 'Company fails to beat expectations' }).sentiment, 'negative');
    assert.equal(sentiment.scoreHeadline({ title: 'Analysts say the sell-off is not a crash' }).score, 0,
        'negative phrase (-2) cancelled by a negated negative word (+2)');
});

test('title counts double compared with the summary', () => {
    const result = sentiment.scoreHeadline({ title: 'Nvidia stock rallies', summary: 'Some analysts see weak demand and a loss' });
    assert.equal(result.score, 2 - 2);
    assert.equal(result.sentiment, 'neutral');
});

test('aggregate counts, score and summary', () => {
    const items = [
        { sentiment: 'positive' }, { sentiment: 'positive' }, { sentiment: 'positive' },
        { sentiment: 'negative' }, { sentiment: 'neutral' }, { sentiment: 'neutral' }
    ];
    const agg = sentiment.aggregate(items);
    assert.deepEqual(agg.counts, { positive: 3, negative: 1, neutral: 2 });
    assert.equal(agg.score, 0.33);
    assert.equal(agg.sentiment, 'positive');
    assert.equal(agg.summary, '3 of 6 recent headlines lean positive');

    const mixed = sentiment.aggregate([{ sentiment: 'positive' }, { sentiment: 'negative' }, { sentiment: 'neutral' }]);
    assert.equal(mixed.sentiment, 'neutral');
    assert.equal(mixed.score, 0);

    assert.equal(sentiment.aggregate([]).score, 0);
});
