import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowDownWideNarrow, ArrowUpNarrowWide, Bitcoin, LineChart, RefreshCw, Search, SearchX, X } from 'lucide-react';
import stockApi from '../services/stockApi';
import { useInterval } from '../hooks/useInterval';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useToast } from '../hooks/useToast';
import { timeAgo } from '../utils/format';
import { Badge, Button, Card, EmptyState, ErrorState, IconButton, PageHeader, SegmentedControl, StatusDot, cx } from './ui';
import {
    CRYPTO_ONLY,
    DEFAULT_SORT,
    MARKETS,
    RATINGS,
    STOCK_ONLY,
    filterRows,
    normalizeRows,
    searchRows,
    sortRows,
    sortableFor
} from './ScreenerModel';
import { ScreenerSummary } from './ScreenerSummary';
import { ScreenerList, ScreenerTable } from './ScreenerTable';
import './Screener.css';

const MARKET_OPTIONS = [
    { label: 'Stocks', value: 'stocks', icon: LineChart },
    { label: 'Crypto', value: 'crypto', icon: Bitcoin }
];

const AUTO_REFRESH_MS = 2 * 60 * 1000;
const ASCENDING_FIRST = ['symbol'];

const Screener = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const isPhone = useMediaQuery('(max-width: 767px)');
    const [searchParams, setSearchParams] = useSearchParams();
    const market = searchParams.get('market') === 'crypto' ? 'crypto' : 'stocks';

    // market -> { rows, fetchedAt, error }
    const [store, setStore] = useState({});
    const [refreshing, setRefreshing] = useState({});
    const [query, setQuery] = useState('');
    const [rating, setRating] = useState('all');
    const [sort, setSort] = useState(DEFAULT_SORT);
    const [now, setNow] = useState(() => Date.now());
    const requests = useRef({});

    const entry = store[market];

    const load = useCallback((m) => {
        const id = (requests.current[m] || 0) + 1;
        requests.current[m] = id;
        return stockApi.getScreenerStocks(m)
            .then((list) => {
                if (requests.current[m] !== id) return true;
                setStore((s) => ({ ...s, [m]: { rows: normalizeRows(list), fetchedAt: Date.now(), error: null } }));
                setNow(Date.now());
                return true;
            })
            .catch((err) => {
                if (requests.current[m] !== id) return false;
                setStore((s) => ({ ...s, [m]: { rows: s[m]?.rows || null, fetchedAt: s[m]?.fetchedAt || null, error: err.message } }));
                return false;
            });
    }, []);

    // First load per market (switching back later reuses what is loaded).
    useEffect(() => {
        if (entry || requests.current[market]) return;
        load(market);
    }, [market, entry, load]);

    const refresh = () => {
        if (refreshing[market]) return;
        const hadRows = Boolean(entry?.rows?.length);
        setRefreshing((r) => ({ ...r, [market]: true }));
        load(market).then((ok) => {
            setRefreshing((r) => ({ ...r, [market]: false }));
            if (!ok && hadRows) toast.error('Could not refresh prices. Showing the last loaded data.');
        });
    };

    useInterval(() => setNow(Date.now()), 30000);
    useInterval(() => {
        if (document.visibilityState === 'visible' && entry?.rows?.length && !refreshing[market]) load(market);
    }, AUTO_REFRESH_MS);

    const changeMarket = (next) => {
        setSearchParams(next === 'stocks' ? {} : { market: next }, { replace: true });
    };

    // P/E and EPS do not exist for crypto (and the 52W column only shows for crypto).
    const hidden = market === 'crypto' ? STOCK_ONLY : CRYPTO_ONLY;
    const activeSort = hidden.includes(sort.key) ? DEFAULT_SORT : sort;

    const toggleSort = (key) => {
        setSort((current) => {
            const base = hidden.includes(current.key) ? DEFAULT_SORT : current;
            if (base.key === key) return { key, dir: base.dir === 'asc' ? 'desc' : 'asc' };
            return { key, dir: ASCENDING_FIRST.includes(key) ? 'asc' : 'desc' };
        });
    };

    const rows = useMemo(() => entry?.rows || [], [entry]);
    const searched = useMemo(() => searchRows(rows, query), [rows, query]);
    const counts = useMemo(() => {
        const map = { all: searched.length };
        RATINGS.forEach((r) => { map[r.value] = 0; });
        searched.forEach((row) => { map[row.technicalRating] += 1; });
        return map;
    }, [searched]);
    const visible = useMemo(
        () => sortRows(filterRows(rows, query, rating), activeSort.key, activeSort.dir),
        [rows, query, rating, activeSort.key, activeSort.dir]
    );

    const loading = !entry || (!entry.rows && !entry.error);
    const failed = Boolean(entry?.error && !entry.rows);
    const isSample = rows.some((r) => r.isSample);
    const info = MARKETS[market];
    const busy = Boolean(refreshing[market]);
    const filtered = query.trim() || rating !== 'all';

    const openSymbol = (symbol) => navigate('/research', { state: { symbol } });
    const clearFilters = () => {
        setQuery('');
        setRating('all');
    };

    return (
        <div className="scr-page">
            <PageHeader
                title="Screener"
                subtitle={info.subtitle}
                actions={(
                    <div className="scr-actions">
                        <SegmentedControl
                            options={MARKET_OPTIONS}
                            value={market}
                            onChange={changeMarket}
                            testId="scr-market"
                            aria-label="Market"
                        />
                        <div className="scr-refresh">
                            <span className="scr-updated" aria-live="polite" data-testid="scr-updated">
                                {entry?.fetchedAt ? (
                                    <>
                                        <StatusDot tone={entry.error ? 'warn' : 'gain'} pulse={!entry.error && !busy} />
                                        <span className="num">{busy ? 'Updating…' : `Updated ${timeAgo(entry.fetchedAt, new Date(now))}`}</span>
                                    </>
                                ) : loading ? 'Loading quotes…' : null}
                            </span>
                            <Button
                                variant="secondary"
                                icon={RefreshCw}
                                loading={busy}
                                onClick={refresh}
                                disabled={loading}
                                data-testid="scr-refresh"
                                aria-label="Refresh prices"
                            >
                                Refresh
                            </Button>
                        </div>
                    </div>
                )}
            />

            {isSample && (
                <div className="scr-sample fade-up" role="status" data-testid="scr-sample">
                    <Badge tone="warn" icon={AlertTriangle}>Sample data</Badge>
                    <span>Live quotes are unavailable right now, so these rows are generated examples. Refresh to try again.</span>
                </div>
            )}

            {failed ? (
                <Card className="scr-error fade-up">
                    <ErrorState
                        title="Could not load the screener"
                        message={entry.error}
                        onRetry={refresh}
                    />
                </Card>
            ) : (
                <>
                    <ScreenerSummary rows={rows} loading={loading} noun={info.noun} onOpen={openSymbol} />

                    <Card padded={false} className="scr-card fade-up" style={{ '--i': 2 }}>
                        <div className="scr-toolbar">
                            <div className="scr-search">
                                <label htmlFor="scr-search-input" className="sr-only">Search by symbol or name</label>
                                <div className="ui-input-group">
                                    <Search size={16} className="ui-input-icon" aria-hidden="true" />
                                    <input
                                        id="scr-search-input"
                                        type="search"
                                        className="ui-input scr-search-input"
                                        placeholder={`Search ${info.noun} by symbol or name`}
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Escape' && query) {
                                                e.stopPropagation();
                                                setQuery('');
                                            }
                                        }}
                                        autoComplete="off"
                                        spellCheck={false}
                                        data-testid="scr-search"
                                    />
                                    {query && (
                                        <IconButton
                                            icon={X}
                                            size="sm"
                                            label="Clear search"
                                            className="scr-search-clear"
                                            onClick={() => setQuery('')}
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="scr-chips" role="group" aria-label="Filter by technical rating" data-testid="scr-rating">
                                <RatingChip label="All" active={rating === 'all'} count={loading ? null : counts.all} onClick={() => setRating('all')} slug="all" />
                                {RATINGS.map((r) => (
                                    <RatingChip
                                        key={r.value}
                                        label={r.value}
                                        tone={r.tone}
                                        strong={r.slug.startsWith('strong')}
                                        slug={r.slug}
                                        active={rating === r.value}
                                        count={loading ? null : counts[r.value]}
                                        onClick={() => setRating(rating === r.value ? 'all' : r.value)}
                                    />
                                ))}
                            </div>

                            {isPhone && (
                                <MobileSort market={market} sort={activeSort} setSort={setSort} />
                            )}
                        </div>

                        {!loading && visible.length === 0 ? (
                            <EmptyState
                                icon={SearchX}
                                title={filtered ? 'No matches' : `No ${info.noun} to show`}
                                description={filtered
                                    ? `Nothing in this list matches${query.trim() ? ` “${query.trim()}”` : ''}${rating !== 'all' ? ` with a ${rating} rating` : ''}. Any symbol can still be analysed on the Research page.`
                                    : 'The quote service returned no rows. Try refreshing in a moment.'}
                                action={filtered ? (
                                    <div className="scr-empty-actions">
                                        <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>
                                        {query.trim() && (
                                            <Button size="sm" icon={Search} onClick={() => navigate(`/research?symbol=${encodeURIComponent(query.trim().toUpperCase())}`)}>
                                                Research {query.trim().toUpperCase()}
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <Button variant="secondary" size="sm" onClick={refresh}>Refresh</Button>
                                )}
                                className="scr-empty"
                                data-testid="scr-empty"
                            />
                        ) : isPhone ? (
                            <ScreenerList rows={visible} onOpen={openSymbol} loading={loading} />
                        ) : (
                            <ScreenerTable
                                rows={visible}
                                market={market}
                                sort={activeSort}
                                onSort={toggleSort}
                                onOpen={openSymbol}
                                loading={loading}
                            />
                        )}

                        <div className="scr-foot">
                            <span className="num" data-testid="scr-count">
                                {loading ? 'Loading…' : `Showing ${visible.length} of ${rows.length} ${info.noun}`}
                            </span>
                            <span className="scr-foot-note">
                                Ratings compare price with its 50- and 200-day averages plus today's move. Rule-based, not financial advice. Data: Yahoo Finance.
                            </span>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
};

function RatingChip({ label, count, active, onClick, tone, strong, slug }) {
    return (
        <button
            type="button"
            className={cx('scr-chip', active && 'is-active', tone && `scr-chip--${tone}`, strong && 'is-strong')}
            aria-pressed={active}
            onClick={onClick}
            data-testid={`scr-rating-${slug}`}
        >
            {tone && <span className="scr-chip-dot" aria-hidden="true" />}
            <span>{label}</span>
            <span className="scr-chip-count num">{count ?? '–'}</span>
        </button>
    );
}

function MobileSort({ market, sort, setSort }) {
    const options = sortableFor(market);
    const DirIcon = sort.dir === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow;
    return (
        <div className="scr-msort">
            <label htmlFor="scr-msort-select" className="scr-msort-label">Sort by</label>
            <select
                id="scr-msort-select"
                className="ui-select ui-input--sm scr-msort-select"
                value={sort.key}
                onChange={(e) => setSort({ key: e.target.value, dir: e.target.value === 'symbol' ? 'asc' : 'desc' })}
                data-testid="scr-sort-select"
            >
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <IconButton
                icon={DirIcon}
                variant="secondary"
                size="sm"
                label={sort.dir === 'asc' ? 'Ascending, switch to descending' : 'Descending, switch to ascending'}
                onClick={() => setSort({ key: sort.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
                data-testid="scr-sort-dir"
            />
        </div>
    );
}

export default Screener;
