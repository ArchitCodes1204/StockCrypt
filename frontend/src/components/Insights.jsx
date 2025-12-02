import { useState } from 'react';
import stockApi from '../services/stockApi';
import './Insights.css';

const Insights = () => {
    const [symbol1, setSymbol1] = useState('');
    const [symbol2, setSymbol2] = useState('');
    const [comparison, setComparison] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCompare = async (e) => {
        e.preventDefault();

        if (!symbol1.trim() || !symbol2.trim()) {
            setError('Please enter both stock symbols');
            return;
        }

        if (symbol1.toUpperCase() === symbol2.toUpperCase()) {
            setError('Please enter different stock symbols');
            return;
        }

        setLoading(true);
        setError('');
        setComparison(null);

        try {
            const result = await stockApi.compareStocks(symbol1, symbol2);
            setComparison(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
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

    const ComparisonCard = ({ stock, position }) => (
        <div className={`comparison-stock ${position}`}>
            <div className="stock-header">
                <h2>{stock.symbol}</h2>
                <p className="stock-company">{stock.companyOverview.name}</p>
            </div>

            <div className="stock-metrics">
                <div className="metric-group">
                    <h3>Current Price</h3>
                    <div className="metric-value price">
                        ${stock.currentMarketStatus.currentPrice}
                    </div>
                    <div className={`metric-change ${parseFloat(stock.currentMarketStatus.change) >= 0 ? 'positive' : 'negative'}`}>
                        {stock.currentMarketStatus.changePercent}
                    </div>
                </div>

                <div className="metric-group">
                    <h3>Recommendation</h3>
                    <div className={`recommendation-badge ${getRecommendationClass(stock.recommendation.decision)}`}>
                        {stock.recommendation.decision}
                    </div>
                    <div className="confidence">{stock.recommendation.confidence} Confidence</div>
                </div>

                <div className="metric-group">
                    <h3>1-Year Performance</h3>
                    <div className={`metric-value ${parseFloat(stock.yearPerformance.percentChange) >= 0 ? 'positive' : 'negative'}`}>
                        {stock.yearPerformance.percentChange}%
                    </div>
                </div>

                <div className="metric-group">
                    <h3>Risk Score</h3>
                    <div className="risk-score">
                        {stock.riskScore.score}/10
                    </div>
                    <div className="risk-level">{stock.riskScore.level}</div>
                </div>

                <div className="metric-group">
                    <h3>Trend</h3>
                    <div className="trend-value">
                        {stock.currentMarketStatus.trend === 'bullish' && '📈'}
                        {stock.currentMarketStatus.trend === 'bearish' && '📉'}
                        {stock.currentMarketStatus.trend === 'sideways' && '➡️'}
                        {' '}{stock.currentMarketStatus.trend.toUpperCase()}
                    </div>
                </div>

                <div className="metric-group">
                    <h3>Sector</h3>
                    <div className="sector-value">{stock.companyOverview.sector}</div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="insights-container">
            <div className="insights-content">
                <header className="insights-header">
                    <h1 className="title text-blue">🔍 Stock Insights</h1>
                    <p className="subtitle">Compare Two Stocks Side-by-Side</p>
                </header>

                <div className="compare-section">
                    <form onSubmit={handleCompare} className="compare-form">
                        <div className="input-row">
                            <div className="input-group">
                                <label htmlFor="stock1">Stock 1</label>
                                <input
                                    id="stock1"
                                    type="text"
                                    value={symbol1}
                                    onChange={(e) => setSymbol1(e.target.value.toUpperCase())}
                                    placeholder="e.g., AAPL"
                                    className="stock-input"
                                    disabled={loading}
                                />
                            </div>

                            <div className="vs-divider">
                                <span>VS</span>
                            </div>

                            <div className="input-group">
                                <label htmlFor="stock2">Stock 2</label>
                                <input
                                    id="stock2"
                                    type="text"
                                    value={symbol2}
                                    onChange={(e) => setSymbol2(e.target.value.toUpperCase())}
                                    placeholder="e.g., MSFT"
                                    className="stock-input"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary compare-btn"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner"></span>
                                    Comparing...
                                </>
                            ) : (
                                'Compare Stocks'
                            )}
                        </button>
                    </form>

                    {error && (
                        <div className="error-message">
                            <span className="error-icon">⚠️</span>
                            {error}
                        </div>
                    )}
                </div>

                {loading && (
                    <div className="loading-state">
                        <div className="loading-spinner-large"></div>
                        <p>Comparing {symbol1} vs {symbol2}...</p>
                    </div>
                )}

                {comparison && !loading && (
                    <>
                        <div className="comparison-results">
                            <ComparisonCard stock={comparison.stock1} position="left" />
                            <ComparisonCard stock={comparison.stock2} position="right" />
                        </div>

                        <div className="comparison-summary">
                            <h2>📊 Comparison Summary</h2>
                            <div className="summary-grid">
                                <div className="summary-card">
                                    <div className="summary-icon">🏆</div>
                                    <div className="summary-title">Better Performance</div>
                                    <div className="summary-value">
                                        {comparison.comparison.performance.winner}
                                    </div>
                                    <div className="summary-detail">
                                        {comparison.comparison.performance.difference} difference
                                    </div>
                                </div>

                                <div className="summary-card">
                                    <div className="summary-icon">🛡️</div>
                                    <div className="summary-title">Lower Risk</div>
                                    <div className="summary-value">
                                        {comparison.comparison.risk.lowerRisk}
                                    </div>
                                    <div className="summary-detail">
                                        {comparison.comparison.risk.scoreDifference} points safer
                                    </div>
                                </div>

                                <div className="summary-card">
                                    <div className="summary-icon">💡</div>
                                    <div className="summary-title">Stronger Recommendation</div>
                                    <div className="summary-value">
                                        {comparison.comparison.recommendation.stronger !== 'Equal'
                                            ? comparison.comparison.recommendation.stronger
                                            : 'Tied'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {!comparison && !loading && !error && (
                    <div className="empty-state">
                        <div className="empty-icon">📊</div>
                        <h2>Ready to Compare</h2>
                        <p>Enter two stock symbols above to see side-by-side analysis</p>
                        <div className="popular-pairs">
                            <p>Popular comparisons:</p>
                            <div className="pair-chips">
                                <button
                                    className="pair-chip"
                                    onClick={() => {
                                        setSymbol1('AAPL');
                                        setSymbol2('MSFT');
                                    }}
                                >
                                    AAPL vs MSFT
                                </button>
                                <button
                                    className="pair-chip"
                                    onClick={() => {
                                        setSymbol1('GOOGL');
                                        setSymbol2('META');
                                    }}
                                >
                                    GOOGL vs META
                                </button>
                                <button
                                    className="pair-chip"
                                    onClick={() => {
                                        setSymbol1('TSLA');
                                        setSymbol2('NVDA');
                                    }}
                                >
                                    TSLA vs NVDA
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Insights;
