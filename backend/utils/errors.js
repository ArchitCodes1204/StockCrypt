/**
 * Error types that carry an HTTP status, so routes can answer with
 * 404 (unknown symbol) or 502 (market data provider failed) instead of a generic 500.
 */

class NotFoundError extends Error {
    constructor(symbol, message) {
        super(message || `No data found for symbol "${symbol}"`);
        this.name = 'NotFoundError';
        this.status = 404;
        this.symbol = symbol;
    }
}

class UpstreamError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'UpstreamError';
        this.status = 502;
        if (cause) this.cause = cause;
    }
}

class BadRequestError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BadRequestError';
        this.status = 400;
    }
}

/** HTTP status to use for an error (500 for anything unexpected) */
function statusFor(error) {
    return error && Number.isInteger(error.status) ? error.status : 500;
}

module.exports = { NotFoundError, UpstreamError, BadRequestError, statusFor };
