import { useState, useEffect, useContext } from 'react';
import AuthContext from '../context/AuthContext';
import portfolioApi from '../services/portfolioApi';
import './Portfolio.css';

const Portfolio = () => {
    const { token } = useContext(AuthContext);
    const [holdings, setHoldings] = useState([]);
    const [summary, setSummary] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({
        symbol: '',
        type: 'BUY',
        quantity: '',
        pricePerShare: '',
        notes: ''
    });

    useEffect(() => {
        fetchPortfolioData();
    }, []);

    const fetchPortfolioData = async () => {
        try {
            setLoading(true);
            const [holdingsData, summaryData, transactionsData] = await Promise.all([
                portfolioApi.getHoldings(token),
                portfolioApi.getSummary(token),
                portfolioApi.getTransactions({ limit: 10 }, token)
            ]);
            setHoldings(holdingsData);
            setSummary(summaryData);
            setTransactions(transactionsData.transactions || []);
        } catch (error) {
            console.error('Error fetching portfolio:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await portfolioApi.createTransaction(formData, token);
            setShowAddModal(false);
            setFormData({ symbol: '', type: 'BUY', quantity: '', pricePerShare: '', notes: '' });
            fetchPortfolioData();
        } catch (error) {
            alert(error.message);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Delete this transaction?')) {
            try {
                await portfolioApi.deleteTransaction(id, token);
                fetchPortfolioData();
            } catch (error) {
                alert(error.message);
            }
        }
    };

    const handleRefresh = async (symbol) => {
        try {
            await portfolioApi.updateHolding(symbol, token);
            fetchPortfolioData();
        } catch (error) {
            alert(error.message);
        }
    };

    const handleDeleteHolding = async (symbol) => {
        if (window.confirm(`Are you sure you want to delete all holdings and transactions for ${symbol}? This cannot be undone.`)) {
            try {
                await portfolioApi.deleteHoldings(symbol, token);
                fetchPortfolioData();
            } catch (error) {
                alert(error.message);
            }
        }
    };

    if (loading) {
        return (
            <div className="portfolio-container">
                <div className="loading-state">
                    <div className="loading-spinner-large"></div>
                    <p>Loading Portfolio...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="portfolio-container">
            <div className="portfolio-content">
                <div className="portfolio-header">
                    <h1 className="title">💼 My Portfolio</h1>
                    <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                        + Add Transaction
                    </button>
                </div>

                {/* Portfolio Summary */}
                {summary && (
                    <div className="summary-cards">
                        <div className="summary-card">
                            <div className="card-label">Total Value</div>
                            <div className="card-value">${summary.totalValue.toFixed(2)}</div>
                        </div>
                        <div className="summary-card">
                            <div className="card-label">Total Invested</div>
                            <div className="card-value">${summary.totalInvested.toFixed(2)}</div>
                        </div>
                        <div className={`summary-card ${summary.totalProfitLoss >= 0 ? 'profit' : 'loss'}`}>
                            <div className="card-label">Profit/Loss</div>
                            <div className="card-value">
                                ${summary.totalProfitLoss.toFixed(2)} ({summary.totalProfitLossPercent.toFixed(2)}%)
                            </div>
                        </div>
                        <div className="summary-card">
                            <div className="card-label">Holdings</div>
                            <div className="card-value">{summary.holdingsCount}</div>
                        </div>
                    </div>
                )}

                {/* Holdings Table */}
                <div className="section">
                    <h2>📊 Current Holdings</h2>
                    {holdings.length === 0 ? (
                        <p className="empty-message">No holdings yet. Add your first transaction!</p>
                    ) : (
                        <div className="table-container">
                            <table className="holdings-table">
                                <thead>
                                    <tr>
                                        <th>Symbol</th>
                                        <th>Shares</th>
                                        <th>Avg Price</th>
                                        <th>Current Price</th>
                                        <th>Value</th>
                                        <th>P/L</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {holdings.map((holding) => (
                                        <tr key={holding._id}>
                                            <td className="symbol-cell">{holding.symbol}</td>
                                            <td>{holding.totalShares}</td>
                                            <td>${holding.averageBuyPrice.toFixed(2)}</td>
                                            <td>${holding.currentPrice.toFixed(2)}</td>
                                            <td>${holding.currentValue.toFixed(2)}</td>
                                            <td className={holding.profitLoss >= 0 ? 'profit-text' : 'loss-text'}>
                                                ${holding.profitLoss.toFixed(2)} ({holding.profitLossPercent.toFixed(2)}%)
                                            </td>
                                            <td>
                                                <button
                                                    className="btn-small"
                                                    onClick={() => handleRefresh(holding.symbol)}
                                                >
                                                    🔄
                                                </button>
                                                <button
                                                    className="btn-small btn-delete-holding"
                                                    onClick={() => handleDeleteHolding(holding.symbol)}
                                                    title="Delete Holding"
                                                    style={{ marginLeft: '8px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Recent Transactions */}
                <div className="section">
                    <h2>📝 Recent Transactions</h2>
                    {transactions.length === 0 ? (
                        <p className="empty-message">No transactions yet.</p>
                    ) : (
                        <div className="transactions-list">
                            {transactions.map((txn) => (
                                <div key={txn._id} className="transaction-item">
                                    <div className="txn-main">
                                        <span className={`txn-type ${txn.type.toLowerCase()}`}>{txn.type}</span>
                                        <span className="txn-symbol">{txn.symbol}</span>
                                        <span className="txn-details">
                                            {txn.quantity} shares @ ${txn.pricePerShare.toFixed(2)}
                                        </span>
                                        <span className="txn-total">${txn.totalAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="txn-footer">
                                        <span className="txn-date">
                                            {new Date(txn.transactionDate).toLocaleDateString()}
                                        </span>
                                        <button
                                            className="btn-delete"
                                            onClick={() => handleDelete(txn._id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Transaction Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Add Transaction</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Stock Symbol</label>
                                <input
                                    type="text"
                                    value={formData.symbol}
                                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                                    placeholder="AAPL"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Type</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="BUY">BUY</option>
                                    <option value="SELL">SELL</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Quantity</label>
                                <input
                                    type="number"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                    placeholder="10"
                                    min="0"
                                    step="any"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Price Per Share</label>
                                <input
                                    type="number"
                                    value={formData.pricePerShare}
                                    onChange={(e) => setFormData({ ...formData, pricePerShare: e.target.value })}
                                    placeholder="150.00"
                                    min="0"
                                    step="0.01"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Notes (Optional)</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Add notes..."
                                    rows="3"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Add Transaction
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Portfolio;
