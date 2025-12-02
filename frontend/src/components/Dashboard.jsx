import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import stockApi from '../services/stockApi';
import './Dashboard.css';

const Dashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [watchlistCount, setWatchlistCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const watchlist = await stockApi.getWatchlist(token);
                setWatchlistCount(watchlist.length);
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-content">
                <header className="dashboard-header">
                    <h1 className="title text-blue" style={{ marginBottom: 0, textAlign: 'left' }}>StockCrypt Dashboard</h1>
                    <button onClick={logout} className="btn-logout">
                        Logout
                    </button>
                </header>

                <div className="welcome-section card">
                    <h2 className="title" style={{ fontSize: '1.5rem', textAlign: 'left' }}>Welcome, {user?.username}!</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Your AI-powered stock analysis platform. Explore research, manage your watchlist, and compare stocks.
                    </p>
                </div>

                {/* Navigation Cards */}
                <div className="nav-cards">
                    <div className="nav-card" onClick={() => navigate('/research')}>
                        <div className="nav-card-icon">🔍</div>
                        <h3>Stock Research</h3>
                        <p>Analyze any stock with AI-powered insights and recommendations</p>
                        <button className="btn-primary">Start Research</button>
                    </div>

                    <div className="nav-card" onClick={() => navigate('/portfolio')}>
                        <div className="nav-card-icon">💼</div>
                        <h3>My Portfolio</h3>
                        <p>Track your investments, view P&L, and manage transactions</p>
                        <button className="btn-primary">View Portfolio</button>
                    </div>

                    <div className="nav-card" onClick={() => navigate('/watchlist')}>
                        <div className="nav-card-icon">⭐</div>
                        <h3>My Watchlist</h3>
                        <p>Monitor your favorite stocks with auto-updating ratings</p>
                        <div className="watchlist-badge">{watchlistCount} Stocks</div>
                        <button className="btn-primary">View Watchlist</button>
                    </div>

                    <div className="nav-card" onClick={() => navigate('/insights')}>
                        <div className="nav-card-icon">📊</div>
                        <h3>Stock Insights</h3>
                        <p>Compare stocks side-by-side to make informed decisions</p>
                        <button className="btn-primary">Compare Stocks</button>
                    </div>

                    <div className="nav-card" onClick={() => navigate('/screener')}>
                        <div className="nav-card-icon">⚡</div>
                        <h3>Stock Screener</h3>
                        <p>Filter and find top performing stocks with real-time data</p>
                        <button className="btn-primary">Open Screener</button>
                    </div>
                </div>

                {/* Features Overview */}
                <div className="features-section">
                    <h2 className="section-title">What You Get</h2>
                    <div className="features-grid">
                        <div className="feature-item">
                            <div className="feature-icon">✅</div>
                            <h4>Buy/Hold/Sell Recommendations</h4>
                            <p>AI-driven decisions with confidence levels</p>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">📈</div>
                            <h4>Performance Analysis</h4>
                            <p>1-year historical data with volatility insights</p>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">⚠️</div>
                            <h4>Risk Assessment</h4>
                            <p>1-10 risk scoring based on market conditions</p>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">🔮</div>
                            <h4>Growth Forecasts</h4>
                            <p>Short and long-term predictions</p>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">💡</div>
                            <h4>Investment Suitability</h4>
                            <p>Tailored for your investor profile</p>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">📰</div>
                            <h4>Sentiment Analysis</h4>
                            <p>Market sentiment and news insights</p>
                        </div>
                    </div>
                </div
                >
            </div>
        </div>
    );
};

export default Dashboard;
