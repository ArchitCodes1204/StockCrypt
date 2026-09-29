import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import stockApi from '../services/stockApi';
import StockAnalysis from './StockAnalysis';
import './Research.css';

const Research = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [symbol, setSymbol] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const runAnalysis = async (target) => {
        setLoading(true);
        setError('');
        setAnalysis(null);

        try {
            const result = await stockApi.analyzeStock(target);
            setAnalysis(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Auto-analyze when opened from the Screener (router state) or Dashboard (?symbol=)
    useEffect(() => {
        const incoming = location.state?.symbol || new URLSearchParams(location.search).get('symbol');
        if (incoming) {
            setSymbol(incoming.toUpperCase());
            runAnalysis(incoming);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.key]);

    const handleAnalyze = async (e) => {
        e.preventDefault();

        if (!symbol.trim()) {
            setError('Please enter a stock symbol');
            return;
        }

        runAnalysis(symbol);
    };

    const handleAddToWatchlist = () =>
        stockApi.addToWatchlist(analysis.symbol, '', localStorage.getItem('token'));

    return (
        <div className="research-container">
            <div className="research-content">
                <header className="research-header">
                    <div className="header-left-research">
                        <button className="btn-back-research" onClick={() => navigate('/dashboard')}>
                            ← Back to Dashboard
                        </button>
                        <div>
                            <h1 className="title text-blue">📊 Stock Research</h1>
                            <p className="subtitle">AI-Powered Stock Analysis & Insights</p>
                        </div>
                    </div>
                </header>

                <div className="search-section">
                    <form onSubmit={handleAnalyze} className="search-form">
                        <div className="search-input-group">
                            <input
                                type="text"
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                placeholder="Enter stock symbol (e.g., AAPL, MSFT, GOOGL)"
                                className="search-input"
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                className="btn btn-primary search-btn"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner"></span>
                                        Analyzing...
                                    </>
                                ) : (
                                    'Analyze Stock'
                                )}
                            </button>
                        </div>
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
                        <p>Analyzing {symbol}...</p>
                        <p className="loading-subtext">Fetching market data and calculating indicators</p>
                    </div>
                )}

                {!loading && !analysis && !error && (
                    <div className="empty-state">
                        <div className="empty-icon">🔍</div>
                        <h2>Start Your Analysis</h2>
                        <p>Enter a stock symbol above to get comprehensive AI-powered insights</p>
                        <div className="popular-stocks">
                            <p>Popular stocks:</p>
                            <div className="stock-chips">
                                {['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN', 'NVDA'].map((stock) => (
                                    <button
                                        key={stock}
                                        className="stock-chip"
                                        onClick={() => setSymbol(stock)}
                                    >
                                        {stock}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {analysis && !loading && (
                <StockAnalysis
                    analysis={analysis}
                    onClose={() => setAnalysis(null)}
                    onAddToWatchlist={handleAddToWatchlist}
                />
            )}
        </div>
    );
};

export default Research;
