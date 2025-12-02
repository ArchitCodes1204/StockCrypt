import { useState, useEffect, useContext } from 'react';
import AuthContext from '../context/AuthContext';
import stockApi from '../services/stockApi';
import StockAnalysis from './StockAnalysis';
import './Watchlist.css';

const Watchlist = () => {
    const { user } = useContext(AuthContext);
    const [watchlist, setWatchlist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedStock, setSelectedStock] = useState(null);
    const [refreshing, setRefreshing] = useState(null);

    useEffect(() => {
        if (user) {
            loadWatchlist();
        }
    }, [user]);

    const loadWatchlist = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const data = await stockApi.getWatchlist(token);
            setWatchlist(data);
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async (symbol) => {
        try {
            setRefreshing(symbol);
            const token = localStorage.getItem('token');
            const updated = await stockApi.refreshWatchlistStock(symbol, token);

            setWatchlist(prev => prev.map(item =>
                item.symbol === symbol ? updated : item
            ));
        } catch (err) {
            setError(err.message);
        } finally {
            setRefreshing(null);
        }
    };

    const handleRemove = async (symbol) => {
        if (!confirm(`Remove ${symbol} from watchlist?`)) return;

        try {
            const token = localStorage.getItem('token');
            await stockApi.removeFromWatchlist(symbol, token);
            setWatchlist(prev => prev.filter(item => item.symbol !== symbol));
        } catch (err) {
            setError(err.message);
        }
    };

    const handleViewAnalysis = (stock) => {
        if (stock.lastAnalysis) {
            setSelectedStock(stock.lastAnalysis);
        }
    };

    const getRecommendationClass = (decision) => {
        switch (decision) {
            case 'BUY': return 'rec-buy';
            case 'SELL': return 'rec-sell';
            case 'HOLD':
            default: return 'rec-hold';
        }
    };

    const getTrendEmoji = (trend) => {
        switch (trend) {
            case 'bullish': return '📈';
            case 'bearish': return '📉';
            case 'sideways':
            default: return '➡️';
        }
    };

    if (loading) {
        return (
            <div className="watchlist-container">
                <div className="loading-center">
                    <div className="loading-spinner-large"></div>
                    <p>Loading watchlist...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="watchlist-container">
            <div className="watchlist-content">
                <header className="watchlist-header">
                    <h1 className="title text-blue">⭐ My Watchlist</h1>
                    <p className="subtitle">Track your favorite stocks with live ratings</p>
                </header>

                {error && (
                    <div className="error-message">
                        <span className="error-icon">⚠️</span>
                        {error}
                    </div>
                )}

                {watchlist.length === 0 ? (
                    <div className="empty-watchlist">
                        <div className="empty-icon">📊</div>
                        <h2>Your Watchlist is Empty</h2>
                        <p>Add stocks from the Research page to start tracking</p>
                    </div>
                ) : (
                    <div className="watchlist-grid">
                        {watchlist.map((stock) => (
                            <div key={stock._id} className="watchlist-card">
                                <div className="card-header">
                                    <div>
                                        <h3 className="stock-symbol">{stock.symbol}</h3>
                                        {stock.lastAnalysis && (
                                            <p className="stock-name">
                                                {stock.lastAnalysis.companyOverview.name}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        className="btn-remove"
                                        onClick={() => handleRemove(stock.symbol)}
                                        title="Remove from watchlist"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {stock.lastAnalysis ? (
                                    <>
                                        <div className="stock-info">
                                            <div className="info-row">
                                                <span className="info-label">Price:</span>
                                                <span className="info-value price">
                                                    ${stock.lastAnalysis.currentMarketStatus.currentPrice}
                                                </span>
                                            </div>
                                            <div className="info-row">
                                                <span className="info-label">Change:</span>
                                                <span className={`info-value ${parseFloat(stock.lastAnalysis.currentMarketStatus.change) >= 0 ? 'positive' : 'negative'}`}>
                                                    {stock.lastAnalysis.currentMarketStatus.changePercent}
                                                </span>
                                            </div>
                                            <div className="info-row">
                                                <span className="info-label">Trend:</span>
                                                <span className="info-value trend">
                                                    {getTrendEmoji(stock.lastAnalysis.currentMarketStatus.trend)}{' '}
                                                    {stock.lastAnalysis.currentMarketStatus.trend}
                                                </span>
                                            </div>
                                        </div>

                                        <div className={`recommendation-badge ${getRecommendationClass(stock.lastAnalysis.recommendation.decision)}`}>
                                            {stock.lastAnalysis.recommendation.decision}
                                        </div>

                                        <div className="risk-indicator">
                                            <span className="risk-label">Risk Score:</span>
                                            <span className="risk-value">
                                                {stock.lastAnalysis.riskScore.score}/10
                                            </span>
                                        </div>

                                        <div className="card-actions">
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => handleViewAnalysis(stock)}
                                            >
                                                View Full Report
                                            </button>
                                            <button
                                                className="btn btn-outline btn-sm"
                                                onClick={() => handleRefresh(stock.symbol)}
                                                disabled={refreshing === stock.symbol}
                                            >
                                                {refreshing === stock.symbol ? '⟳' : '🔄'} Refresh
                                            </button>
                                        </div>

                                        <div className="last-updated">
                                            Updated: {new Date(stock.lastAnalysis.timestamp).toLocaleString()}
                                        </div>
                                    </>
                                ) : (
                                    <div className="no-analysis">
                                        <p>No analysis available</p>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => handleRefresh(stock.symbol)}
                                        >
                                            Analyze Now
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedStock && (
                <StockAnalysis
                    analysis={selectedStock}
                    onClose={() => setSelectedStock(null)}
                />
            )}
        </div>
    );
};

export default Watchlist;
