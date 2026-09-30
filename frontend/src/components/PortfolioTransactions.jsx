import { CalendarArrowDown, CalendarArrowUp, FilterX, Pencil, Receipt, Search, SearchX, Trash2, X } from 'lucide-react';
import { formatCurrency, formatDate, formatNumber } from '../utils/format';
import {
    Badge,
    Button,
    Card,
    CardHeader,
    EmptyState,
    ErrorState,
    IconButton,
    Pagination,
    SegmentedControl,
    Skeleton,
    SortHeader,
    Spinner,
    SymbolAvatar,
    cx
} from './ui';
import { TX_PAGE_SIZE, formatQty, txDateKey, txTotal, unitLabel } from './PortfolioUtils';

const TYPE_OPTIONS = [
    { label: 'All', value: 'ALL' },
    { label: 'Buys', value: 'BUY' },
    { label: 'Sells', value: 'SELL' }
];

function TypeBadge({ type }) {
    const buy = type === 'BUY';
    return (
        <Badge tone={buy ? 'gain' : 'loss'} size="sm" className="pf-type-badge">
            {buy ? 'BUY' : 'SELL'}
        </Badge>
    );
}

function describe(tx) {
    return `${tx.type === 'BUY' ? 'buy' : 'sell'} of ${tx.symbol} on ${formatDate(txDateKey(tx.transactionDate), 'medium')}`;
}

function TxActions({ tx, deleting, onEdit, onDelete }) {
    return (
        <div className="pf-row-actions">
            <IconButton size="sm" icon={Pencil} label={`Edit ${describe(tx)}`} onClick={() => onEdit(tx)} data-testid="tx-edit" />
            <IconButton
                size="sm"
                label={`Delete ${describe(tx)}`}
                className="pf-action-danger"
                onClick={() => onDelete(tx)}
                disabled={deleting}
                data-testid="tx-delete"
            >
                {deleting ? <Spinner size={15} /> : <Trash2 size={15} aria-hidden="true" />}
            </IconButton>
        </div>
    );
}

function TxSkeleton({ isPhone }) {
    const rows = [0, 1, 2, 3, 4];
    if (isPhone) {
        return (
            <ul className="pf-tlist" aria-hidden="true">
                {rows.map((i) => (
                    <li key={i} className="pf-titem">
                        <div className="pf-titem-main">
                            <Skeleton width={32} height={32} radius={10} />
                            <span className="pf-titem-text">
                                <Skeleton width={110} height={13} />
                                <Skeleton width={150} height={11} />
                            </span>
                        </div>
                        <Skeleton width={72} height={14} />
                    </li>
                ))}
            </ul>
        );
    }
    return (
        <div className="ui-table-wrap ui-table-wrap--flush pf-bleed" aria-hidden="true">
            <table className="ui-table pf-table pf-ttable">
                <thead>
                    <tr>
                        {['Date', 'Type', 'Asset', 'Quantity', 'Price', 'Total', 'Notes', ''].map((h, i) => (
                            <th key={h || i} scope="col" className={i >= 3 && i <= 5 ? 'num' : undefined}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((i) => (
                        <tr key={i}>
                            <td><Skeleton width={84} height={13} /></td>
                            <td><Skeleton width={40} height={20} radius={999} /></td>
                            <td>
                                <span className="pf-tx-asset">
                                    <Skeleton width={28} height={28} radius={9} />
                                    <Skeleton width={48} height={13} />
                                </span>
                            </td>
                            <td className="num"><Skeleton width={36} height={13} className="pf-skel-right" /></td>
                            <td className="num"><Skeleton width={64} height={13} className="pf-skel-right" /></td>
                            <td className="num"><Skeleton width={72} height={13} className="pf-skel-right" /></td>
                            <td><Skeleton width={120} height={13} /></td>
                            <td><Skeleton width={64} height={28} radius={8} className="pf-skel-right" /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/**
 * Transaction history with server-side type filter, symbol search, date sort and paging.
 */
export function PortfolioTransactions({
    data,
    loading,
    error,
    onRetry,
    type,
    onTypeChange,
    search,
    onSearchChange,
    sortOrder,
    onSortToggle,
    page,
    onPageChange,
    onClearFilters,
    isPhone,
    deletingId,
    onEdit,
    onDelete,
    currencyFor,
    style
}) {
    const hasData = Boolean(data);
    const items = Array.isArray(data?.transactions) ? data.transactions : [];
    const total = Number(data?.pagination?.total) || 0;
    const pages = Number(data?.pagination?.pages) || 0;
    const currentPage = Number(data?.pagination?.page) || page;
    const filtered = type !== 'ALL' || search.trim() !== '';
    const from = total ? (currentPage - 1) * TX_PAGE_SIZE + 1 : 0;
    const to = Math.min(total, (currentPage - 1) * TX_PAGE_SIZE + items.length);
    const newestFirst = sortOrder !== 'asc';

    const nothingYet = hasData && !filtered && total === 0;
    const subtitle = !hasData || nothingYet
        ? 'Every buy and sell you record'
        : filtered
            ? `${total} matching ${total === 1 ? 'transaction' : 'transactions'}`
            : `${total} recorded · ${newestFirst ? 'newest' : 'oldest'} first`;

    const toolbar = (
        <div className="pf-toolbar" role="search" aria-label="Filter transactions">
            <SegmentedControl
                options={TYPE_OPTIONS}
                value={type}
                onChange={onTypeChange}
                size="sm"
                testId="tx-filter-type"
                aria-label="Transaction type"
                className="pf-toolbar-seg"
            />
            <div className="ui-input-group pf-toolbar-search">
                <Search size={15} className="ui-input-icon" aria-hidden="true" />
                <input
                    type="search"
                    className="ui-input ui-input--sm pf-search-input"
                    placeholder="Filter by symbol, e.g. AAPL"
                    aria-label="Filter transactions by symbol"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape' && search) {
                            e.preventDefault();
                            onSearchChange('');
                        }
                    }}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    data-testid="tx-search"
                />
                {search && (
                    <button type="button" className="pf-search-clear" aria-label="Clear symbol filter" onClick={() => onSearchChange('')}>
                        <X size={14} aria-hidden="true" />
                    </button>
                )}
            </div>
            <Button
                variant="secondary"
                size="sm"
                icon={newestFirst ? CalendarArrowDown : CalendarArrowUp}
                onClick={onSortToggle}
                aria-label={`Sorted ${newestFirst ? 'newest' : 'oldest'} first. Switch to ${newestFirst ? 'oldest' : 'newest'} first`}
                data-testid="tx-sort"
                className="pf-toolbar-sort"
            >
                {newestFirst ? 'Newest first' : 'Oldest first'}
            </Button>
        </div>
    );

    let body;
    if (!hasData && loading) {
        body = <TxSkeleton isPhone={isPhone} />;
    } else if (!hasData && error) {
        body = <ErrorState compact title="Couldn't load transactions" message={error.message} onRetry={onRetry} />;
    } else if (items.length === 0) {
        body = filtered ? (
            <EmptyState
                compact
                icon={SearchX}
                className="pf-empty pf-empty--tx"
                title="No matching transactions"
                description={search.trim()
                    ? `Nothing matches “${search.trim().toUpperCase()}”${type !== 'ALL' ? ` in ${type === 'BUY' ? 'buys' : 'sells'}` : ''}. The symbol filter uses the full ticker, like AAPL or BTC-USD.`
                    : `You haven't recorded any ${type === 'BUY' ? 'buys' : 'sells'} yet.`}
                action={<Button variant="secondary" size="sm" icon={FilterX} onClick={onClearFilters} data-testid="tx-clear-filters">Clear filters</Button>}
            />
        ) : (
            <EmptyState
                compact
                icon={Receipt}
                className="pf-empty pf-empty--tx"
                title="No transactions yet"
                description="Buys and sells you record show up here, with filters by type and symbol."
            />
        );
    } else if (isPhone) {
        body = (
            <ul className={cx('pf-tlist', loading && 'is-refreshing')}>
                {items.map((tx, index) => {
                    const currency = currencyFor(tx.symbol);
                    return (
                        <li key={tx._id} className="pf-titem fade-up" style={{ '--i': index }} data-testid="tx-row">
                            <div className="pf-titem-main">
                                <SymbolAvatar symbol={tx.symbol} size={32} />
                                <span className="pf-titem-text">
                                    <span className="pf-titem-title">
                                        <span className="mono pf-strong">{tx.symbol}</span>
                                        <TypeBadge type={tx.type} />
                                    </span>
                                    <span className="pf-small muted num">
                                        {formatDate(txDateKey(tx.transactionDate), 'medium')} · {formatQty(tx.quantity)} × {formatCurrency(tx.pricePerShare, currency)}
                                    </span>
                                    {tx.notes && <span className="pf-small muted truncate pf-titem-note">{tx.notes}</span>}
                                </span>
                            </div>
                            <div className="pf-titem-side">
                                <span className="num pf-strong">{formatCurrency(txTotal(tx), currency)}</span>
                                <TxActions tx={tx} deleting={deletingId === tx._id} onEdit={onEdit} onDelete={onDelete} />
                            </div>
                        </li>
                    );
                })}
            </ul>
        );
    } else {
        body = (
            <div className="ui-table-wrap ui-table-wrap--flush pf-bleed">
                <table className={cx('ui-table pf-table pf-ttable', loading && 'is-refreshing')}>
                    <caption className="sr-only">Transactions, page {currentPage} of {Math.max(1, pages)}</caption>
                    <thead>
                        <tr>
                            <SortHeader
                                label="Date"
                                active
                                direction={newestFirst ? 'desc' : 'asc'}
                                onClick={onSortToggle}
                                testId="tx-sort-date"
                            />
                            <th scope="col">Type</th>
                            <th scope="col">Asset</th>
                            <th scope="col" className="num">Quantity</th>
                            <th scope="col" className="num">Price</th>
                            <th scope="col" className="num">Total</th>
                            <th scope="col" className="pf-col-notes">Notes</th>
                            <th scope="col" className="pf-col-actions"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((tx, index) => {
                            const currency = currencyFor(tx.symbol);
                            return (
                                <tr key={tx._id} className="fade-up" style={{ '--i': index }} data-testid="tx-row">
                                    <td className="pf-date">{formatDate(txDateKey(tx.transactionDate), 'medium')}</td>
                                    <td><TypeBadge type={tx.type} /></td>
                                    <td>
                                        <span className="pf-tx-asset">
                                            <SymbolAvatar symbol={tx.symbol} size={28} />
                                            <span className="mono pf-strong">{tx.symbol}</span>
                                        </span>
                                    </td>
                                    <td className="num">
                                        {formatQty(tx.quantity)}
                                        <span className="pf-unit muted"> {unitLabel(tx.symbol, tx.quantity)}</span>
                                    </td>
                                    <td className="num">{formatCurrency(tx.pricePerShare, currency)}</td>
                                    <td className="num pf-strong">{formatCurrency(txTotal(tx), currency)}</td>
                                    <td className="pf-col-notes">
                                        {tx.notes
                                            ? <span className="pf-note truncate" title={tx.notes}>{tx.notes}</span>
                                            : <span className="pf-note pf-note--empty" aria-label="No notes">—</span>}
                                    </td>
                                    <td className="pf-col-actions">
                                        <TxActions tx={tx} deleting={deletingId === tx._id} onEdit={onEdit} onDelete={onDelete} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <Card className="pf-card fade-up" style={style} data-testid="pf-transactions" aria-busy={loading || undefined}>
            <CardHeader
                icon={Receipt}
                title="Transactions"
                subtitle={subtitle}
                action={loading && hasData ? <Spinner size={16} label="Updating transactions" /> : null}
            />
            {!nothingYet && toolbar}
            {hasData && error && (
                <div className="pf-inline-alert" role="alert">
                    Couldn&apos;t update the list: {error.message}
                    <button type="button" className="pf-link-btn" onClick={onRetry}>Retry</button>
                </div>
            )}
            {body}
            {hasData && total > 0 && (
                <div className="pf-tfoot">
                    <span className="pf-small muted num" aria-live="polite">
                        Showing {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
                    </span>
                    <Pagination page={currentPage} pages={pages} onChange={onPageChange} testId="tx-pagination" aria-label="Transaction pages" />
                </div>
            )}
        </Card>
    );
}

export default PortfolioTransactions;
