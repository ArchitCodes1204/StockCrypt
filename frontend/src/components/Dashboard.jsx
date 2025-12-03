import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    ArrowRightLeft,
    Wallet,
    Target,
    Settings,
    MessageSquare,
    Bell,
    Search,
    User,
    LogOut,
    Briefcase,
    Eye,
    Filter,
    HelpCircle,
    Menu,
    X,
    TrendingUp,
    TrendingDown,
    MoreHorizontal,
    ChevronDown
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import AuthContext from '../context/AuthContext';
import portfolioApi from '../services/portfolioApi';
import logo from '../assets/logo.png';
import './Dashboard.css';

const Dashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [holdings, setHoldings] = useState([]);
    const [portfolioSummary, setPortfolioSummary] = useState(null);
    const [showAllHoldings, setShowAllHoldings] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'symbol', direction: 'asc' });

    // Mock data for the chart (replace with real historical data if available)
    const chartData = [
        { name: 'Jan', value: 4000 },
        { name: 'Feb', value: 3000 },
        { name: 'Mar', value: 5000 },
        { name: 'Apr', value: 4500 },
        { name: 'May', value: 6000 },
        { name: 'Jun', value: 5500 },
        { name: 'Jul', value: 7000 },
        { name: 'Aug', value: 6500 },
        { name: 'Sep', value: 8000 },
        { name: 'Oct', value: 7500 },
        { name: 'Nov', value: 9000 },
        { name: 'Dec', value: 10000 },
    ];

    // Mock data for donut chart
    const assetAllocation = [
        { name: 'Stocks', value: 65, color: '#4318FF' },
        { name: 'Funds', value: 20, color: '#6AD2FF' },
        { name: 'Bonds', value: 10, color: '#EFF4FB' },
        { name: 'Crypto', value: 5, color: '#FF0080' },
    ];

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const [holdingsData, summaryData] = await Promise.all([
                    portfolioApi.getHoldings(token),
                    portfolioApi.getSummary(token)
                ]);
                setHoldings(holdingsData);
                setPortfolioSummary(summaryData);
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        if (value === undefined || value === null || isNaN(value)) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(value);
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortedHoldings = () => {
        if (!Array.isArray(holdings)) return [];
        const sorted = [...holdings].sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            if (sortConfig.key === 'symbol') {
                return sortConfig.direction === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }

            return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        });
        return showAllHoldings ? sorted : sorted.slice(0, 5);
    };

    if (loading) {
        return (
            <div className="dashboard-layout" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div className="loading-spinner">Loading...</div>
            </div>
        );
    }

    return (
        <div className="dashboard-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="logo">
                        <img src={logo} alt="StockCrypt" className="logo-image" />
                        <span className="logo-text">StockCrypt</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section">
                        <p className="nav-label">MENU</p>
                        <a href="#" className="nav-item active">
                            <LayoutDashboard size={20} />
                            <span>Dashboard</span>
                        </a>
                        <a href="#" className="nav-item" onClick={() => navigate('/portfolio')}>
                            <Wallet size={20} />
                            <span>Portfolio</span>
                        </a>
                        <a href="#" className="nav-item" onClick={() => navigate('/research')}>
                            <ArrowRightLeft size={20} />
                            <span>Research</span>
                        </a>
                        <a href="#" className="nav-item" onClick={() => navigate('/watchlist')}>
                            <Target size={20} />
                            <span>Watchlist</span>
                        </a>
                        <a href="#" className="nav-item" onClick={() => navigate('/screener')}>
                            <TrendingUp size={20} />
                            <span>Screener</span>
                        </a>
                    </div>

                    <div className="nav-section">
                        <p className="nav-label">SETTINGS</p>
                        <a href="#" className="nav-item">
                            <Settings size={20} />
                            <span>Settings</span>
                        </a>
                        <a href="#" className="nav-item">
                            <MessageSquare size={20} />
                            <span>Support</span>
                        </a>
                        <button onClick={logout} className="nav-item logout-btn">
                            <LogOut size={20} />
                            <span>Log Out</span>
                        </button>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                {/* Topbar */}
                <header className="topbar">
                    <div className="search-bar">
                        <Search size={20} className="search-icon" />
                        <input type="text" placeholder="Search stocks, news..." />
                    </div>

                    <div className="topbar-actions">
                        <button className="icon-btn">
                            <Bell size={20} />
                            <span className="notification-dot"></span>
                        </button>
                        <div className="user-profile">
                            <div className="avatar">
                                {user?.username?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className="user-info">
                                <span className="user-name">{user?.username || 'User'}</span>
                                <span className="user-role">Free Plan</span>
                            </div>
                            <ChevronDown size={16} className="chevron" />
                        </div>
                    </div>
                </header>

                {/* Dashboard Content */}
                <div className="content-grid">
                    {/* Stats Row */}
                    <div className="stats-row">
                        {/* Portfolio Value Chart */}
                        <div className="card chart-card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">Portfolio Value</h3>
                                    <div className="value-display">
                                        <span className="current-value">
                                            {portfolioSummary ? formatCurrency(portfolioSummary.totalValue) : '$0.00'}
                                        </span>
                                        <span className={`change-badge ${portfolioSummary?.totalProfitLoss >= 0 ? 'positive' : 'negative'}`}>
                                            {portfolioSummary?.totalProfitLoss >= 0 ? '+' : ''}
                                            {portfolioSummary ? formatCurrency(portfolioSummary.totalProfitLoss) : '$0.00'}
                                            ({portfolioSummary?.totalProfitLossPercent?.toFixed(2) || '0.00'}%)
                                        </span>
                                    </div>
                                </div>
                                <select className="time-select">
                                    <option>Last 12 Months</option>
                                    <option>Last 6 Months</option>
                                    <option>Last 30 Days</option>
                                </select>
                            </div>
                            <div className="chart-container">
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#4318FF" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#4318FF" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E0E5F2" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#A3AED0', fontSize: 12 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#A3AED0', fontSize: 12 }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0px 10px 20px rgba(0,0,0,0.1)' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke="#4318FF"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorValue)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Asset Allocation Donut */}
                        <div className="card donut-card">
                            <div className="card-header">
                                <h3 className="card-title">Asset Allocation</h3>
                                <MoreHorizontal size={20} className="more-icon" />
                            </div>
                            <div className="donut-container">
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={assetAllocation}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {assetAllocation.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="donut-center">
                                    <span className="center-value">100%</span>
                                    <span className="center-label">Assets</span>
                                </div>
                            </div>
                            <div className="legend">
                                {assetAllocation.map((item, index) => (
                                    <div key={index} className="legend-item">
                                        <span className="legend-dot" style={{ backgroundColor: item.color }}></span>
                                        <span className="legend-name">{item.name}</span>
                                        <span className="legend-value">{item.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Holdings Table */}
                    <div className="card table-card">
                        <div className="card-header">
                            <h3 className="card-title">My Portfolio</h3>
                            <button className="btn-view-all" onClick={() => setShowAllHoldings(!showAllHoldings)}>
                                {showAllHoldings ? 'Show Less' : `View All (${holdings.length})`}
                            </button>
                        </div>
                        <div className="table-responsive">
                            <table className="portfolio-table">
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort('symbol')} style={{ cursor: 'pointer' }}>
                                            Asset Name {sortConfig.key === 'symbol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('totalInvested')} style={{ cursor: 'pointer' }}>
                                            Invested {sortConfig.key === 'totalInvested' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('totalShares')} style={{ cursor: 'pointer' }}>
                                            Quantity {sortConfig.key === 'totalShares' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('currentPrice')} style={{ cursor: 'pointer' }}>
                                            Current Price {sortConfig.key === 'currentPrice' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('profitLossPercent')} style={{ cursor: 'pointer' }}>
                                            Change {sortConfig.key === 'profitLossPercent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getSortedHoldings().length > 0 ? (
                                        getSortedHoldings().map((holding) => (
                                            <tr key={holding.symbol}>
                                                <td>
                                                    <div className="asset-info">
                                                        <div className="asset-icon">{holding.symbol.charAt(0)}</div>
                                                        <div>
                                                            <div className="asset-symbol">{holding.symbol}</div>
                                                            <div className="asset-name">Stock</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>{formatCurrency(holding.averageBuyPrice * holding.totalShares)}</td>
                                                <td>{holding.totalShares}</td>
                                                <td>{formatCurrency(holding.currentPrice)}</td>
                                                <td>
                                                    <span className={`status-badge ${holding.profitLoss >= 0 ? 'success' : 'error'}`}>
                                                        {holding.profitLoss >= 0 ? '+' : ''}{holding.profitLossPercent.toFixed(2)}%
                                                    </span>
                                                </td>
                                                <td>
                                                    <button className="btn-action" onClick={() => navigate(`/research?symbol=${holding.symbol}`)}>
                                                        Analyze
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="empty-state">
                                                No holdings found. Start investing!
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
