import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Plus, RefreshCw, Search, Trash2, Wallet } from 'lucide-react';
import { formatCurrency, formatPercent, timeAgo, toNumber } from '../utils/format';
import {
    Button,
    Card,
    CardHeader,
    EmptyState,
    ErrorState,
    FlashValue,
    IconButton,
    Skeleton,
    SortHeader,
    Spinner,
    SymbolAvatar,
    cx
} from './ui';
import { QUICK_SYMBOLS, formatQty, formatSignedCurrency, researchPath, toneOf } from './PortfolioUtils';

const SORTERS = {
    symbol: (a, b) => a.symbol.localeCompare(b.symbol),
    value: (a, b) => a.value - b.value,
    pl: (a, b) => a.pl - b.pl
};

function buildRows(holdings, meta) {
    const list = Array.isArray(holdings) ? holdings : [];
    const total = list.reduce((sum, h) => sum + (toNumber(h.currentValue) ?? 0), 0);
    const rows = list.map((h) => {
        const quote = meta?.[h.symbol] || null;
        const value = toNumber(h.currentValue) ?? 0;
        return {
            id: h._id || h.symbol,
            symbol: h.symbol,
            name: quote?.name || '',
            currency: quote?.currency || 'USD',
            dayChange: toNumber(quote?.changePercent),
            shares: toNumber(h.totalShares) ?? 0,
            avgCost: toNumber(h.averageBuyPrice),
            price: toNumber(h.currentPrice),
            invested: toNumber(h.totalInvested) ?? 0,
            value,
            pl: toNumber(h.profitLoss) ?? 0,
            plPercent: toNumber(h.profitLossPercent),
            weight: total > 0 ? (value / total) * 100 : 0,
            lastUpdated: h.lastUpdated
        };
    });
    // Allocation colors by size (largest = chart-1) so neighbours never share a hue.
    [...rows].sort((a, b) => b.value - a.value).forEach((row, i) => {
        row.color = i < 7 ? `var(--sc-chart-${i + 1})` : 'var(--sc-chart-8)';
    });
    return rows;
}

function AssetLabel({ row, size = 36 }) {
    return (
        <Link to={researchPath(row.symbol)} className="pf-asset" title={`Research ${row.symbol}`}>
            <SymbolAvatar symbol={row.symbol} size={size} />
            <span className="pf-asset-text">
                <span className="pf-asset-symbol mono">{row.symbol}</span>
                {row.name ? (
                    <span className="pf-asset-name truncate">{row.name}</span>
                ) : (
                    <span className="pf-asset-name pf-asset-name--empty" aria-hidden="true" />
                )}
            </span>
        </Link>
    );
}

function WeightBar({ row }) {
    return (
        <span className="pf-weight">
            <span className="pf-weight-track" aria-hidden="true">
                <span
                    className="pf-weight-fill"
                    style={{ '--w': `${Math.max(1.5, row.weight)}%`, '--c': row.color }}
                />
            </span>
            <span className="pf-weight-pct num">{row.weight.toFixed(1)}%</span>
        </span>
    );
}

function RowActions({ row, refreshing, deleting, onRefresh, onBuyMore, onDelete }) {
    return (
        <div className="pf-row-actions">
            <IconButton
                size="sm"
                label={`Refresh ${row.symbol} price`}
                onClick={() => onRefresh(row.symbol)}
                disabled={refreshing}
                data-testid="pf-refresh"
            >
                <RefreshCw size={15} aria-hidden="true" className={cx(refreshing && 'pf-spin')} />
            </IconButton>
            <IconButton
                size="sm"
                icon={Plus}
                label={`Buy more ${row.symbol}`}
                onClick={() => onBuyMore(row.symbol)}
                data-testid="pf-buy-more"
            />
            <IconButton
                size="sm"
                label={`Remove ${row.symbol} holding`}
                className="pf-action-danger"
                onClick={() => onDelete(row.symbol)}
                disabled={deleting}
                data-testid="pf-delete-holding"
            >
                {deleting ? <Spinner size={15} /> : <Trash2 size={15} aria-hidden="true" />}
            </IconButton>
        </div>
    );
}

function AllocationBar({ rows }) {
    const sorted = [...rows].sort((a, b) => b.value - a.value);
    const label = sorted.map((r) => `${r.symbol} ${r.weight.toFixed(1)}%`).join(', ');
    return (
        <div className="pf-alloc">
            <div className="pf-alloc-bar" role="img" aria-label={`Allocation by value: ${label}`}>
                {sorted.map((r) => (
                    <span
                        key={r.symbol}
                        className="pf-alloc-seg"
                        style={{ flexGrow: Math.max(r.weight, 0.01), '--c': r.color }}
                        title={`${r.symbol} ${r.weight.toFixed(1)}%`}
                    />
                ))}
            </div>
            <ul className="pf-alloc-legend" aria-hidden="true">
                {sorted.map((r) => (
                    <li key={r.symbol} className="pf-alloc-item">
                        <span className="pf-alloc-dot" style={{ '--c': r.color }} />
                        <span className="mono">{r.symbol}</span>
                        <span className="num muted">{r.weight.toFixed(1)}%</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function HoldingsSkeleton({ isPhone }) {
    const rows = [0, 1, 2, 3];
    if (isPhone) {
        return (
            <ul className="pf-hlist" aria-hidden="true">
                {rows.map((i) => (
                    <li key={i} className="pf-hitem">
                        <div className="pf-hitem-top">
                            <span className="pf-asset">
                                <Skeleton width={36} height={36} radius={11} />
                                <span className="pf-asset-text">
                                    <Skeleton width={56} height={13} />
                                    <Skeleton width={96} height={11} />
                                </span>
                            </span>
                            <span className="pf-hitem-value">
                                <Skeleton width={84} height={14} />
                                <Skeleton width={64} height={11} />
                            </span>
                        </div>
                        <Skeleton width="100%" height={6} radius={999} />
                    </li>
                ))}
            </ul>
        );
    }
    return (
        <div className="ui-table-wrap ui-table-wrap--flush pf-bleed pf-bleed--end" aria-hidden="true">
            <table className="ui-table pf-table pf-htable">
                <thead>
                    <tr>
                        {['Asset', 'Shares', 'Avg cost', 'Price', 'Value', 'P/L', 'Weight', ''].map((h, i) => (
                            <th key={h || i} scope="col" className={i > 0 && i < 6 ? 'num' : undefined}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((i) => (
                        <tr key={i}>
                            <td>
                                <span className="pf-asset">
                                    <Skeleton width={36} height={36} radius={11} />
                                    <span className="pf-asset-text">
                                        <Skeleton width={52} height={13} />
                                        <Skeleton width={110} height={11} />
                                    </span>
                                </span>
                            </td>
                            {[44, 64, 64, 76, 72].map((w, j) => (
                                <td key={j} className="num"><Skeleton width={w} height={13} className="pf-skel-right" /></td>
                            ))}
                            <td><Skeleton width={110} height={8} radius={999} /></td>
                            <td><Skeleton width={96} height={28} radius={8} className="pf-skel-right" /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/**
 * Open positions: allocation strip, sortable table (desktop) or card list (phone),
 * per-row refresh / buy more / remove.
 */
export function PortfolioHoldings({
    holdings,
    meta,
    loading,
    error,
    onRetry,
    isPhone,
    refreshing,
    deleting,
    onRefresh,
    onRefreshAll,
    onBuyMore,
    onDelete,
    onAdd,
    hasTransactions,
    now,
    style
}) {
    const [sort, setSort] = useState({ key: 'value', dir: 'desc' });
    const hasData = Array.isArray(holdings);
    const rows = buildRows(holdings, meta);
    const sorted = [...rows].sort((a, b) => {
        const diff = SORTERS[sort.key](a, b);
        return sort.dir === 'asc' ? diff : -diff;
    });
    const toggleSort = (key) => setSort((s) => (s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'symbol' ? 'asc' : 'desc' }));

    const totals = rows.reduce((acc, r) => ({ value: acc.value + r.value, invested: acc.invested + r.invested, pl: acc.pl + r.pl }), { value: 0, invested: 0, pl: 0 });
    const totalPlPercent = totals.invested > 0 ? (totals.pl / totals.invested) * 100 : null;
    const latest = rows.reduce((max, r) => {
        const t = r.lastUpdated ? new Date(r.lastUpdated).getTime() : 0;
        return Number.isFinite(t) && t > max ? t : max;
    }, 0);

    const subtitle = !hasData
        ? 'Positions you currently hold'
        : rows.length === 0
            ? 'Positions you currently hold'
            : `${rows.length} open ${rows.length === 1 ? 'position' : 'positions'}${latest ? ` · prices updated ${timeAgo(latest, new Date(Math.max(now, latest)))}` : ''}`;

    const refreshAll = hasData && rows.length > 0 ? (
        <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            loading={loading}
            onClick={onRefreshAll}
            data-testid="pf-refresh-all"
            className="pf-refresh-all"
        >
            <span className="pf-hide-phone">Refresh prices</span>
            <span className="pf-show-phone">Refresh</span>
        </Button>
    ) : null;

    let body;
    if (!hasData && loading) {
        body = <HoldingsSkeleton isPhone={isPhone} />;
    } else if (!hasData && error) {
        body = <ErrorState compact title="Couldn't load your holdings" message={error.message} onRetry={onRetry} />;
    } else if (rows.length === 0) {
        body = (
            <EmptyState
                icon={Wallet}
                className="pf-empty"
                title={hasTransactions ? 'No open positions' : 'No holdings yet'}
                description={hasTransactions
                    ? 'You have sold everything you bought. Your past trades are listed under Transactions.'
                    : 'Record a buy to start tracking market value, cost basis and profit for each position.'}
                action={(
                    <div className="pf-empty-actions">
                        <Button variant="secondary" icon={Plus} onClick={() => onAdd()} data-testid="pf-empty-add">
                            Add your first transaction
                        </Button>
                        <div className="pf-quick">
                            <span className="pf-quick-label">Quick start</span>
                            {QUICK_SYMBOLS.map((s) => (
                                <button key={s} type="button" className="pf-chip mono" onClick={() => onAdd({ symbol: s })}>
                                    {s}
                                </button>
                            ))}
                        </div>
                        <Link to="/research" className="pf-empty-link">
                            <Search size={14} aria-hidden="true" />
                            Or research a stock first
                        </Link>
                    </div>
                )}
            />
        );
    } else if (isPhone) {
        body = (
            <>
                <AllocationBar rows={rows} />
                <ul className={cx('pf-hlist', loading && 'is-refreshing')}>
                    {sorted.map((row, index) => (
                        <li key={row.id} className="pf-hitem fade-up" style={{ '--i': index }} data-testid="holding-row">
                            <div className="pf-hitem-top">
                                <AssetLabel row={row} size={36} />
                                <span className="pf-hitem-value">
                                    <span className="num pf-strong">{formatCurrency(row.value, row.currency)}</span>
                                    <span className={cx('num pf-small', toneOf(row.pl))}>
                                        {formatSignedCurrency(row.pl, row.currency)} ({formatPercent(row.plPercent)})
                                    </span>
                                </span>
                            </div>
                            <dl className="pf-hitem-stats">
                                <div>
                                    <dt>Quantity</dt>
                                    <dd className="num">{formatQty(row.shares)}</dd>
                                </div>
                                <div>
                                    <dt>Avg cost</dt>
                                    <dd className="num">{formatCurrency(row.avgCost, row.currency)}</dd>
                                </div>
                                <div>
                                    <dt>Price</dt>
                                    <dd className="num">
                                        <FlashValue value={row.price}>{formatCurrency(row.price, row.currency)}</FlashValue>
                                    </dd>
                                </div>
                            </dl>
                            <div className="pf-hitem-foot">
                                <WeightBar row={row} />
                                <RowActions
                                    row={row}
                                    refreshing={refreshing.has(row.symbol)}
                                    deleting={deleting === row.symbol}
                                    onRefresh={onRefresh}
                                    onBuyMore={onBuyMore}
                                    onDelete={onDelete}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            </>
        );
    } else {
        body = (
            <>
                <AllocationBar rows={rows} />
                <div className="ui-table-wrap ui-table-wrap--flush pf-bleed pf-bleed--end">
                    <table className={cx('ui-table pf-table pf-htable', loading && 'is-refreshing')}>
                        <caption className="sr-only">Holdings, sortable by asset, value and profit or loss</caption>
                        <thead>
                            <tr>
                                <SortHeader label="Asset" active={sort.key === 'symbol'} direction={sort.dir} onClick={() => toggleSort('symbol')} testId="pf-sort-symbol" />
                                <th scope="col" className="num">Shares</th>
                                <th scope="col" className="num">Avg cost</th>
                                <th scope="col" className="num">Price</th>
                                <SortHeader label="Value" align="right" active={sort.key === 'value'} direction={sort.dir} onClick={() => toggleSort('value')} testId="pf-sort-value" />
                                <SortHeader label="P/L" align="right" active={sort.key === 'pl'} direction={sort.dir} onClick={() => toggleSort('pl')} testId="pf-sort-pl" />
                                <th scope="col" className="pf-col-weight">Weight</th>
                                <th scope="col" className="pf-col-actions"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((row, index) => (
                                <tr key={row.id} className="fade-up" style={{ '--i': index }} data-testid="holding-row">
                                    <td><AssetLabel row={row} /></td>
                                    <td className="num">{formatQty(row.shares)}</td>
                                    <td className="num">{formatCurrency(row.avgCost, row.currency)}</td>
                                    <td className="num">
                                        <span className="pf-stack">
                                            <FlashValue value={row.price} className="pf-strong">{formatCurrency(row.price, row.currency)}</FlashValue>
                                            {row.dayChange !== null && (
                                                <span className={cx('pf-small', toneOf(row.dayChange) || 'muted')}>
                                                    {formatPercent(row.dayChange)} today
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="num pf-strong">{formatCurrency(row.value, row.currency)}</td>
                                    <td className="num">
                                        <span className="pf-stack">
                                            <span className={cx('pf-strong', toneOf(row.pl))}>{formatSignedCurrency(row.pl, row.currency)}</span>
                                            <span className={cx('pf-small', toneOf(row.pl) || 'muted')}>{formatPercent(row.plPercent)}</span>
                                        </span>
                                    </td>
                                    <td className="pf-col-weight"><WeightBar row={row} /></td>
                                    <td className="pf-col-actions">
                                        <RowActions
                                            row={row}
                                            refreshing={refreshing.has(row.symbol)}
                                            deleting={deleting === row.symbol}
                                            onRefresh={onRefresh}
                                            onBuyMore={onBuyMore}
                                            onDelete={onDelete}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="pf-total-row">
                                <th scope="row">Total</th>
                                <td className="num muted" colSpan={3}>
                                    Invested {formatCurrency(totals.invested)}
                                </td>
                                <td className="num pf-strong">{formatCurrency(totals.value)}</td>
                                <td className="num">
                                    <span className="pf-stack">
                                        <span className={cx('pf-strong', toneOf(totals.pl))}>{formatSignedCurrency(totals.pl)}</span>
                                        <span className={cx('pf-small', toneOf(totals.pl) || 'muted')}>{formatPercent(totalPlPercent)}</span>
                                    </span>
                                </td>
                                <td className="pf-col-weight"><span className="pf-weight-pct num muted">100%</span></td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </>
        );
    }

    return (
        <Card className="pf-card fade-up" style={style} data-testid="pf-holdings" aria-busy={loading || undefined}>
            <CardHeader
                icon={Layers}
                title="Holdings"
                subtitle={subtitle}
                action={refreshAll}
            />
            {hasData && error && (
                <div className="pf-inline-alert" role="alert">
                    Couldn&apos;t refresh holdings: {error.message}
                    <button type="button" className="pf-link-btn" onClick={onRetry}>Retry</button>
                </div>
            )}
            {body}
        </Card>
    );
}

export default PortfolioHoldings;
