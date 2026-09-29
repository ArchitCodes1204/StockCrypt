import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Info, Plus, RefreshCw, Search, SearchX, Star } from 'lucide-react';
import stockApi from '../services/stockApi';
import { useAuth, useConfirm, useInterval, useMediaQuery, useToast } from '../hooks';
import {
    Button,
    Card,
    EmptyState,
    ErrorState,
    Modal,
    PageHeader,
    Pagination,
    SegmentedControl,
    SymbolSearch,
    cx
} from './ui';
import { formatCurrency, toNumber } from '../utils/format';
import StockAnalysis from './StockAnalysis';
import { WatchlistCard, WatchlistCardSkeleton, WatchlistPendingCard } from './WatchlistCard';
import './Watchlist.css';

const PAGE_SIZE = 12;
const FILTERS = ['ALL', 'BUY', 'HOLD', 'SELL'];
const FILTER_TONES = { BUY: 'gain', HOLD: 'warn', SELL: 'loss' };
const SORTS = [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'symbol', label: 'Symbol A–Z' },
    { value: 'change', label: 'Top gainers today' }
];
const SORT_VALUES = SORTS.map((s) => s.value);
const DEFAULTS = { filter: 'ALL', sort: 'newest', page: 1 };
const QUICK_ADD = ['AAPL', 'NVDA', 'MSFT', 'BTC-USD'];
const LEAVE_MS = 220;

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const pathSymbol = (symbol) => encodeURIComponent(symbol);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Upserted rows keep their original createdAt, new ones get createdAt === addedAt. */
function wasAlreadySaved(doc) {
    const created = Date.parse(doc?.createdAt);
    const added = Date.parse(doc?.addedAt);
    return Number.isFinite(created) && Number.isFinite(added) && added - created > 2000;
}

const Watchlist = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const toast = useToast();
    const confirm = useConfirm();
    const narrow = useMediaQuery('(max-width: 479px)');

    // Filter, sort and page live in the URL (?filter=BUY&sort=change&page=2).
    const [params, setParams] = useSearchParams();
    const filter = FILTERS.includes(params.get('filter')) ? params.get('filter') : DEFAULTS.filter;
    const sort = SORT_VALUES.includes(params.get('sort')) ? params.get('sort') : DEFAULTS.sort;
    const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);

    const updateParams = useCallback((next) => {
        setParams((prev) => {
            const p = new URLSearchParams(prev);
            Object.entries(next).forEach(([key, value]) => {
                if (value === undefined || value === null || value === DEFAULTS[key]) p.delete(key);
                else p.set(key, String(value));
            });
            return p;
        }, { replace: true });
    }, [setParams]);

    // Server-side page. `version` forces a refetch; stale items stay visible (dimmed) while loading.
    const [version, setVersion] = useState(0);
    const reload = useCallback(() => setVersion((v) => v + 1), []);
    const queryKey = `${filter}|${sort}|${page}|${version}`;
    const [result, setResult] = useState({ key: null, items: [], total: 0, error: null });

    useEffect(() => {
        if (!token) return undefined;
        let cancelled = false;
        stockApi.getWatchlistPage(token, {
            limit: PAGE_SIZE,
            skip: (page - 1) * PAGE_SIZE,
            recommendation: filter === 'ALL' ? undefined : filter,
            sort
        })
            .then(({ items, total }) => {
                if (cancelled) return;
                if (!items.length && total > 0 && page > 1) {
                    // Page no longer exists (items were removed elsewhere): go to the last one.
                    updateParams({ page: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
                    return;
                }
                setResult({ key: queryKey, items, total, error: null });
            })
            .catch((err) => {
                if (!cancelled) setResult((prev) => ({ ...prev, key: queryKey, error: err.message || 'Could not load your watchlist' }));
            });
        return () => {
            cancelled = true;
        };
    }, [token, filter, sort, page, queryKey, updateParams]);

    // Counts per recommendation (limit 1 each: only X-Total-Count matters).
    const [countsVersion, setCountsVersion] = useState(0);
    const [counts, setCounts] = useState(null);
    useEffect(() => {
        if (!token) return undefined;
        let cancelled = false;
        Promise.all(FILTERS.map((f) => stockApi
            .getWatchlistPage(token, { limit: 1, recommendation: f === 'ALL' ? undefined : f })
            .then((r) => r.total)))
            .then((totals) => {
                if (!cancelled) setCounts(Object.fromEntries(FILTERS.map((f, i) => [f, totals[i]])));
            })
            .catch(() => { /* counts are a nice-to-have; the filter still works without them */ });
        return () => {
            cancelled = true;
        };
    }, [token, version, countsVersion]);

    // "Updated 3m ago" labels tick.
    const [now, setNow] = useState(() => new Date());
    useInterval(() => setNow(new Date()), 30000);

    const [adding, setAdding] = useState(null);
    const [refreshing, setRefreshing] = useState(() => new Set());
    const [removing, setRemoving] = useState(() => new Set());
    const [leaving, setLeaving] = useState(null);
    const [highlight, setHighlight] = useState(null);
    const [bulk, setBulk] = useState(null); // { done, total, current }
    const [report, setReport] = useState({ open: false, symbol: null, item: null });

    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);

    useEffect(() => {
        if (!highlight) return undefined;
        const timer = setTimeout(() => setHighlight(null), 2600);
        return () => clearTimeout(timer);
    }, [highlight]);

    const initialLoading = result.key === null;
    const pageLoading = result.key !== queryKey;
    const items = result.items;
    const totalAll = counts?.ALL ?? (filter === 'ALL' && !initialLoading && !result.error ? result.total : null);
    const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

    // ---- actions -------------------------------------------------------------

    const addSymbol = async (raw) => {
        const symbol = String(raw || '').trim().toUpperCase();
        if (!symbol || adding) return;
        if (items.some((i) => i.symbol === symbol)) {
            toast.info(`${symbol} is already on your watchlist.`);
            setHighlight(symbol);
            return;
        }
        setAdding(symbol);
        try {
            const saved = await stockApi.addToWatchlist(symbol, '', token);
            if (!alive.current) return;
            const savedSymbol = saved?.symbol || symbol;
            const decision = saved?.lastAnalysis?.recommendation?.decision;
            if (wasAlreadySaved(saved)) {
                toast.info(`${savedSymbol} was already on your watchlist. Its analysis is now up to date.`);
            } else {
                const price = toNumber(saved?.lastAnalysis?.currentMarketStatus?.currentPrice);
                toast.success(
                    price === null
                        ? `${savedSymbol} added to your watchlist.`
                        : `${savedSymbol} added at ${formatCurrency(price, saved?.lastAnalysis?.currency)}.`,
                    { title: 'Added to watchlist' }
                );
            }
            // Show it: first page, and drop a filter it would not match.
            updateParams({ page: 1, filter: filter === 'ALL' || filter === decision ? filter : 'ALL' });
            setHighlight(savedSymbol);
            reload();
        } catch (err) {
            toast.error(err.message || `Could not add ${symbol}.`, { title: `Couldn't add ${symbol}` });
        } finally {
            if (alive.current) setAdding(null);
        }
    };

    const setFlag = (setter, symbol, on) => setter((prev) => {
        const next = new Set(prev);
        if (on) next.add(symbol);
        else next.delete(symbol);
        return next;
    });

    const refreshSymbol = async (symbol, { silent = false } = {}) => {
        setFlag(setRefreshing, symbol, true);
        try {
            const updated = await stockApi.refreshWatchlistStock(pathSymbol(symbol), token);
            if (!alive.current) return false;
            setResult((prev) => ({
                ...prev,
                items: prev.items.map((i) => (i.symbol === symbol ? { ...i, ...updated } : i))
            }));
            if (!silent) {
                const price = toNumber(updated?.lastAnalysis?.currentMarketStatus?.currentPrice);
                toast.success(
                    price === null
                        ? `${symbol} is up to date.`
                        : `${symbol} is at ${formatCurrency(price, updated?.lastAnalysis?.currency)}.`,
                    { title: 'Analysis refreshed' }
                );
                setCountsVersion((v) => v + 1);
            }
            return true;
        } catch (err) {
            if (!silent) toast.error(err.message || 'Please try again.', { title: `Couldn't refresh ${symbol}` });
            return false;
        } finally {
            if (alive.current) setFlag(setRefreshing, symbol, false);
        }
    };

    const refreshAll = async () => {
        if (bulk || !token) return;
        const visible = items.map((i) => i.symbol);
        let symbols = visible;
        if (filter !== 'ALL' || (totalAll ?? result.total) > visible.length) {
            try {
                const all = await stockApi.getWatchlist(token, { sort });
                symbols = all.map((i) => i.symbol);
            } catch (err) {
                toast.error(err.message, { title: "Couldn't refresh your watchlist" });
                return;
            }
        }
        // Visible cards first, so progress shows on screen straight away.
        const ordered = [...visible.filter((s) => symbols.includes(s)), ...symbols.filter((s) => !visible.includes(s))];
        if (!ordered.length) return;

        const failed = [];
        for (let i = 0; i < ordered.length; i += 1) {
            if (!alive.current) return;
            setBulk({ done: i, total: ordered.length, current: ordered[i] });
            const ok = await refreshSymbol(ordered[i], { silent: true });
            if (!ok) failed.push(ordered[i]);
        }
        if (!alive.current) return;
        setBulk(null);
        const done = ordered.length - failed.length;
        if (!failed.length) {
            toast.success(`All ${plural(done, 'symbol')} now have the latest prices and signals.`, { title: 'Watchlist refreshed' });
        } else if (done) {
            toast.error(`Refreshed ${done} of ${ordered.length}. Could not refresh ${failed.join(', ')}.`, { title: 'Some symbols failed' });
        } else {
            toast.error('Market data is unavailable right now. Please try again in a minute.', { title: "Couldn't refresh" });
        }
        reload();
    };

    const removeItem = async (item) => {
        const { symbol } = item;
        const ok = await confirm({
            title: `Remove ${symbol}?`,
            message: `${symbol} and its saved analysis will be removed from your watchlist. You can add it back at any time.`,
            confirmLabel: 'Remove',
            tone: 'danger'
        });
        if (!ok) return;
        setFlag(setRemoving, symbol, true);
        try {
            await stockApi.removeFromWatchlist(pathSymbol(symbol), token);
            if (!alive.current) return;
            setLeaving(symbol);
            await wait(LEAVE_MS);
            if (!alive.current) return;
            const lastOnPage = items.length === 1 && page > 1;
            setResult((prev) => ({
                ...prev,
                items: prev.items.filter((i) => i.symbol !== symbol),
                total: Math.max(0, prev.total - 1)
            }));
            setLeaving(null);
            toast.success(`${symbol} removed from your watchlist.`);
            if (report.symbol === symbol) setReport((r) => ({ ...r, open: false }));
            if (lastOnPage) updateParams({ page: page - 1 });
            reload();
        } catch (err) {
            toast.error(err.message, { title: `Couldn't remove ${symbol}` });
        } finally {
            if (alive.current) setFlag(setRemoving, symbol, false);
        }
    };

    const openReport = useCallback((item) => {
        if (item?.lastAnalysis) setReport({ open: true, symbol: item.symbol, item });
    }, []);
    const closeReport = useCallback(() => setReport((r) => ({ ...r, open: false })), []);

    const onCardRefresh = (item) => {
        if (!refreshing.has(item.symbol)) refreshSymbol(item.symbol);
    };

    // The open report follows refreshes of the same symbol.
    const reportItem = items.find((i) => i.symbol === report.symbol) || report.item;
    const selected = reportItem?.lastAnalysis || null;

    // ---- render --------------------------------------------------------------

    const filterOptions = FILTERS.map((f) => ({
        value: f,
        label: (
            <span className="wl-filter-opt">
                {FILTER_TONES[f] && <span className={cx('wl-filter-dot', `wl-filter-dot--${FILTER_TONES[f]}`)} aria-hidden="true" />}
                {f === 'ALL' ? 'All' : f}
                {counts && <span className="wl-filter-count num">{counts[f]}</span>}
            </span>
        )
    }));

    const bulkPct = bulk ? Math.round(((bulk.done + 0.5) / bulk.total) * 100) : 0;
    const showEmpty = !initialLoading && !result.error && result.total === 0 && !adding;
    const firstShown = (page - 1) * PAGE_SIZE + 1;
    const lastShown = (page - 1) * PAGE_SIZE + items.length;

    let body;
    if (result.error && !pageLoading && !items.length) {
        body = (
            <Card className="wl-state fade-up" style={{ '--i': 2 }}>
                <ErrorState
                    title="Couldn't load your watchlist"
                    message={result.error}
                    onRetry={reload}
                />
            </Card>
        );
    } else if (initialLoading) {
        body = (
            <div className="wl-grid" aria-busy="true" aria-label="Loading watchlist">
                {Array.from({ length: 6 }, (_, i) => <WatchlistCardSkeleton key={i} index={i} />)}
            </div>
        );
    } else if (showEmpty && filter === 'ALL') {
        body = (
            <Card className="wl-state fade-up" style={{ '--i': 2 }} data-testid="wl-empty">
                <EmptyState
                    icon={Star}
                    title="Your watchlist is empty"
                    description="Add a symbol with the search above, or open a stock in Research and save it from its report. Each card keeps the latest price, trend and signal."
                    action={(
                        <Button icon={Search} onClick={() => navigate('/research')}>
                            Research a stock
                        </Button>
                    )}
                />
                <div className="wl-quick">
                    <span className="wl-quick-label">Popular to start with</span>
                    <div className="wl-quick-list">
                        {QUICK_ADD.map((s) => (
                            <button
                                key={s}
                                type="button"
                                className="wl-quick-chip mono"
                                onClick={() => addSymbol(s)}
                                disabled={Boolean(adding)}
                                data-testid={`wl-quick-${s}`}
                            >
                                <Plus size={13} aria-hidden="true" />
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            </Card>
        );
    } else if (showEmpty) {
        body = (
            <Card className="wl-state fade-up" style={{ '--i': 2 }} data-testid="wl-no-matches">
                <EmptyState
                    icon={SearchX}
                    title={`No ${filter} signals right now`}
                    description={totalAll
                        ? `None of your ${plural(totalAll, 'symbol')} currently has a ${filter} signal. Signals change as prices move, so refresh to re-check.`
                        : `None of your symbols currently has a ${filter} signal.`}
                    action={(
                        <>
                            <Button variant="secondary" onClick={() => updateParams({ filter: 'ALL', page: 1 })}>
                                Show all symbols
                            </Button>
                            <Button variant="ghost" icon={Search} onClick={() => navigate('/research')}>
                                Research a stock
                            </Button>
                        </>
                    )}
                />
            </Card>
        );
    } else {
        body = (
            <>
                <div className={cx('wl-grid', pageLoading && 'is-stale')} aria-busy={pageLoading || undefined}>
                    {adding && <WatchlistPendingCard symbol={adding} />}
                    {items.map((item, index) => (
                        <WatchlistCard
                            key={item._id || item.symbol}
                            item={item}
                            index={index + (adding ? 1 : 0)}
                            now={now}
                            refreshing={refreshing.has(item.symbol)}
                            removing={removing.has(item.symbol)}
                            leaving={leaving === item.symbol}
                            highlighted={highlight === item.symbol}
                            onView={openReport}
                            onRefresh={onCardRefresh}
                            onRemove={removeItem}
                        />
                    ))}
                </div>
                {result.error && (
                    <p className="wl-inline-error" role="alert">
                        {result.error}
                        <Button size="sm" variant="ghost" icon={RefreshCw} onClick={reload}>Retry</Button>
                    </p>
                )}
                {result.total > PAGE_SIZE && (
                    <div className="wl-pager">
                        <span className="wl-pager-summary num">
                            {items.length ? `${firstShown}–${lastShown} of ${result.total}` : `${result.total} symbols`}
                        </span>
                        <Pagination
                            page={Math.min(page, pages)}
                            pages={pages}
                            onChange={(p) => {
                                updateParams({ page: p });
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            testId="wl-pagination"
                            aria-label="Watchlist pages"
                        />
                    </div>
                )}
            </>
        );
    }

    const hasItems = (totalAll ?? result.total) > 0;

    return (
        <div className="wl-page">
            <PageHeader
                className="fade-up"
                title={(
                    <span className="wl-title">
                        Watchlist
                        {totalAll !== null && (
                            <span className="wl-title-count num">
                                <span className="sr-only">, </span>
                                {totalAll}
                                <span className="sr-only">{totalAll === 1 ? ' symbol' : ' symbols'}</span>
                            </span>
                        )}
                    </span>
                )}
                subtitle="Latest price, trend and rule-based signal for every symbol you follow."
                actions={(
                    <div className="wl-actions">
                        <SymbolSearch
                            className="wl-add"
                            testId="wl-add-input"
                            placeholder={adding ? `Adding ${adding}…` : narrow ? 'Add a symbol' : 'Add a symbol, e.g. NVDA'}
                            aria-label="Add a symbol to your watchlist"
                            clearOnSelect
                            disabled={Boolean(adding)}
                            onSelect={addSymbol}
                        />
                        {totalAll !== 0 && (
                            <Button
                                variant="secondary"
                                icon={RefreshCw}
                                loading={Boolean(bulk)}
                                onClick={refreshAll}
                                disabled={!hasItems || Boolean(adding)}
                                data-testid="wl-refresh-all"
                                className="wl-refresh-all"
                            >
                                {bulk ? `Refreshing ${bulk.done + 1} of ${bulk.total}` : 'Refresh all'}
                            </Button>
                        )}
                    </div>
                )}
            />

            {(hasItems || filter !== 'ALL') && (
                <div className="wl-toolbar fade-up" style={{ '--i': 1 }}>
                    <SegmentedControl
                        options={filterOptions}
                        value={filter}
                        onChange={(value) => updateParams({ filter: value, page: 1 })}
                        testId="wl-filter"
                        aria-label="Filter by signal"
                        className="wl-filter"
                    />
                    <div className="wl-sort">
                        <label htmlFor="wl-sort" className="wl-sort-label">
                            <ArrowUpDown size={14} aria-hidden="true" />
                            Sort
                        </label>
                        <select
                            id="wl-sort"
                            className="ui-select ui-input--sm wl-sort-select"
                            value={sort}
                            onChange={(event) => updateParams({ sort: event.target.value, page: 1 })}
                            data-testid="wl-sort"
                        >
                            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                </div>
            )}

            {bulk && (
                <div className="wl-progress" role="status" aria-live="polite" data-testid="wl-refresh-progress">
                    <div className="wl-progress-text">
                        <RefreshCw size={13} className="wl-progress-icon" aria-hidden="true" />
                        <span>
                            Refreshing <span className="mono">{bulk.current}</span>
                        </span>
                        <span className="wl-progress-count num">{bulk.done} of {bulk.total} done</span>
                    </div>
                    <div className="wl-progress-track" aria-hidden="true">
                        <span className="wl-progress-fill" style={{ width: `${bulkPct}%` }} />
                    </div>
                </div>
            )}

            {body}

            {!showEmpty && !initialLoading && (items.length > 0 || adding) && (
                <p className="wl-footnote fade-up" style={{ '--i': 3 }}>
                    <Info size={13} aria-hidden="true" />
                    Signals come from rule-based technical analysis of recent price history. Not financial advice.
                    Data: Yahoo Finance.
                </p>
            )}

            <Modal open={report.open && Boolean(selected)} onClose={closeReport} size="xl" title={`${report.symbol || ''} report`}>
                {selected && <StockAnalysis analysis={selected} variant="modal" onClose={closeReport} />}
            </Modal>
        </div>
    );
};

export default Watchlist;
