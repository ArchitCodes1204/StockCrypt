const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
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
    type: {
        type: String,
        enum: ['BUY', 'SELL'],
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    pricePerShare: {
        type: Number,
        required: true,
        min: 0
    },
    totalAmount: {
        type: Number,
        required: true
    },
    transactionDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    notes: {
        type: String,
        maxlength: 500
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient querying
transactionSchema.index({ userId: 1, symbol: 1 });
transactionSchema.index({ userId: 1, transactionDate: -1 });

// Calculate total amount before saving
transactionSchema.pre('save', function (next) {
    this.totalAmount = this.quantity * this.pricePerShare;
    next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
