import { useEffect, useEffectEvent, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../hooks/useConfirm';
import { useDebounce } from '../hooks/useDebounce';
import { useInterval } from '../hooks/useInterval';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useToast } from '../hooks/useToast';
import portfolioApi from '../services/portfolioApi';
import stockApi from '../services/stockApi';
import { formatCurrency, formatDate } from '../utils/format';
import { Button, PageHeader } from './ui';
import { PortfolioHoldings } from './PortfolioHoldings';
import { PortfolioKpis } from './PortfolioKpis';
import { PortfolioTransactions } from './PortfolioTransactions';
import { PortfolioTxModal } from './PortfolioTxModal';
import { TX_PAGE_SIZE, formatQty, txDateKey } from './PortfolioUtils';
import './Portfolio.css';

/**
 * Loads `load()` whenever `key` changes (null = wait). Keeps the last data while a
 * new request is in flight so refreshes never blank a section.
 * -> { data, error, loading, mutate(fn) }
 */
function useRemote(key, load) {
    const [state, setState] = useState({ key: null, data: undefined, error: null });
    const run = useEffectEvent(() => load());

    useEffect(() => {
        if (key === null) return undefined;
        let alive = true;
        Promise.resolve(run()).then(
            (data) => {
                if (alive) setState({ key, data, error: null });
            },
            (error) => {
                if (alive) setState((prev) => ({ key, data: prev.data, error: error instanceof Error ? error : new Error(String(error)) }));
            }
        );
        return () => {
            alive = false;
        };
    }, [key]);

    const loading = key !== null && state.key !== key;
    return {
        data: state.data,
        error: loading ? null : state.error,
        loading,
        mutate: (fn) => setState((prev) => ({ ...prev, data: fn(prev.data) }))
    };
}

const Portfolio = () => {
    const { token } = useAuth();
    const toast = useToast();
    const confirm = useConfirm();
    const isPhone = useMediaQuery('(max-width: 767px)');
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();

    // Bumping a version refetches that resource (the summary/performance keys include the holdings version).
    const [holdingsV, setHoldingsV] = useState(0);
    const [summaryV, setSummaryV] = useState(0);
    const [perfV, setPerfV] = useState(0);
    const [txV, setTxV] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    useInterval(() => setNow(Date.now()), 30000);

    const holdings = useRemote(token ? `h:${token}:${holdingsV}` : null, async () => {
        const list = await portfolioApi.getHoldings(token);
        return Array.isArray(list) ? list : [];
    });
    const summary = useRemote(token ? `s:${token}:${holdingsV}:${summaryV}` : null, () => portfolioApi.getSummary(token));
    const performance = useRemote(token ? `p:${token}:${holdingsV}:${perfV}` : null, () => portfolioApi.getPerformance(token));

    // Names, currency and day change for each holding (light quotes, fetched after the holdings).
    const symbols = Array.isArray(holdings.data) ? [...new Set(holdings.data.map((h) => h.symbol))].sort() : [];
    const meta = useRemote(symbols.length ? `m:${symbols.join(',')}:${holdingsV}` : null, async () => {
        const quotes = await Promise.all(symbols.map((s) => stockApi.getQuote(s).catch(() => null)));
        return Object.fromEntries(symbols.map((s, i) => [s, quotes[i]]).filter(([, q]) => q));
    });
    const metaMap = meta.data || {};

    // Transactions: server-side filter, search, sort and paging.
    const [txType, setTxType] = useState('ALL');
    const [txSearch, setTxSearch] = useState('');
    const [txSort, setTxSort] = useState('desc');
    const [txPage, setTxPage] = useState(1);
    const debouncedSearch = useDebounce(txSearch.trim().toUpperCase(), 300);
    const txQuery = {
        page: txPage,
        limit: TX_PAGE_SIZE,
        sortBy: 'transactionDate',
        sortOrder: txSort,
        ...(txType !== 'ALL' ? { type: txType } : {}),
        ...(debouncedSearch ? { symbol: debouncedSearch } : {})
    };
    const transactions = useRemote(token ? `t:${token}:${JSON.stringify(txQuery)}:${txV}` : null, () => portfolioApi.getTransactions(txQuery, token));
    const txPages = Number(transactions.data?.pagination?.pages) || 0;
    // A delete can leave the current page empty: step back to the last page that exists.
    if (!transactions.loading && transactions.data && txPage > 1 && txPage > Math.max(1, txPages)) {
        setTxPage(Math.max(1, txPages));
    }

    const holdingsBySymbol = Object.fromEntries((holdings.data || []).map((h) => [h.symbol, h]));
    const [hasAnyTx, setHasAnyTx] = useState(null);
    const unfilteredTotal = txType === 'ALL' && !debouncedSearch && transactions.data ? Number(transactions.data.pagination?.total) || 0 : null;
    if (unfilteredTotal !== null && (unfilteredTotal > 0) !== hasAnyTx) setHasAnyTx(unfilteredTotal > 0);

    const reloadAll = () => {
        setHoldingsV((v) => v + 1);
        setTxV((v) => v + 1);
    };

    // Add / edit modal. A new `session` remounts the form so it always starts clean.
    const [modal, setModal] = useState({ open: false, session: 0, mode: 'add', initial: null });
    const openAdd = (preset = {}) => setModal((m) => ({
        open: true,
        session: m.session + 1,
        mode: 'add',
        initial: { symbol: preset.symbol || '', type: preset.type === 'SELL' ? 'SELL' : 'BUY' }
    }));
    const openEdit = (tx) => setModal((m) => ({ open: true, session: m.session + 1, mode: 'edit', initial: tx }));
    const closeModal = () => setModal((m) => ({ ...m, open: false }));

    // Deep link: /portfolio?add=1&symbol=XYZ[&type=SELL] opens the form, then the params are cleared.
    const wantsAdd = searchParams.get('add') === '1';
    const [handledLink, setHandledLink] = useState(null);
    if (wantsAdd && handledLink !== location.key) {
        setHandledLink(location.key);
        openAdd({
            symbol: (searchParams.get('symbol') || '').trim().toUpperCase(),
            type: (searchParams.get('type') || '').trim().toUpperCase()
        });
    }
    useEffect(() => {
        if (wantsAdd) setSearchParams({}, { replace: true });
    }, [wantsAdd, setSearchParams]);

    // Row actions --------------------------------------------------------------------
    const [refreshing, setRefreshing] = useState(() => new Set());
    const [deletingSymbol, setDeletingSymbol] = useState(null);
    const [deletingTx, setDeletingTx] = useState(null);

    const refreshHolding = async (symbol) => {
        setRefreshing((s) => new Set(s).add(symbol));
        try {
            const [updated, quote] = await Promise.all([
                portfolioApi.updateHolding(symbol, token),
                stockApi.getQuote(symbol).catch(() => null)
            ]);
            holdings.mutate((list) => (Array.isArray(list) ? list.map((h) => (h.symbol === symbol ? { ...h, ...updated } : h)) : list));
            if (quote) meta.mutate((m) => ({ ...(m || {}), [symbol]: quote }));
            setSummaryV((v) => v + 1);
            setPerfV((v) => v + 1);
            toast.success(`${symbol} is at ${formatCurrency(updated?.currentPrice, quote?.currency || 'USD')}.`, { title: 'Price updated' });
        } catch (error) {
            toast.error(error.message, { title: `Couldn't refresh ${symbol}` });
        } finally {
            setRefreshing((s) => {
                const next = new Set(s);
                next.delete(symbol);
                return next;
            });
        }
    };

    const deleteHolding = async (symbol) => {
        const ok = await confirm({
            title: `Remove ${symbol} from your portfolio?`,
            message: `This deletes your ${symbol} position and every ${symbol} transaction. It can't be undone.`,
            confirmLabel: 'Remove holding'
        });
        if (!ok) return;
        setDeletingSymbol(symbol);
        try {
            await portfolioApi.deleteHoldings(symbol, token);
            toast.success(`${symbol} and its transactions were removed.`, { title: 'Holding removed' });
            reloadAll();
        } catch (error) {
            toast.error(error.message, { title: `Couldn't remove ${symbol}` });
        } finally {
            setDeletingSymbol(null);
        }
    };

    const deleteTransaction = async (tx) => {
        const date = formatDate(txDateKey(tx.transactionDate), 'medium');
        const ok = await confirm({
            title: 'Delete this transaction?',
            message: `${tx.type === 'BUY' ? 'Buy' : 'Sell'} of ${formatQty(tx.quantity)} ${tx.symbol} at ${formatCurrency(tx.pricePerShare, metaMap[tx.symbol]?.currency || 'USD')} on ${date}. Your ${tx.symbol} holding is recalculated from the remaining transactions.`,
            confirmLabel: 'Delete transaction'
        });
        if (!ok) return;
        setDeletingTx(tx._id);
        try {
            await portfolioApi.deleteTransaction(tx._id, token);
            toast.success(`The ${tx.symbol} ${tx.type === 'BUY' ? 'buy' : 'sell'} from ${date} was deleted.`, { title: 'Transaction deleted' });
            reloadAll();
        } catch (error) {
            toast.error(error.message, { title: "Couldn't delete the transaction" });
        } finally {
            setDeletingTx(null);
        }
    };

    const clearFilters = () => {
        setTxType('ALL');
        setTxSearch('');
        setTxPage(1);
    };

    return (
        <div className="pf-page">
            <PageHeader
                className="pf-header fade-up"
                title="Portfolio"
                subtitle="Your positions, cost basis and every trade you have recorded, valued at the latest market prices."
                actions={(
                    <Button icon={Plus} onClick={() => openAdd()} data-testid="pf-add">
                        Add transaction
                    </Button>
                )}
            />

            <PortfolioKpis
                summary={summary.data}
                summaryLoading={!summary.data && summary.loading}
                summaryError={!summary.data ? summary.error : null}
                performance={performance.data}
                perfLoading={!performance.data && performance.loading}
                perfError={!performance.data ? performance.error : null}
                onRetrySummary={() => setSummaryV((v) => v + 1)}
                onRetryPerf={() => setPerfV((v) => v + 1)}
            />

            <PortfolioHoldings
                style={{ '--i': 5 }}
                holdings={holdings.data}
                meta={metaMap}
                loading={holdings.loading}
                error={holdings.error}
                onRetry={() => setHoldingsV((v) => v + 1)}
                isPhone={isPhone}
                refreshing={refreshing}
                deleting={deletingSymbol}
                onRefresh={refreshHolding}
                onRefreshAll={() => setHoldingsV((v) => v + 1)}
                onBuyMore={(symbol) => openAdd({ symbol, type: 'BUY' })}
                onDelete={deleteHolding}
                onAdd={openAdd}
                hasTransactions={Boolean(hasAnyTx)}
                now={now}
            />

            <PortfolioTransactions
                style={{ '--i': 6 }}
                data={transactions.data}
                loading={transactions.loading}
                error={transactions.error}
                onRetry={() => setTxV((v) => v + 1)}
                type={txType}
                onTypeChange={(value) => {
                    setTxType(value);
                    setTxPage(1);
                }}
                search={txSearch}
                onSearchChange={(value) => {
                    setTxSearch(value);
                    setTxPage(1);
                }}
                sortOrder={txSort}
                onSortToggle={() => {
                    setTxSort((s) => (s === 'desc' ? 'asc' : 'desc'));
                    setTxPage(1);
                }}
                page={txPage}
                onPageChange={setTxPage}
                onClearFilters={clearFilters}
                isPhone={isPhone}
                deletingId={deletingTx}
                onEdit={openEdit}
                onDelete={deleteTransaction}
                currencyFor={(symbol) => metaMap[symbol]?.currency || 'USD'}
            />

            {modal.session > 0 && (
                <PortfolioTxModal
                    key={modal.session}
                    open={modal.open}
                    mode={modal.mode}
                    initial={modal.initial}
                    holdingsBySymbol={holdingsBySymbol}
                    token={token}
                    onClose={closeModal}
                    onSaved={() => {
                        closeModal();
                        reloadAll();
                    }}
                />
            )}
        </div>
    );
};

export default Portfolio;
