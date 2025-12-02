const express = require('express');
const router = express.Router();
const stockService = require('../services/stockService');
const Stock = require('../models/Stock');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route   POST /api/stock/analyze
 * @desc    Analyze a stock and get comprehensive report
 * @access  Public
 */
router.post('/analyze', async (req, res) => {
    try {
        const { symbol } = req.body;

        if (!symbol) {
            return res.status(400).json({ error: 'Stock symbol is required' });
        }

        const analysis = await stockService.analyzeStock(symbol);
        res.json(analysis);
    } catch (error) {
        console.error('Stock analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/stock/compare
 * @desc    Compare two stocks side-by-side
 * @access  Public
 */
router.post('/compare', async (req, res) => {
    try {
        const { symbol1, symbol2 } = req.body;

        if (!symbol1 || !symbol2) {
            return res.status(400).json({ error: 'Two stock symbols are required' });
        }

        const comparison = await stockService.compareStocks(symbol1, symbol2);
        res.json(comparison);
    } catch (error) {
        console.error('Stock comparison error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/stock/watchlist
 * @desc    Get user's watchlist
 * @access  Private
 */
router.get('/watchlist', authMiddleware, async (req, res) => {
    try {
        const stocks = await Stock.find({ userId: req.user.id })
            .sort({ addedAt: -1 });

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
        const { symbol, notes } = req.body;

        if (!symbol) {
            return res.status(400).json({ error: 'Stock symbol is required' });
        }

        // Get initial analysis
        const analysis = await stockService.analyzeStock(symbol);

        // Create or update watchlist item
        const stock = await Stock.findOneAndUpdate(
            { userId: req.user.id, symbol: symbol.toUpperCase() },
            {
                userId: req.user.id,
                symbol: symbol.toUpperCase(),
                lastAnalysis: analysis,
                notes: notes || '',
                addedAt: new Date()
            },
            { upsert: true, new: true }
        );

        res.json(stock);
    } catch (error) {
        console.error('Add to watchlist error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   DELETE /api/stock/watchlist/:symbol
 * @desc    Remove stock from watchlist
 * @access  Private
 */
router.delete('/watchlist/:symbol', authMiddleware, async (req, res) => {
    try {
        const { symbol } = req.params;

        const result = await Stock.findOneAndDelete({
            userId: req.user.id,
            symbol: symbol.toUpperCase()
        });

        if (!result) {
            return res.status(404).json({ error: 'Stock not found in watchlist' });
        }

        res.json({ message: 'Stock removed from watchlist', symbol: symbol.toUpperCase() });
    } catch (error) {
        console.error('Remove from watchlist error:', error);
        res.status(500).json({ error: 'Failed to remove from watchlist' });
    }
});

/**
 * @route   PUT /api/stock/watchlist/:symbol/refresh
 * @desc    Refresh analysis for a watchlist stock
 * @access  Private
 */
router.put('/watchlist/:symbol/refresh', authMiddleware, async (req, res) => {
    try {
        const { symbol } = req.params;

        const analysis = await stockService.analyzeStock(symbol);

        const stock = await Stock.findOneAndUpdate(
            { userId: req.user.id, symbol: symbol.toUpperCase() },
            { lastAnalysis: analysis },
            { new: true }
        );

        if (!stock) {
            return res.status(404).json({ error: 'Stock not found in watchlist' });
        }

        res.json(stock);
    } catch (error) {
        console.error('Refresh analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/stock/screener
 * @desc    Get screener data for top stocks
 * @access  Public
 */
router.get('/screener', async (req, res) => {
    try {
        const screenerData = await stockService.getScreenerStocks();
        res.json(screenerData);
    } catch (error) {
        console.error('Screener route error:', error);
        res.status(500).json({ error: 'Failed to fetch screener data' });
    }
});

/**
 * @route   GET /api/stock/trending
 * @desc    Get trending stocks with quick signals (demo data)
 * @access  Public
 */
router.get('/trending', async (req, res) => {
    try {
        // Popular stocks to analyze
        const trendingSymbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN'];

        const trending = await Promise.all(
            trendingSymbols.map(async (symbol) => {
                try {
                    const analysis = await stockService.analyzeStock(symbol);
                    return {
                        symbol: analysis.symbol,
                        name: analysis.companyOverview.name,
                        price: analysis.currentMarketStatus.currentPrice,
                        change: analysis.currentMarketStatus.changePercent,
                        trend: analysis.currentMarketStatus.trend,
                        recommendation: analysis.recommendation.decision,
                        riskScore: analysis.riskScore.score
                    };
                } catch (error) {
                    return null;
                }
            })
        );

        // Filter out failed requests
        const validTrending = trending.filter(item => item !== null);
        res.json(validTrending);
    } catch (error) {
        console.error('Trending stocks error:', error);
        res.status(500).json({ error: 'Failed to fetch trending stocks' });
    }
});

module.exports = router;
