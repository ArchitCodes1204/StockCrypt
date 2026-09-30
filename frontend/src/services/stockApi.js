import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// '?a=1&b=2' from an object, skipping empty values ('' when nothing is left).
const toQuery = (params) => {
    if (!params || typeof params !== 'object') return '';
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') search.append(key, String(value));
    });
    const text = search.toString();
    return text ? `?${text}` : '';
};

const stockApi = {
    // Analyze a single stock
    analyzeStock: async (symbol) => {
        try {
            const response = await axios.post(`${API_URL}/stock/analyze`, { symbol });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to analyze stock');
        }
    },

    // Compare two stocks
    compareStocks: async (symbol1, symbol2) => {
        try {
            const response = await axios.post(`${API_URL}/stock/compare`, { symbol1, symbol2 });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to compare stocks');
        }
    },

    // Get watchlist (array, newest first). Optional params:
    // { limit, skip, recommendation: 'BUY'|'HOLD'|'SELL', sort: 'newest'|'oldest'|'symbol'|'change' }
    getWatchlist: async (token, params) => {
        try {
            const response = await axios.get(`${API_URL}/stock/watchlist${toQuery(params)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to fetch watchlist');
        }
    },

    // Paged watchlist: { items, total } (total comes from the X-Total-Count header)
    getWatchlistPage: async (token, params) => {
        try {
            const response = await axios.get(`${API_URL}/stock/watchlist${toQuery(params)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const items = Array.isArray(response.data) ? response.data : [];
            const header = Number.parseInt(response.headers?.['x-total-count'], 10);
            return { items, total: Number.isFinite(header) ? header : items.length };
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to fetch watchlist');
        }
    },

    // Add to watchlist
    addToWatchlist: async (symbol, notes, token) => {
        try {
            const response = await axios.post(
                `${API_URL}/stock/watchlist`,
                { symbol, notes },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to add to watchlist');
        }
    },

    // Remove from watchlist
    removeFromWatchlist: async (symbol, token) => {
        try {
            const response = await axios.delete(`${API_URL}/stock/watchlist/${symbol}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to remove from watchlist');
        }
    },

    // Refresh watchlist stock analysis
    refreshWatchlistStock: async (symbol, token) => {
        try {
            const response = await axios.put(
                `${API_URL}/stock/watchlist/${symbol}/refresh`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to refresh analysis');
        }
    },

    // Get trending stocks
    getTrendingStocks: async () => {
        try {
            const response = await axios.get(`${API_URL}/stock/trending`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to fetch trending stocks');
        }
    },

    // Get screener rows: market = 'stocks' (default) | 'crypto'
    getScreenerStocks: async (market = 'stocks') => {
        try {
            const response = await axios.get(`${API_URL}/stock/screener${toQuery({ market })}`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to fetch screener data');
        }
    },

    // Symbol autocomplete: [{ symbol, name, exchange, type }] (max 8). Empty query -> []
    searchSymbols: async (q) => {
        const query = String(q ?? '').trim();
        if (!query) return [];
        try {
            const response = await axios.get(`${API_URL}/stock/search${toQuery({ q: query })}`);
            return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to search symbols');
        }
    },

    // Light quote: { symbol, name, price, change, changePercent, currency, marketState, quoteType }
    getQuote: async (symbol) => {
        try {
            const response = await axios.get(`${API_URL}/stock/quote/${encodeURIComponent(String(symbol ?? '').trim())}`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to fetch quote');
        }
    },
};

export default stockApi;
