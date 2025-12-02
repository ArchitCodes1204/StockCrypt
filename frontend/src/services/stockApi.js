import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

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

    // Get watchlist
    getWatchlist: async (token) => {
        try {
            const response = await axios.get(`${API_URL}/stock/watchlist`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
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

    // Get screener stocks
    getScreenerStocks: async () => {
        try {
            const response = await axios.get(`${API_URL}/stock/screener`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to fetch screener data');
        }
    },
};

export default stockApi;
