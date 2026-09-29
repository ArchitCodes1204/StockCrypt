const express = require('express');
const router = express.Router();
const stockService = require('../services/stockService');
const Stock = require('../models/Stock');
const authMiddleware = require('../middleware/authMiddleware');
const { normalizeSymbol } = require('../utils/symbols');
const { statusFor } = require('../utils/errors');

/**
 * Answer with { error } and the status that fits the error:
 * 400 bad input, 404 unknown symbol, 502 market data provider failed, 500 anything else.
 */
function sendError(res, error, context) {
    const status = statusFor(error);
    if (status === 500) console.error(`${context}:`, error);
    else if (status === 502) console.error(`${context}: ${error.message}`);
    res.status(status).json({ error: error.message });
}

/** A trimmed string from the request, or '' */
const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * @route   POST /api/stock/analyze
 * @desc    Analyze a stock and get comprehensive report
 * @access  Public
 */
router.post('/analyze', async (req, res) => {
    try {
        const symbol = text(req.body?.symbol);

        if (!symbol) {
            return res.status(400).json({ error: 'Stock symbol is required' });
        }

        // X-Cache tells you whether the analysis came from the 90-second cache
        const fromCache = stockService.isAnalysisCached(symbol);
        const analysis = await stockService.analyzeStock(symbol);
        res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
        res.json(analysis);
    } catch (error) {
        sendError(res, error, 'Stock analysis error');
    }
});

/**
 * @route   POST /api/stock/compare
 * @desc    Compare two stocks side-by-side
 * @access  Public
 */
router.post('/compare', async (req, res) => {
    try {
        const symbol1 = text(req.body?.symbol1);
        const symbol2 = text(req.body?.symbol2);

        if (!symbol1 || !symbol2) {
            return res.status(400).json({ error: 'Two stock symbols are required' });
        }

        const comparison = await stockService.compareStocks(symbol1, symbol2);
        res.json(comparison);
    } catch (error) {
        sendError(res, error, 'Stock comparison error');
    }
});

/**
 * @route   GET /api/stock/quote/:symbol
 * @desc    Light quote (price and day change) for one symbol
 * @access  Public
 */
router.get('/quote/:symbol', async (req, res) => {
    try {
        const quote = await stockService.getQuote(req.params.symbol);
        res.json(quote);
    } catch (error) {
        sendError(res, error, 'Quote error');
    }
});

/**
 * @route   GET /api/stock/search?q=
 * @desc    Symbol autocomplete (up to 8 stocks, ETFs, crypto or indices)
 * @access  Public
 */
router.get('/search', async (req, res) => {
    try {
        const results = await stockService.searchSymbols(text(req.query.q));
        res.json(results);
    } catch (error) {
        sendError(res, error, 'Symbol search error');
    }
});

// Watchlist sort options (?sort=). "change" = biggest daily gain first.
const WATCHLIST_SORTS = {
    newest: { addedAt: -1, _id: -1 },
    oldest: { addedAt: 1, _id: 1 },
    symbol: { symbol: 1, _id: 1 },
    change: { 'lastAnalysis.currentMarketStatus.changePercentRaw': -1, addedAt: -1, _id: -1 }
};
const MAX_PAGE_SIZE = 100;

/**
 * @route   GET /api/stock/watchlist
 * @desc    Get user's watchlist (newest first). Optional query: limit, skip,
 *          recommendation=BUY|HOLD|SELL, sort=newest|oldest|symbol|change.
 *          The X-Total-Count header holds the number of matching items before limit/skip.
 * @access  Private
 */
router.get('/watchlist', authMiddleware, async (req, res) => {
    try {
        const filter = { userId: req.user.userId };

        const recommendation = text(req.query.recommendation).toUpperCase();
        if (recommendation && recommendation !== 'ALL') {
            filter['lastAnalysis.recommendation.decision'] = recommendation;
        }

        const sort = WATCHLIST_SORTS[text(req.query.sort).toLowerCase()] || WATCHLIST_SORTS.newest;
        let query = Stock.find(filter).sort(sort);

        const skip = parseInt(req.query.skip, 10);
        if (skip > 0) query = query.skip(skip);
        const limit = parseInt(req.query.limit, 10);
        if (limit > 0) query = query.limit(Math.min(limit, MAX_PAGE_SIZE));

        const [stocks, total] = await Promise.all([query, Stock.countDocuments(filter)]);

        res.set('X-Total-Count', String(total));
        res.json(stocks);
    } catch (error) {
        console.error('Watchlist fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch watchlist' });
    }
});

/**
 * @route   POST /api/stock/watchlist
 * @desc    Add stock to watchlist
 * @access  Private
 */
router.post('/watchlist', authMiddleware, async (req, res) => {
    try {
        const symbol = text(req.body?.symbol);
        const notes = typeof req.body?.notes === 'string' ? req.body.notes : '';

        if (!symbol) {
            return res.status(400).json({ error: 'Stock symbol is required' });
        }

        // Get initial analysis
        const analysis = await stockService.analyzeStock(symbol);

        // Create or update watchlist item
        const stock = await Stock.findOneAndUpdate(
            { userId: req.user.userId, symbol: analysis.symbol },
            {
                userId: req.user.userId,
                symbol: analysis.symbol,
                lastAnalysis: analysis,
                notes,
                addedAt: new Date()
            },
            { upsert: true, new: true }
        );

        res.json(stock);
    } catch (error) {
        sendError(res, error, 'Add to watchlist error');
    }
});

/**
 * @route   DELETE /api/stock/watchlist/:symbol
 * @desc    Remove stock from watchlist
 * @access  Private
 */
router.delete('/watchlist/:symbol', authMiddleware, async (req, res) => {
    try {
        const { display: symbol } = normalizeSymbol(req.params.symbol);

        const result = await Stock.findOneAndDelete({
            userId: req.user.userId,
            symbol
        });

        if (!result) {
            return res.status(404).json({ error: 'Stock not found in watchlist' });
        }

        res.json({ message: 'Stock removed from watchlist', symbol });
    } catch (error) {
        console.error('Remove from watchlist error:', error);
        res.status(500).json({ error: 'Failed to remove from watchlist' });
    }
});

/**
 * @route   PUT /api/stock/watchlist/:symbol/refresh
 * @desc    Refresh analysis for a watchlist stock (skips the cache, so the data is new)
 * @access  Private
 */
router.put('/watchlist/:symbol/refresh', authMiddleware, async (req, res) => {
    try {
        const { display: symbol } = normalizeSymbol(req.params.symbol);

        const exists = await Stock.exists({ userId: req.user.userId, symbol });
        if (!exists) {
            return res.status(404).json({ error: 'Stock not found in watchlist' });
        }

        const analysis = await stockService.analyzeStock(symbol, { fresh: true });

        const stock = await Stock.findOneAndUpdate(
            { userId: req.user.userId, symbol },
            { lastAnalysis: analysis },
            { new: true }
        );

        if (!stock) {
            return res.status(404).json({ error: 'Stock not found in watchlist' });
        }

        res.json(stock);
    } catch (error) {
        sendError(res, error, 'Refresh analysis error');
    }
});

/**
 * @route   GET /api/stock/screener?market=stocks|crypto
 * @desc    Screener rows with live quotes and 1-month sparklines (default market: stocks)
 * @access  Public
 */
router.get('/screener', async (req, res) => {
    try {
        const market = text(req.query.market).toLowerCase() || 'stocks';
        const screenerData = await stockService.getScreenerStocks(market);
        res.json(screenerData);
    } catch (error) {
        sendError(res, error, 'Screener route error');
    }
});

/**
 * @route   GET /api/stock/trending
 * @desc    Popular stocks with quick signals from the full analysis
 * @access  Public
 */
router.get('/trending', async (req, res) => {
    try {
        const trending = await stockService.getTrending();
        res.json(trending);
    } catch (error) {
        console.error('Trending stocks error:', error);
        res.status(500).json({ error: 'Failed to fetch trending stocks' });
    }
});

module.exports = router;
