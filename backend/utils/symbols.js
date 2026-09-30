/**
 * Ticker symbol helpers.
 *
 * Users type share classes with a dot (BRK.B) but Yahoo Finance uses a dash (BRK-B).
 * Exchange suffixes keep their dot (RELIANCE.NS, TCS.NS, VOD.L), and crypto pairs
 * already use a dash (BTC-USD).
 */

// Single-letter Yahoo exchange suffixes that must NOT be turned into share classes:
// London (.L), Tokyo (.T), Frankfurt (.F), TSX Venture (.V)
const ONE_LETTER_EXCHANGES = new Set(['L', 'T', 'F', 'V']);

// Letters, digits and the punctuation Yahoo uses in symbols (^GSPC, BTC-USD, M&M.NS, GC=F)
const VALID_SYMBOL = /^[A-Z0-9^][A-Z0-9.\-=^&]{0,19}$/;

/**
 * Normalize user input into the symbol we show and the symbol we send to Yahoo.
 * @returns {{ display: string, yahoo: string, valid: boolean }}
 */
function normalizeSymbol(input) {
    const display = String(input ?? '').trim().toUpperCase();

    let yahoo = display;
    const shareClass = display.match(/^([A-Z]+)\.([A-Z])$/);
    if (shareClass && !ONE_LETTER_EXCHANGES.has(shareClass[2])) {
        yahoo = `${shareClass[1]}-${shareClass[2]}`;
    }

    return { display, yahoo, valid: VALID_SYMBOL.test(display) };
}

module.exports = { normalizeSymbol };
