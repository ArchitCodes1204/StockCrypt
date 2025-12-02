import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import stockApi from '../services/stockApi';
import './Screener.css';

const Screener = () => {
    const navigate = useNavigate();
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'marketCap', direction: 'desc' });
    const [filterText, setFilterText] = useState('');

    useEffect(() => {
        fetchScreenerData();
    }, []);

    const fetchScreenerData = async () => {
        try {
            setLoading(true);
            const data = await stockApi.getScreenerStocks();
            setStocks(data);
        } catch (err) {
            setError('Failed to load screener data. Please try again later.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const getSortedStocks = () => {
        let sorted = [...stocks];

        if (filterText) {
            sorted = sorted.filter(stock =>
                stock.symbol.toLowerCase().includes(filterText.toLowerCase()) ||
                stock.name.toLowerCase().includes(filterText.toLowerCase())
            );
        }

        return sorted.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    };

    const formatNumber = (num) => {
        if (!num) return '-';
        if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        return num.toLocaleString();
    };

    const getTechnicalRatingClass = (rating) => {
        switch (rating) {
            case 'Strong Buy': return 'rating-strong-buy';
            case 'Buy': return 'rating-buy';
            case 'Sell': return 'rating-sell';
            default: return 'rating-neutral';
        }
    };

    if (loading) {
        return (
            <div className="screener-container">
                <div className="loading-state">
                    <div className="loading-spinner-large"></div>
                    <p>Loading Market Data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="screener-container">
            <div className="screener-content">
                <div className="screener-header">
                    <div>
                        <h1 className="title">🔍 Stock Screener</h1>
                        <p className="subtitle">Real-time market data for top companies</p>
                    </div>
                    <div className="screener-controls">
                        <input
                            type="text"
                            placeholder="Search Ticker..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="search-input"
                        />
                        <button className="btn-refresh" onClick={fetchScreenerData}>
                            🔄 Refresh
                        </button>
                    </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="table-container">
                    <table className="screener-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('symbol')}>Ticker {sortConfig.key === 'symbol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th onClick={() => handleSort('price')}>Price {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th onClick={() => handleSort('changePercent')}>Chg % {sortConfig.key === 'changePercent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th onClick={() => handleSort('change')}>Chg {sortConfig.key === 'change' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th onClick={() => handleSort('technicalRating')}>Technical Rating {sortConfig.key === 'technicalRating' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th onClick={() => handleSort('volume')}>Vol {sortConfig.key === 'volume' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th onClick={() => handleSort('marketCap')}>Mkt Cap {sortConfig.key === 'marketCap' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th onClick={() => handleSort('peRatio')}>P/E {sortConfig.key === 'peRatio' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th>EPS (TTM)</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {getSortedStocks().map((stock) => (
                                <tr key={stock.symbol} onClick={() => navigate('/research', { state: { symbol: stock.symbol } })}>
                                    <td className="ticker-cell">
                                        <div className="symbol">{stock.symbol}</div>
                                        <div className="name">{stock.name}</div>
                                    </td>
                                    <td className="price-cell">${stock.price?.toFixed(2)}</td>
                                    <td className={`change-cell ${stock.changePercent >= 0 ? 'positive' : 'negative'}`}>
                                        {stock.changePercent > 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                                    </td>
                                    <td className={`change-cell ${stock.change >= 0 ? 'positive' : 'negative'}`}>
                                        {stock.change > 0 ? '+' : ''}{stock.change?.toFixed(2)}
                                    </td>
                                    <td>
                                        <span className={`technical-rating ${getTechnicalRatingClass(stock.technicalRating)}`}>
                                            {stock.technicalRating}
                                        </span>
                                    </td>
                                    <td>{formatNumber(stock.volume)}</td>
                                    <td>${formatNumber(stock.marketCap)}</td>
                                    <td>{stock.peRatio ? stock.peRatio.toFixed(2) : '-'}</td>
                                    <td>{stock.eps ? stock.eps.toFixed(2) : '-'}</td>
                                    <td>
                                        <button
                                            className="btn-analyze"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('/research', { state: { symbol: stock.symbol } });
                                            }}
                                        >
                                            Analyze
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Screener;
