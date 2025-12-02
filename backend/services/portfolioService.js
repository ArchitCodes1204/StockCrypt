const Transaction = require('../models/Transaction');
const Portfolio = require('../models/Portfolio');
const stockService = require('./stockService');

class PortfolioService {
    /**
     * Process a transaction and update portfolio
     */
    async processTransaction(userId, transactionData) {
        const { symbol, type, quantity, pricePerShare, transactionDate, notes } = transactionData;

        // Create transaction record
        const transaction = new Transaction({
            userId,
            symbol: symbol.toUpperCase(),
            type,
            quantity,
            pricePerShare,
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

        // Get current price and calculate metrics
        try {
            const analysis = await stockService.analyzeStock(symbol);
            const currentPrice = parseFloat(analysis.currentMarketStatus.currentPrice);
            portfolio.calculateMetrics(currentPrice);
        } catch (error) {
            console.error('Error fetching current price:', error.message);
            // Use last known price or average buy price
            portfolio.calculateMetrics(portfolio.currentPrice || portfolio.averageBuyPrice);
        }

        await portfolio.save();
        return portfolio;
    }

    /**
     * Get all holdings for a user with current prices
     */
    async getHoldings(userId) {
        const holdings = await Portfolio.find({ userId, totalShares: { $gt: 0 } });

        // Update all holdings with current prices
        const updatedHoldings = await Promise.all(
            holdings.map(async (holding) => {
                try {
                    const analysis = await stockService.analyzeStock(holding.symbol);
                    const currentPrice = parseFloat(analysis.currentMarketStatus.currentPrice);
                    holding.calculateMetrics(currentPrice);
                    await holding.save();
                } catch (error) {
                    console.error(`Error updating ${holding.symbol}:`, error.message);
                }
                return holding;
            })
        );

        return updatedHoldings;
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
        const transactions = await Transaction.find({ userId }).sort({ transactionDate: 1 });

        const metrics = {
            totalReturn: 0,
            totalReturnPercent: 0,
            realizedGains: 0,
            unrealizedGains: 0,
            totalDividends: 0, // Placeholder for future
            bestTrade: null,
            worstTrade: null
        };

        // Calculate realized gains from sell transactions
        const sellTransactions = transactions.filter(t => t.type === 'SELL');
        sellTransactions.forEach(sell => {
            // Find corresponding buy transactions (simplified - uses average)
            const buyTransactions = transactions.filter(
                t => t.type === 'BUY' && t.symbol === sell.symbol && t.transactionDate < sell.transactionDate
            );

            if (buyTransactions.length > 0) {
                const avgBuyPrice = buyTransactions.reduce((sum, t) => sum + t.pricePerShare, 0) / buyTransactions.length;
                const realizedGain = (sell.pricePerShare - avgBuyPrice) * sell.quantity;
                metrics.realizedGains += realizedGain;
            }
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
     * Delete a transaction and recalculate portfolio
     */
    async deleteTransaction(userId, transactionId) {
        const transaction = await Transaction.findOne({ _id: transactionId, userId });

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        const { symbol, type, quantity, pricePerShare } = transaction;

        // Delete the transaction
        await Transaction.deleteOne({ _id: transactionId });

        // Reverse the transaction effect on portfolio
        const reverseType = type === 'BUY' ? 'SELL' : 'BUY';
        await this.updatePortfolio(userId, symbol, reverseType, quantity, pricePerShare);

        return { message: 'Transaction deleted successfully' };
    }
}

module.exports = new PortfolioService();
