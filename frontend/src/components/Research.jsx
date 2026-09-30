import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Activity, History, LineChart, Newspaper, SearchX, ShieldAlert, Target } from 'lucide-react';
import stockApi from '../services/stockApi';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Card, ErrorState, PageHeader, SymbolSearch, cx } from './ui';
import { symbolColor } from '../utils/format';
import StockAnalysis from './StockAnalysis';
import StockAnalysisSkeleton from './StockAnalysisSkeleton';
import './Research.css';

const POPULAR = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'BTC-USD', 'ETH-USD', 'RELIANCE.NS'];
const RECENT_KEY = 'sc-recent-searches';
const RECENT_MAX = 6;

const FEATURES = [
    { icon: LineChart, title: 'Price and key stats', text: 'A year of daily closes, the 52-week range, valuation and volume.' },
    { icon: Target, title: 'Rule-based verdict', text: 'BUY, HOLD or SELL from six technical signals, with every point shown.' },
    { icon: ShieldAlert, title: 'Risk score', text: 'A 1 to 10 score built from volatility, drawdown and beta.' },
    { icon: Newspaper, title: 'News sentiment', text: 'Recent Yahoo Finance headlines, each tagged positive, neutral or negative.' }
];

const normalize = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');

function readRecent() {
    try {
        const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        return Array.isArray(parsed)
            ? parsed.map(normalize).filter(Boolean).filter((s, i, list) => list.indexOf(s) === i).slice(0, RECENT_MAX)
            : [];
    } catch {
        return [];
    }
}

function writeRecent(list) {
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {
        /* storage unavailable (private mode): recent searches just are not kept */
    }
}

// One request per symbol + attempt, shared by StrictMode's double effect run.
const inflight = new Map();
function analyzeOnce(symbol, attempt) {
    const key = `${symbol}|${attempt}`;
    if (!inflight.has(key)) {
        const request = stockApi.analyzeStock(symbol).finally(() => {
            setTimeout(() => inflight.delete(key), 0);
        });
        inflight.set(key, request);
    }
    return inflight.get(key);
}

function ChipList({ symbols, current, onPick, testId, label, trailing }) {
    return (
        <ul className="res-chips" data-testid={testId} aria-label={label}>
            {symbols.map((s) => (
                <li key={s}>
                    <button
                        type="button"
                        className={cx('res-chip', s === current && 'is-current')}
                        aria-current={s === current ? 'true' : undefined}
                        onClick={() => onPick(s)}
                        data-testid={`${testId}-${s}`}
                    >
                        <span className="res-chip-dot" style={{ '--res-dot': symbolColor(s) }} aria-hidden="true" />
                        <span className="mono">{s}</span>
                    </button>
                </li>
            ))}
            {trailing && <li className="res-chips-trailing">{trailing}</li>}
        </ul>
    );
}

function Intro() {
    return (
        <Card className="res-intro fade-up" style={{ '--i': 2 }} data-testid="research-empty">
            <div className="res-intro-head">
                <span className="res-intro-icon" aria-hidden="true">
                    <Activity size={22} />
                </span>
                <div>
                    <h2 className="res-intro-title">Pick a symbol to get its report</h2>
                    <p className="res-intro-text">
                        Search by ticker or company name, or start with one of the popular symbols above.
                        Every report is built from live Yahoo Finance data in a few seconds.
                    </p>
                </div>
            </div>
            <ul className="res-features">
                {FEATURES.map((feature, n) => {
                    const Icon = feature.icon;
                    return (
                        <li key={feature.title} className="res-feature fade-up" style={{ '--i': 3 + n }}>
                            <span className="res-feature-icon" aria-hidden="true"><Icon size={16} /></span>
                            <h3 className="res-feature-title">{feature.title}</h3>
                            <p className="res-feature-text">{feature.text}</p>
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
}

const Research = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { token } = useAuth();
    const toast = useToast();

    // The symbol comes from the URL (?symbol=, Dashboard/topbar/this page) or router state (Screener).
    const requested = normalize(location.state?.symbol) || normalize(new URLSearchParams(location.search).get('symbol'));
    const [attempt, setAttempt] = useState(0);
    const requestId = requested ? `${location.key}|${requested}|${attempt}` : null;
    const [result, setResult] = useState({ id: null, data: null, error: null });
    const [query, setQuery] = useState('');
    const [recent, setRecent] = useState(readRecent);
    const [watchlist, setWatchlist] = useState(() => new Set());

    // Single code path: every navigation (new location.key) with a symbol runs one analysis.
    useEffect(() => {
        if (!requested) return undefined;
        let active = true;
        const id = `${location.key}|${requested}|${attempt}`;
        analyzeOnce(requested, attempt)
            .then((data) => {
                if (!active) return;
                setResult({ id, data, error: null });
                const symbol = normalize(data?.symbol) || requested;
                setRecent((list) => {
                    const nextList = [symbol, ...list.filter((s) => s !== symbol)].slice(0, RECENT_MAX);
                    writeRecent(nextList);
                    return nextList;
                });
            })
            .catch((error) => {
                if (active) setResult({ id, data: null, error });
            });
        return () => {
            active = false;
        };
    }, [location.key, requested, attempt]);

    // Which symbols are already on the watchlist (checked once).
    useEffect(() => {
        if (!token) return undefined;
        let active = true;
        stockApi.getWatchlist(token)
            .then((items) => {
                if (!active || !Array.isArray(items)) return;
                setWatchlist(new Set(items.map((item) => normalize(item?.symbol)).filter(Boolean)));
            })
            .catch(() => { /* the button still works; it just starts as "Add" */ });
        return () => {
            active = false;
        };
    }, [token]);

    const settled = requestId !== null && result.id === requestId;
    const status = !requested ? 'idle' : !settled ? 'loading' : result.error ? 'error' : 'ready';
    const analysis = status === 'ready' ? result.data : null;
    const shownSymbol = normalize(analysis?.symbol) || requested;

    useEffect(() => {
        document.title = shownSymbol ? `${shownSymbol} · Research · StockCrypt` : 'Research · StockCrypt';
    }, [shownSymbol]);

    const go = (symbol) => {
        const s = normalize(symbol);
        if (!s) return;
        setQuery('');
        // Same symbol again: refresh in place instead of stacking history entries.
        navigate(`/research?symbol=${encodeURIComponent(s)}`, { replace: s === requested });
    };

    const clearRecent = () => {
        setRecent([]);
        writeRecent([]);
    };

    const handleAddToWatchlist = async () => {
        const symbol = normalize(analysis?.symbol);
        try {
            await stockApi.addToWatchlist(symbol, '', token);
            setWatchlist((prev) => new Set(prev).add(symbol));
            toast.success(`${symbol} is now on your watchlist`, { title: 'Added to watchlist' });
        } catch (err) {
            toast.error(err.message || 'Could not add to the watchlist', { title: `Couldn't add ${symbol}` });
            throw err;
        }
    };

    const errorMessage = result.error?.message || 'Something went wrong while analyzing this symbol.';
    const notFound = /no data found|not found|404/i.test(errorMessage);

    return (
        <div className="res-page">
            <PageHeader
                title="Research"
                subtitle="Look up any stock, ETF or crypto for a rule-based report on trend, risk, momentum and recent news."
            />

            <Card className="res-search fade-up" style={{ '--i': 1 }}>
                <SymbolSearch
                    size="lg"
                    value={query}
                    onChange={setQuery}
                    onSelect={(symbol) => go(symbol)}
                    clearOnSelect
                    blurOnSelect
                    testId="research-search"
                    placeholder="Search a ticker or company name"
                    aria-label="Search for a stock, ETF or crypto to analyze"
                    className="res-search-input"
                />
                <div className="res-chip-rows">
                    <div className="res-chip-row">
                        <span className="res-chip-label">Popular</span>
                        <ChipList symbols={POPULAR} current={shownSymbol} onPick={go} testId="research-chips" label="Popular symbols" />
                    </div>
                    {recent.length > 0 && (
                        <div className="res-chip-row">
                            <span className="res-chip-label">
                                <History size={13} aria-hidden="true" />
                                Recent
                            </span>
                            <ChipList
                                symbols={recent}
                                current={shownSymbol}
                                onPick={go}
                                testId="research-recent"
                                label="Recent searches"
                                trailing={(
                                    <button type="button" className="res-clear" onClick={clearRecent} data-testid="research-recent-clear">
                                        Clear
                                    </button>
                                )}
                            />
                        </div>
                    )}
                </div>
            </Card>

            <div className="res-body" aria-busy={status === 'loading' || undefined}>
                {status === 'idle' && <Intro />}

                {status === 'loading' && <StockAnalysisSkeleton key={requestId} symbol={requested} />}

                {status === 'error' && (
                    <Card padded={false} className="res-error fade-up" data-testid="research-error">
                        <ErrorState
                            title={notFound ? `We couldn't find "${requested}"` : `Couldn't analyze ${requested}`}
                            message={notFound
                                ? `${errorMessage}. Check the ticker, or add an exchange suffix such as .NS for India or .L for London.`
                                : errorMessage}
                            onRetry={() => setAttempt((n) => n + 1)}
                        />
                        {notFound && (
                            <div className="res-error-suggest">
                                <SearchX size={14} aria-hidden="true" />
                                <span>Try one of these instead:</span>
                                <ChipList symbols={POPULAR.slice(0, 5)} current={null} onPick={go} testId="research-suggest" label="Suggested symbols" />
                            </div>
                        )}
                    </Card>
                )}

                {status === 'ready' && analysis && (
                    <StockAnalysis
                        key={`${shownSymbol}-${analysis.timestamp || requestId}`}
                        analysis={analysis}
                        onClose={() => navigate('/research')}
                        onAddToWatchlist={handleAddToWatchlist}
                        inWatchlist={watchlist.has(shownSymbol)}
                    />
                )}
            </div>
        </div>
    );
};

export default Research;
