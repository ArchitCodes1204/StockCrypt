import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const portfolioApi = {
    // Create transaction
    createTransaction: async (transactionData, token) => {
        try {
            const response = await axios.post(
                `${API_URL}/portfolio/transaction`,
                transactionData,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to create transaction');
        }
    },

    // Get transactions with pagination and filters
    getTransactions: async (filters, token) => {
        try {
            const params = new URLSearchParams(filters).toString();
            const response = await axios.get(
                `${API_URL}/portfolio/transactions?${params}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to fetch transactions');
        }
    },

    // Get all holdings
    getHoldings: async (token) => {
        try {
            const response = await axios.get(
                `${API_URL}/portfolio/holdings`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to fetch holdings');
        }
    },

    // Get portfolio summary
    getSummary: async (token) => {
        try {
            const response = await axios.get(
                `${API_URL}/portfolio/summary`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to fetch summary');
        }
    },

    // Get performance metrics
    getPerformance: async (token) => {
        try {
            const response = await axios.get(
                `${API_URL}/portfolio/performance`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to fetch performance');
        }
    },

    // Update transaction
    updateTransaction: async (id, updates, token) => {
        try {
            const response = await axios.put(
                `${API_URL}/portfolio/transaction/${id}`,
                updates,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to update transaction');
        }
    },

    // Update holding (refresh price)
    updateHolding: async (symbol, token) => {
        try {
            const response = await axios.put(
                `${API_URL}/portfolio/holdings/${symbol}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to update holding');
        }
    },

    // Delete transaction
    deleteTransaction: async (id, token) => {
        try {
            const response = await axios.delete(
                `${API_URL}/portfolio/transaction/${id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to delete transaction');
        }
    },

    // Delete all holdings for a symbol
    deleteHoldings: async (symbol, token) => {
        try {
            const response = await axios.delete(
                `${API_URL}/portfolio/holdings/${symbol}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to delete holdings');
        }
    },

    // Get specific holding details
    getHoldingDetails: async (symbol, token) => {
        try {
            const response = await axios.get(
                `${API_URL}/portfolio/holdings/${symbol}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to fetch holding details');
        }
    }
};

export default portfolioApi;
