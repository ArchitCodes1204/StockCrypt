/**
 * Formatting helpers for the string fields the frontend has always received
 * (prices, percentages, market cap) and for the sentences in the analysis.
 */
const { isNum, priceDecimals } = require('./indicators');

// Yahoo quotes some exchanges in minor units (pence, cents, agorot). Prices get a
// suffix ("245.60p"); market caps are reported in the major currency.
const MINOR_UNITS = { GBp: 'p', GBX: 'p', ZAc: 'c', ILA: ' ag.' };
const MAJOR_CURRENCY = { GBp: 'GBP', GBX: 'GBP', ZAc: 'ZAR', ILA: 'ILS' };

/** Currency symbol for an ISO code: USD -> "$", INR -> "₹", unknown -> "XYZ " */
function currencySymbol(currency = 'USD') {
    if (MINOR_UNITS[currency]) return '';
    try {
        const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency }).formatToParts(1);
        const symbol = parts.find((p) => p.type === 'currency');
        // Currencies without a symbol come back as their code ("CHF"): add a space
        return symbol && symbol.value !== currency ? symbol.value : `${currency} `;
    } catch {
        return `${currency} `;
    }
}

/** "$1,234.56", "₹1,182.00", "245.60p" */
function formatMoney(value, currency = 'USD') {
    if (!isNum(value)) return 'N/A';
    const decimals = priceDecimals(value);
    const number = Math.abs(value).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
    const sign = value < 0 ? '-' : '';
    if (MINOR_UNITS[currency]) return `${sign}${number}${MINOR_UNITS[currency]}`;
    return `${sign}${currencySymbol(currency)}${number}`;
}

/** "$3.78T", "$512.40B", "N/A" */
function formatCompactMoney(value, currency = 'USD') {
    if (!isNum(value)) return 'N/A';
    const abs = Math.abs(value);
    const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    const [divisor, suffix] = units.find(([d]) => abs >= d) || [1, ''];
    const symbol = currencySymbol(MAJOR_CURRENCY[currency] || currency);
    return `${value < 0 ? '-' : ''}${symbol}${(abs / divisor).toFixed(2)}${suffix}`;
}

/** "1.2M" style number for volumes */
function formatCompactNumber(value) {
    if (!isNum(value)) return 'N/A';
    const abs = Math.abs(value);
    const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    const found = units.find(([d]) => abs >= d);
    return found ? `${(value / found[0]).toFixed(1)}${found[1]}` : String(Math.round(value));
}

/** Fixed-decimal string, or "N/A" */
function fixed(value, decimals = 2) {
    return isNum(value) ? value.toFixed(decimals) : 'N/A';
}

/** Signed number string: "+1.2", "-3.4", "0.0" */
function signed(value, decimals = 1) {
    if (!isNum(value)) return 'N/A';
    const text = value.toFixed(decimals);
    return value > 0 && Number(text) !== 0 ? `+${text}` : text;
}

/** Signed percent string used by the legacy changePercent field: "+0.42%", "-1.35%" */
function signedPercent(value, decimals = 2) {
    if (!isNum(value)) return 'N/A';
    const text = Math.abs(value).toFixed(decimals);
    return `${value < 0 && Number(text) !== 0 ? '-' : '+'}${text}%`;
}

module.exports = {
    currencySymbol,
    formatMoney,
    formatCompactMoney,
    formatCompactNumber,
    fixed,
    signed,
    signedPercent
};
