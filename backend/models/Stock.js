const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    },
    lastAnalysis: {
        type: Object,
        default: null
    },
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Compound index to ensure user can't add same stock twice
stockSchema.index({ userId: 1, symbol: 1 }, { unique: true });

module.exports = mongoose.model('Stock', stockSchema);
