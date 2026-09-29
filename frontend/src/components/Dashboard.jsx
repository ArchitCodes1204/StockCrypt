import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Layers, Plus, Search, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useInterval } from '../hooks/useInterval';
import portfolioApi from '../services/portfolioApi';
import stockApi from '../services/stockApi';
import { formatCurrency, formatPercent, getGreeting, toNumber } from '../utils/format';
import { Button, Card, ErrorState, PageHeader, StatCard } from './ui';
import { DashboardAllocation, DashboardHoldings, DashboardValueChart } from './DashboardPortfolio';
import { DashboardMovers, DashboardTickerTape, DashboardWatchlist } from './DashboardMarket';
import './Dashboard.css';

// Market data and portfolio prices refresh quietly in the background (the backend caches quotes ~90s).
const POLL_MS = 60000;
const MAX_SLICES = 6; // donut: top 5 + "Other" once there are more than 6 holdings

const TODAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

/**
 * Fetches `load()` whenever `key` changes (null = idle). Keeps the last good
 * data while a new request runs, so refreshes never blank a section.
 * -> { data, error, loading, reload }
 */
function useResource(key, load) {
    const [nonce, setNonce] = useState(0);
    const [state, setState] = useState({ key: null, data: undefined, error: null });
    const requestKey = key === null ? null : `${key}#${nonce}`;
    const run = useEffectEvent(() => load());

    useEffect(() => {
        if (requestKey === null) return undefined;
        let alive = true;
        Promise.resolve(run()).then(
            (data) => {
                if (alive) setState({ key: requestKey, data, error: null });
            },
            (error) => {
                if (alive) setState((prev) => ({ key: requestKey, data: prev.data, error }));
            }
        );
        return () => {
            alive = false;
        };
    }, [requestKey]);

    const reload = useCallback(() => setNonce((n) => n + 1), []);
    const settled = state.key === requestKey;
    return {
        data: state.data,
        error: settled ? state.error : null,
        loading: requestKey !== null && !settled,
        reload
    };
}

/** Holdings by current value, folded to at most MAX_SLICES slices, each with a fixed palette color. */
function buildAllocation(holdings) {
    const rows = (Array.isArray(holdings) ? holdings : [])
        .map((h) => ({ symbol: h.symbol, value: Math.max(0, toNumber(h.currentValue) ?? 0) }))
        .filter((r) => r.symbol && r.value > 0)
        .sort((a, b) => b.value - a.value);
    const total = rows.reduce((sum, r) => sum + r.value, 0);
    let slices = rows;
    if (rows.length > MAX_SLICES) {
        const rest = rows.slice(MAX_SLICES - 1);
        slices = [
            ...rows.slice(0, MAX_SLICES - 1),
            { symbol: 'Other', value: rest.reduce((sum, r) => sum + r.value, 0), isOther: true, members: rest.map((r) => r.symbol) }
        ];
    }
    const colored = slices.map((s, i) => ({
        ...s,
        color: s.isOther ? 'var(--sc-chart-8)' : `var(--sc-chart-${i + 1})`,
        percent: total ? (s.value / total) * 100 : 0
    }));
    const colorBySymbol = {};
    colored.forEach((s) => {
        if (s.isOther) s.members.forEach((m) => { colorBySymbol[m] = s.color; });
        else colorBySymbol[s.symbol] = s.color;
    });
    return { slices: colored, total, colorBySymbol };
}

/** Market move of the portfolio on the latest day, excluding money added or removed that day. */
function dayMove(history) {
    const points = history?.points;
    if (!Array.isArray(points) || points.length < 2) return null;
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    const v1 = toNumber(last?.value);
    const v0 = toNumber(prev?.value);
    if (v1 === null || !v0) return null;
    const flow = (toNumber(last?.invested) ?? 0) - (toNumber(prev?.invested) ?? 0);
    const amount = v1 - v0 - flow;
    return { amount, percent: (amount / v0) * 100 };
}

const signedCurrency = (v) => `${v > 0 ? '+' : ''}${formatCurrency(v)}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function KpiRow({ summary, holdings, history }) {
    const data = summary.data;
    const loading = !data && summary.loading;

    if (!data && summary.error) {
        return (
            <Card padded={false} className="dash-kpis-error fade-up" style={{ '--i': 2 }} data-testid="dash-kpis">
                <ErrorState
                    compact
                    title="Couldn't load your portfolio summary"
                    message={summary.error.message}
                    onRetry={summary.reload}
                />
            </Card>
        );
    }

    const count = toNumber(data?.holdingsCount) ?? (Array.isArray(holdings.data) ? holdings.data.length : 0);
    const profit = toNumber(data?.totalProfitLoss);
    const move = count > 0 ? dayMove(history.data) : null;
    const best = Array.isArray(data?.topPerformers) ? data.topPerformers[0] : null;
    const bestPct = toNumber(best?.profitLossPercent);

    return (
        <div className="dash-kpis" data-testid="dash-kpis">
            <StatCard
                label="Portfolio value"
                value={data?.totalValue}
                format={(v) => formatCurrency(v)}
                change={move ? move.percent : undefined}
                hint={move ? `${signedCurrency(move.amount)} today` : count ? 'At current market prices' : 'Add a transaction to start'}
                icon={Wallet}
                loading={loading}
                className="fade-up"
                style={{ '--i': 2 }}
            />
            <StatCard
                label="Total invested"
                value={data?.totalInvested}
                format={(v) => formatCurrency(v)}
                hint={count ? `Cost basis of ${plural(count, 'holding')}` : 'Nothing invested yet'}
                icon={Coins}
                loading={loading}
                className="fade-up"
                style={{ '--i': 3 }}
            />
            <StatCard
                label="Total return"
                value={profit}
                format={signedCurrency}
                change={count ? data?.totalProfitLossPercent : undefined}
                hint={count ? 'Unrealized' : 'Returns show up here'}
                icon={profit !== null && profit < 0 ? TrendingDown : TrendingUp}
                loading={loading}
                className="fade-up"
                style={{ '--i': 4 }}
            />
            <StatCard
                label="Holdings"
                value={count}
                format={(v) => String(Math.round(v))}
                hint={best && bestPct !== null ? (
                    <>
                        Best: <span className="mono dash-kpi-best">{best.symbol}</span>{' '}
                        <span className={bestPct >= 0 ? 'gain' : 'loss'}>{formatPercent(bestPct)}</span>
                    </>
                ) : 'No positions yet'}
                icon={Layers}
                loading={loading}
                className="fade-up"
                style={{ '--i': 5 }}
            />
        </div>
    );
}

const Dashboard = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [range, setRange] = useState('1y');
    const [tick, setTick] = useState(0);

    useInterval(() => {
        if (typeof document === 'undefined' || !document.hidden) setTick((t) => t + 1);
    }, POLL_MS);

    const auth = token || null;
    const summary = useResource(auth && `summary:${tick}`, () => portfolioApi.getSummary(auth));
    const holdings = useResource(auth && `holdings:${tick}`, () => portfolioApi.getHoldings(auth));
    const history = useResource(auth && `history:${range}`, () => portfolioApi.getHistory(range, auth));
    const screener = useResource(`screener:${tick}`, () => stockApi.getScreenerStocks('stocks'));
    const trending = useResource(`trending:${tick}`, () => stockApi.getTrendingStocks());
    const watchlist = useResource(auth && `watchlist:${tick}`, () => stockApi.getWatchlistPage(auth, { limit: 4 }));

    const allocation = useMemo(() => buildAllocation(holdings.data), [holdings.data]);

    // Company names for the holdings table, from whatever market data is already loaded.
    const names = useMemo(() => {
        const map = {};
        (Array.isArray(screener.data) ? screener.data : []).forEach((r) => { if (r?.symbol && r.name) map[r.symbol] = r.name; });
        (Array.isArray(trending.data) ? trending.data : []).forEach((r) => { if (r?.symbol && r.name) map[r.symbol] = r.name; });
        (watchlist.data?.items || []).forEach((w) => {
            const name = w?.lastAnalysis?.companyOverview?.name;
            if (w?.symbol && name) map[w.symbol] = name;
        });
        return map;
    }, [screener.data, trending.data, watchlist.data]);

    const openSymbol = useCallback((symbol) => {
        navigate(`/research?symbol=${encodeURIComponent(symbol)}`, { state: { symbol } });
    }, [navigate]);

    const addTransaction = useCallback(() => navigate('/portfolio?add=1'), [navigate]);
    const hasHoldings = Array.isArray(holdings.data) ? holdings.data.length > 0 : null;
    const username = user?.username;

    return (
        <div className="dash">
            <PageHeader
                className="dash-header fade-up"
                eyebrow={TODAY_FORMAT.format(new Date())}
                title={<span data-testid="dash-greeting">{getGreeting()}{username ? `, ${username}` : ''}</span>}
                subtitle="Your portfolio, your watchlist and today's market at a glance."
                actions={(
                    <>
                        <Button variant="secondary" icon={Search} onClick={() => navigate('/research')}>Research</Button>
                        <Button icon={Plus} onClick={addTransaction} data-testid="dash-add">Add transaction</Button>
                    </>
                )}
            />

            <div className="dash-grid">
                <DashboardTickerTape resource={screener} onOpen={openSymbol} style={{ '--i': 1 }} />

                <KpiRow summary={summary} holdings={holdings} history={history} />

                <DashboardValueChart
                    resource={history}
                    range={range}
                    onRangeChange={setRange}
                    onAdd={addTransaction}
                    style={{ '--i': 6 }}
                />
                <DashboardAllocation
                    resource={holdings}
                    allocation={allocation}
                    onOpen={openSymbol}
                    style={{ '--i': 7 }}
                />
                <DashboardHoldings
                    resource={holdings}
                    colors={allocation.colorBySymbol}
                    total={allocation.total}
                    names={names}
                    onOpen={openSymbol}
                    hasHoldings={hasHoldings}
                    style={{ '--i': 8 }}
                />
                <DashboardMovers resource={trending} onOpen={openSymbol} style={{ '--i': 9 }} />
                <DashboardWatchlist resource={watchlist} onOpen={openSymbol} style={{ '--i': 10 }} />
            </div>
        </div>
    );
};

export default Dashboard;
