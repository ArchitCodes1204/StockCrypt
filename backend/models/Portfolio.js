const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    totalShares: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    averageBuyPrice: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    totalInvested: {
        type: Number,
        required: true,
        default: 0
    },
    currentPrice: {
        type: Number,
        default: 0
    },
    currentValue: {
        type: Number,
        default: 0
    },
    profitLoss: {
        type: Number,
        default: 0
    },
    profitLossPercent: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Unique constraint: one portfolio entry per user per symbol
portfolioSchema.index({ userId: 1, symbol: 1 }, { unique: true });

// Calculate current value and P/L
portfolioSchema.methods.calculateMetrics = function (currentPrice) {
    this.currentPrice = currentPrice;
    this.currentValue = this.totalShares * currentPrice;
    this.profitLoss = this.currentValue - this.totalInvested;
    this.profitLossPercent = this.totalInvested > 0
        ? (this.profitLoss / this.totalInvested) * 100
        : 0;
    this.lastUpdated = new Date();
};

module.exports = mongoose.model('Portfolio', portfolioSchema);
