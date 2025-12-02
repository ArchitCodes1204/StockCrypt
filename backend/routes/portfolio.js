const express = require('express');
const router = express.Router();
const portfolioService = require('../services/portfolioService');
const authMiddleware = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');
const Portfolio = require('../models/Portfolio');

/**
 * @route   POST /api/portfolio/transaction
 * @desc    Create a new transaction (BUY or SELL)
 * @access  Private
 */
router.post('/transaction', authMiddleware, async (req, res) => {
    try {
        const { symbol, type, quantity, pricePerShare, transactionDate, notes } = req.body;

        // Validation
        if (!symbol || !type || !quantity || !pricePerShare) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!['BUY', 'SELL'].includes(type.toUpperCase())) {
            return res.status(400).json({ error: 'Type must be BUY or SELL' });
        }

        if (quantity <= 0 || pricePerShare <= 0) {
            return res.status(400).json({ error: 'Quantity and price must be positive' });
        }

        const transaction = await portfolioService.processTransaction(req.user.userId, {
            symbol,
            type: type.toUpperCase(),
            quantity: parseFloat(quantity),
            pricePerShare: parseFloat(pricePerShare),
            transactionDate,
            notes
        });

        res.status(201).json(transaction);
    } catch (error) {
        console.error('Transaction creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/portfolio/transactions
 * @desc    Get transaction history with pagination and filters
 * @access  Private
 */
router.get('/transactions', authMiddleware, async (req, res) => {
    try {
        const {
            page,
            limit,
            symbol,
            type,
            startDate,
            endDate,
            sortBy,
            sortOrder
        } = req.query;

        const result = await portfolioService.getTransactions(req.user.userId, {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            symbol,
            type,
            startDate,
            endDate,
            sortBy,
            sortOrder
        });

        res.json(result);
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/portfolio/holdings
 * @desc    Get all current holdings
 * @access  Private
 */
router.get('/holdings', authMiddleware, async (req, res) => {
    try {
        const holdings = await portfolioService.getHoldings(req.user.userId);
        res.json(holdings);
    } catch (error) {
        console.error('Get holdings error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/portfolio/summary
 * @desc    Get portfolio summary (total value, P&L, etc.)
 * @access  Private
 */
router.get('/summary', authMiddleware, async (req, res) => {
    try {
        const summary = await portfolioService.getPortfolioSummary(req.user.userId);
        res.json(summary);
    } catch (error) {
        console.error('Get summary error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/portfolio/performance
 * @desc    Get portfolio performance metrics
 * @access  Private
 */
router.get('/performance', authMiddleware, async (req, res) => {
    try {
        const metrics = await portfolioService.getPerformanceMetrics(req.user.userId);
        res.json(metrics);
    } catch (error) {
        console.error('Get performance error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   PUT /api/portfolio/transaction/:id
 * @desc    Update a transaction
 * @access  Private
 */
router.put('/transaction/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity, pricePerShare, notes, transactionDate } = req.body;

        const transaction = await Transaction.findOne({ _id: id, userId: req.user.userId });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Update fields
        if (quantity !== undefined) transaction.quantity = parseFloat(quantity);
        if (pricePerShare !== undefined) transaction.pricePerShare = parseFloat(pricePerShare);
        if (notes !== undefined) transaction.notes = notes;
        if (transactionDate !== undefined) transaction.transactionDate = new Date(transactionDate);

        await transaction.save();

        // Recalculate portfolio
        await portfolioService.updatePortfolio(
            req.user.userId,
            transaction.symbol,
            transaction.type,
            0, // No change in quantity for update
            transaction.pricePerShare
        );

        res.json(transaction);
    } catch (error) {
        console.error('Update transaction error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   PUT /api/portfolio/holdings/:symbol
 * @desc    Update holding (refresh current price)
 * @access  Private
 */
router.put('/holdings/:symbol', authMiddleware, async (req, res) => {
    try {
        const { symbol } = req.params;

        const portfolio = await Portfolio.findOne({
            userId: req.user.userId,
            symbol: symbol.toUpperCase()
        });

        if (!portfolio) {
            return res.status(404).json({ error: 'Holding not found' });
        }

        // Refresh with current price
        const stockService = require('../services/stockService');
        const analysis = await stockService.analyzeStock(symbol);
        const currentPrice = parseFloat(analysis.currentMarketStatus.currentPrice);

        portfolio.calculateMetrics(currentPrice);
        await portfolio.save();

        res.json(portfolio);
    } catch (error) {
        console.error('Update holding error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   DELETE /api/portfolio/transaction/:id
 * @desc    Delete a transaction
 * @access  Private
 */
router.delete('/transaction/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await portfolioService.deleteTransaction(req.user.userId, id);
        res.json(result);
    } catch (error) {
        console.error('Delete transaction error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   DELETE /api/portfolio/holdings/:symbol
 * @desc    Delete all holdings for a symbol (and related transactions)
 * @access  Private
 */
router.delete('/holdings/:symbol', authMiddleware, async (req, res) => {
    try {
        const { symbol } = req.params;
        const userId = req.user.userId;

        // Delete all transactions for this symbol
        await Transaction.deleteMany({ userId, symbol: symbol.toUpperCase() });

        // Delete portfolio entry
        await Portfolio.deleteOne({ userId, symbol: symbol.toUpperCase() });

        res.json({ message: `All holdings and transactions for ${symbol} deleted successfully` });
    } catch (error) {
        console.error('Delete holdings error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/portfolio/holdings/:symbol
 * @desc    Get specific holding details
 * @access  Private
 */
router.get('/holdings/:symbol', authMiddleware, async (req, res) => {
    try {
        const { symbol } = req.params;

        const holding = await Portfolio.findOne({
            userId: req.user.userId,
            symbol: symbol.toUpperCase()
        });

        if (!holding) {
            return res.status(404).json({ error: 'Holding not found' });
        }

        // Get related transactions
        const transactions = await Transaction.find({
            userId: req.user.userId,
            symbol: symbol.toUpperCase()
        }).sort({ transactionDate: -1 });

        res.json({
            holding,
            transactions
        });
    } catch (error) {
        console.error('Get holding details error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
