const Transaction = require('../models/Transaction');
const Portfolio = require('../models/Portfolio');
const stockService = require('./stockService');
const { normalizeSymbol } = require('../utils/symbols');
const { isNum, round } = require('../utils/indicators');

// Calendar days covered by each history range
const HISTORY_DAYS = { '1m': 30, '3m': 91, '6m': 182, '1y': 365 };
const HISTORY_RANGES = Object.keys(HISTORY_DAYS);

// Replaying transactions only makes sense once the first one is at least this old
const MIN_DAYS_FOR_REPLAY = 7;

const dateKey = (date) => new Date(date).toISOString().slice(0, 10);
const addDays = (key, days) => {
    const d = new Date(`${key}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return dateKey(d);
};
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

class PortfolioService {
    /**
     * Process a transaction and update portfolio
     */
    async processTransaction(userId, transactionData) {
        const { type, quantity, pricePerShare, transactionDate, notes } = transactionData;
        const symbol = String(transactionData.symbol).trim().toUpperCase();

        // Validate SELL transaction before creating the transaction
        if (type === 'SELL') {
            const portfolio = await Portfolio.findOne({ userId, symbol });
            const currentShares = portfolio ? portfolio.totalShares : 0;

            if (currentShares < quantity) {
                throw new Error(`Insufficient shares. You own ${currentShares} shares of ${symbol}, cannot sell ${quantity}.`);
            }
        }

        // Create transaction record
        const transaction = new Transaction({
            userId,
            symbol,
            type,
            quantity,
            pricePerShare,
            totalAmount: quantity * pricePerShare,
            transactionDate: transactionDate || new Date(),
            notes
        });

        await transaction.save();

        // Update portfolio
        await this.updatePortfolio(userId, symbol, type, quantity, pricePerShare);

        return transaction;
    }

    /**
     * Update portfolio based on transaction
     */
    async updatePortfolio(userId, symbol, type, quantity, pricePerShare) {
        let portfolio = await Portfolio.findOne({ userId, symbol: symbol.toUpperCase() });

        if (!portfolio) {
            portfolio = new Portfolio({
                userId,
                symbol: symbol.toUpperCase(),
                totalShares: 0,
                averageBuyPrice: 0,
                totalInvested: 0
            });
        }

        this.applyTransaction(portfolio, type, quantity, pricePerShare);

        await this.refreshMetrics(portfolio, symbol);
        await portfolio.save();
        return portfolio;
    }

    /**
     * Rebuild a holding from scratch by replaying all of its transactions.
     * Used after a transaction is edited or deleted.
     */
    async recalculatePortfolio(userId, symbol) {
        symbol = symbol.toUpperCase();
        const transactions = await Transaction.find({ userId, symbol }).sort({ transactionDate: 1, createdAt: 1 });

        if (transactions.length === 0) {
            await Portfolio.deleteOne({ userId, symbol });
            return null;
        }

        let portfolio = await Portfolio.findOne({ userId, symbol });
        if (!portfolio) {
            portfolio = new Portfolio({ userId, symbol });
        }
        portfolio.totalShares = 0;
        portfolio.averageBuyPrice = 0;
        portfolio.totalInvested = 0;

        transactions.forEach(t => this.applyTransaction(portfolio, t.type, t.quantity, t.pricePerShare));

        await this.refreshMetrics(portfolio, symbol);
        await portfolio.save();
        return portfolio;
    }

    /**
     * Apply a single BUY/SELL to a holding's share count and cost basis.
     * Works on Portfolio documents and on plain { totalShares, averageBuyPrice, totalInvested } objects.
     */
    applyTransaction(portfolio, type, quantity, pricePerShare) {
        if (type === 'BUY') {
            // Calculate new average buy price
            const newTotalInvested = portfolio.totalInvested + (quantity * pricePerShare);
            const newTotalShares = portfolio.totalShares + quantity;

            portfolio.averageBuyPrice = newTotalShares > 0 ? newTotalInvested / newTotalShares : 0;
            portfolio.totalShares = newTotalShares;
            portfolio.totalInvested = newTotalInvested;
        } else if (type === 'SELL') {
            // Reduce shares
            portfolio.totalShares = Math.max(0, portfolio.totalShares - quantity);

            // Reduce total invested proportionally
            if (portfolio.totalShares === 0) {
                portfolio.totalInvested = 0;
                portfolio.averageBuyPrice = 0;
            } else {
                portfolio.totalInvested = portfolio.totalShares * portfolio.averageBuyPrice;
            }
        }
    }

    /**
     * Update a holding's current price, value and P/L using a light quote
     */
    async refreshMetrics(portfolio, symbol) {
        try {
            const quote = await stockService.getQuote(symbol);
            portfolio.calculateMetrics(quote.price);
        } catch (error) {
            console.error(`Error fetching current price for ${symbol}:`, error.message);
            // Use last known price or average buy price
            portfolio.calculateMetrics(portfolio.currentPrice || portfolio.averageBuyPrice);
        }
    }

    /**
     * Get all holdings for a user with current prices (one batched quote request)
     */
    async getHoldings(userId) {
        const holdings = await Portfolio.find({ userId, totalShares: { $gt: 0 } });
        if (holdings.length === 0) return holdings;

        let quotes = {};
        try {
            quotes = await stockService.getQuotes(holdings.map((h) => h.symbol));
        } catch (error) {
            console.error('Error fetching holding prices:', error.message);
        }

        await Promise.all(holdings.map(async (holding) => {
            const quote = quotes[normalizeSymbol(holding.symbol).display];
            if (!quote || !isNum(quote.price)) {
                // Keep the last known price rather than guessing
                console.error(`No current price for ${holding.symbol}; keeping the last known price`);
                return;
            }
            holding.calculateMetrics(quote.price);
            await holding.save();
        }));

        return holdings;
    }

    /**
     * Get portfolio summary
     */
    async getPortfolioSummary(userId) {
        const holdings = await this.getHoldings(userId);

        const summary = {
            totalValue: 0,
            totalInvested: 0,
            totalProfitLoss: 0,
            totalProfitLossPercent: 0,
            holdingsCount: holdings.length,
            topPerformers: [],
            worstPerformers: []
        };

        holdings.forEach(holding => {
            summary.totalValue += holding.currentValue;
            summary.totalInvested += holding.totalInvested;
            summary.totalProfitLoss += holding.profitLoss;
        });

        summary.totalProfitLossPercent = summary.totalInvested > 0
            ? (summary.totalProfitLoss / summary.totalInvested) * 100
            : 0;

        // Get top and worst performers
        const sortedByPerformance = [...holdings].sort((a, b) => b.profitLossPercent - a.profitLossPercent);
        summary.topPerformers = sortedByPerformance.slice(0, 3);
        summary.worstPerformers = sortedByPerformance.slice(-3).reverse();

        return summary;
    }

    /**
     * Get transaction history with pagination and filters
     */
    async getTransactions(userId, options = {}) {
        const {
            page = 1,
            limit = 20,
            symbol,
            type,
            startDate,
            endDate,
            sortBy = 'transactionDate',
            sortOrder = 'desc'
        } = options;

        const query = { userId };

        // Apply filters
        if (symbol) query.symbol = symbol.toUpperCase();
        if (type) query.type = type;
        if (startDate || endDate) {
            query.transactionDate = {};
            if (startDate) query.transactionDate.$gte = new Date(startDate);
            if (endDate) query.transactionDate.$lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        const [transactions, total] = await Promise.all([
            Transaction.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit),
            Transaction.countDocuments(query)
        ]);

        return {
            transactions,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Calculate portfolio performance over time
     */
    async getPerformanceMetrics(userId) {
        const holdings = await this.getHoldings(userId);
        const transactions = await Transaction.find({ userId }).sort({ transactionDate: 1, createdAt: 1 });

        const metrics = {
            totalReturn: 0,
            totalReturnPercent: 0,
            realizedGains: 0,
            unrealizedGains: 0,
            totalDividends: 0, // Placeholder for future
            bestTrade: null,
            worstTrade: null
        };

        // Realized gains use the same average-cost method as applyTransaction:
        // every sale books (sale price - average cost at that moment) x shares sold.
        const positions = {};
        transactions.forEach(t => {
            const position = positions[t.symbol] || (positions[t.symbol] = { totalShares: 0, averageBuyPrice: 0, totalInvested: 0 });
            if (t.type === 'SELL') {
                const sharesSold = Math.min(t.quantity, position.totalShares);
                metrics.realizedGains += (t.pricePerShare - position.averageBuyPrice) * sharesSold;
            }
            this.applyTransaction(position, t.type, t.quantity, t.pricePerShare);
        });

        // Calculate unrealized gains from current holdings
        holdings.forEach(holding => {
            metrics.unrealizedGains += holding.profitLoss;
        });

        metrics.totalReturn = metrics.realizedGains + metrics.unrealizedGains;

        const totalInvested = holdings.reduce((sum, h) => sum + h.totalInvested, 0);
        metrics.totalReturnPercent = totalInvested > 0 ? (metrics.totalReturn / totalInvested) * 100 : 0;

        return metrics;
    }

    /**
     * Daily portfolio value over a range ('1m' | '3m' | '6m' | '1y').
     *
     * basis 'transactions': replay the user's transactions day by day (same average-cost
     *   math as applyTransaction); value = shares held that day x that day's close.
     * basis 'current-holdings': used while the first transaction is less than 7 days old;
     *   value = current shares x historical closes, invested = current cost basis.
     *
     * Dates are the union of every holding's trading days (crypto trades at weekends),
     * and prices are carried forward over days a market was closed.
     * Values are summed as-is, so holdings in other currencies are not converted.
     */
    async getHistory(userId, range = '1y') {
        const days = HISTORY_DAYS[range];
        if (!days) throw new Error(`range must be one of ${HISTORY_RANGES.join(', ')}`);

        const result = (basis, points = [], unpricedSymbols = []) => {
            const startValue = points.length ? points[0].value : 0;
            const endValue = points.length ? points[points.length - 1].value : 0;
            const change = round(endValue - startValue, 2);
            return {
                range,
                basis,
                currency: 'USD',
                points,
                startValue,
                endValue,
                change,
                changePercent: startValue > 0 ? round((change / startValue) * 100, 2) : 0,
                unpricedSymbols
            };
        };

        const transactions = await Transaction.find({ userId }).sort({ transactionDate: 1, createdAt: 1 }).lean();
        if (transactions.length === 0) return result('current-holdings');

        const today = dateKey(new Date());
        const firstTradeDay = dateKey(transactions[0].transactionDate);
        const basis = daysBetween(firstTradeDay, today) >= MIN_DAYS_FOR_REPLAY ? 'transactions' : 'current-holdings';

        let holdings = [];
        let symbols;
        if (basis === 'transactions') {
            symbols = [...new Set(transactions.map((t) => t.symbol))];
        } else {
            holdings = await Portfolio.find({ userId, totalShares: { $gt: 0 } }).lean();
            if (holdings.length === 0) return result(basis);
            symbols = holdings.map((h) => h.symbol);
        }

        // Daily closes per symbol, with today's live price merged in
        const quotes = await stockService.getQuotes(symbols).catch(() => ({}));
        const series = {};
        const unpriced = [];
        await Promise.all(symbols.map(async (symbol) => {
            try {
                const { points } = await stockService.getDailyCloses(symbol, quotes[normalizeSymbol(symbol).display]);
                if (points.length) series[symbol] = points;
                else unpriced.push(symbol);
            } catch (error) {
                console.warn(`No price history for ${symbol}: ${error.message}`);
                unpriced.push(symbol);
            }
        }));

        // Start at the range start, or at the first trade if that is later
        let start = addDays(today, -days);
        if (basis === 'transactions' && firstTradeDay > start) start = firstTradeDay;

        const dates = [...new Set(Object.values(series).flatMap((points) => points.map((p) => p.date)))]
            .filter((date) => date >= start)
            .sort();
        if (dates.length === 0) return result(basis, [], unpriced);

        // Latest close on or before a date (dates are visited in ascending order)
        const cursor = {};
        const priceOn = (symbol, date) => {
            const points = series[symbol];
            if (!points) return null;
            let i = cursor[symbol] || 0;
            while (i + 1 < points.length && points[i + 1].date <= date) i++;
            cursor[symbol] = i;
            return points[i].close; // before the first bar this uses the first close
        };

        const points = [];
        if (basis === 'transactions') {
            const positions = {};
            let next = 0;
            for (const date of dates) {
                // Apply every transaction made on or before this day
                while (next < transactions.length && dateKey(transactions[next].transactionDate) <= date) {
                    const t = transactions[next++];
                    const position = positions[t.symbol] || (positions[t.symbol] = { totalShares: 0, averageBuyPrice: 0, totalInvested: 0 });
                    this.applyTransaction(position, t.type, t.quantity, t.pricePerShare);
                }

                let value = 0;
                let invested = 0;
                for (const [symbol, position] of Object.entries(positions)) {
                    if (position.totalShares <= 0) continue;
                    // Without any price data, value the position at cost
                    value += position.totalShares * (priceOn(symbol, date) ?? position.averageBuyPrice);
                    invested += position.totalInvested;
                }
                points.push({ date, value: round(value, 2), invested: round(invested, 2) });
            }
        } else {
            const invested = round(holdings.reduce((sum, h) => sum + h.totalInvested, 0), 2);
            for (const date of dates) {
                const value = holdings.reduce((sum, h) => sum + h.totalShares * (priceOn(h.symbol, date) ?? h.averageBuyPrice), 0);
                points.push({ date, value: round(value, 2), invested });
            }
        }

        return result(basis, points, unpriced);
    }

    /**
     * Delete a transaction and recalculate portfolio
     */
    async deleteTransaction(userId, transactionId) {
        const transaction = await Transaction.findOne({ _id: transactionId, userId });

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        // Delete the transaction and rebuild the holding from what's left
        await Transaction.deleteOne({ _id: transactionId });
        await this.recalculatePortfolio(userId, transaction.symbol);

        return { message: 'Transaction deleted successfully' };
    }
}

const service = new PortfolioService();
service.HISTORY_RANGES = HISTORY_RANGES;

module.exports = service;
