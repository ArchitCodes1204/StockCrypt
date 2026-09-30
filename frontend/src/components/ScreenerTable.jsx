import { ChevronRight } from 'lucide-react';
import { formatCompact, formatCurrency, formatNumber, formatPercent } from '../utils/format';
import { Badge, ChangePill, FlashValue, Skeleton, SortHeader, Sparkline, SymbolAvatar, cx } from './ui';
import { ratingReason } from './ScreenerModel';

const MAX_STAGGER = 12;

/** Technical rating badge (icon + label, so it never relies on color alone). */
export function ScreenerRating({ row, size = 'md' }) {
    const { rating } = row;
    return (
        <Badge
            tone={rating.tone}
            icon={rating.icon}
            size={size}
            className={cx('scr-rating', `scr-rating--${rating.slug}`)}
            title={ratingReason(row)}
        >
            {rating.value}
        </Badge>
    );
}

/** Where the price sits inside its 52-week range. */
function RangeMeter({ row }) {
    if (row.rangePos === null) return <span className="muted">—</span>;
    const pct = Math.round(row.rangePos * 100);
    const label = `${pct}% of the 52-week range, ${formatCurrency(row.yearLow, row.currency)} to ${formatCurrency(row.yearHigh, row.currency)}`;
    return (
        <span className="scr-range" title={label} role="img" aria-label={label}>
            <span className="scr-range-track">
                <span className="scr-range-marker" style={{ left: `${pct}%` }} />
            </span>
            <span className="scr-range-value num">{pct}%</span>
        </span>
    );
}

function signedCurrency(value, currency) {
    if (value === null) return '—';
    return `${value > 0 ? '+' : ''}${formatCurrency(value, currency)}`;
}

function MonthTrend({ row, width = 84, height = 28 }) {
    if (row.sparkline.length < 2) return <span className="muted">—</span>;
    return (
        <span className="scr-trend">
            <Sparkline data={row.sparkline} width={width} height={height} ariaLabel={`1-month trend ${formatPercent(row.month)}`} />
            <span className={cx('scr-trend-value', 'num', row.month > 0 ? 'gain' : row.month < 0 ? 'loss' : 'muted')}>
                {formatPercent(row.month, { digits: 1 })}
            </span>
        </span>
    );
}

function Header({ id, label, sort, onSort, align = 'right', title }) {
    return (
        <SortHeader
            label={label}
            align={align}
            active={sort.key === id}
            direction={sort.dir}
            onClick={() => onSort(id)}
            testId={`scr-sort-${id}`}
            title={title}
        />
    );
}

/** Desktop / tablet table. */
export function ScreenerTable({ rows, market, sort, onSort, onOpen, loading }) {
    const crypto = market === 'crypto';
    return (
        <div className="ui-table-wrap ui-table-wrap--flush scr-table-wrap">
            <table className="ui-table scr-table" data-testid="scr-table" aria-busy={loading || undefined}>
                <caption className="sr-only">
                    {crypto ? 'Cryptocurrency' : 'Stock'} screener. Select a row to open its research report.
                </caption>
                <thead>
                    <tr>
                        <Header id="symbol" label="Symbol" align="left" sort={sort} onSort={onSort} />
                        <Header id="price" label="Price" sort={sort} onSort={onSort} />
                        <Header id="changePercent" label="Chg %" sort={sort} onSort={onSort} title="Change today, percent" />
                        <Header id="change" label="Chg" sort={sort} onSort={onSort} title="Change today" />
                        <Header id="month" label="1M trend" align="left" sort={sort} onSort={onSort} title="Last month of daily closes" />
                        <Header id="volume" label="Volume" sort={sort} onSort={onSort} />
                        <Header id="marketCap" label="Mkt cap" sort={sort} onSort={onSort} title="Market capitalization" />
                        {crypto ? (
                            <Header id="rangePos" label="52W range" align="left" sort={sort} onSort={onSort} title="Position between the 52-week low and high" />
                        ) : (
                            <>
                                <Header id="peRatio" label="P/E" sort={sort} onSort={onSort} title="Trailing price / earnings" />
                                <Header id="eps" label="EPS" sort={sort} onSort={onSort} title="Trailing 12-month earnings per share" />
                            </>
                        )}
                        <Header id="rating" label="Rating" align="left" sort={sort} onSort={onSort} title="Rule-based technical rating" />
                        <th scope="col" className="scr-col-go"><span className="sr-only">Open</span></th>
                    </tr>
                </thead>
                <tbody>
                    {loading
                        ? Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} crypto={crypto} />)
                        : rows.map((row, i) => (
                            <tr
                                key={row.symbol}
                                className="is-clickable scr-row fade-up"
                                style={{ '--i': Math.min(i, MAX_STAGGER) }}
                                tabIndex={0}
                                data-testid="screener-row"
                                data-symbol={row.symbol}
                                onClick={() => onOpen(row.symbol)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        onOpen(row.symbol);
                                    }
                                }}
                            >
                                <td>
                                    <span className="scr-sym">
                                        <SymbolAvatar symbol={row.symbol} size={34} />
                                        <span className="scr-sym-text">
                                            <span className="mono scr-sym-ticker">{row.symbol}</span>
                                            <span className="truncate scr-sym-name">{row.name}</span>
                                        </span>
                                    </span>
                                </td>
                                <td className="num scr-strong">
                                    <FlashValue value={row.price}>{formatCurrency(row.price, row.currency)}</FlashValue>
                                </td>
                                <td className="num"><ChangePill value={row.changePercent} size="sm" /></td>
                                <td className={cx('num', row.change > 0 ? 'gain' : row.change < 0 ? 'loss' : 'muted')}>
                                    {signedCurrency(row.change, row.currency)}
                                </td>
                                <td><MonthTrend row={row} /></td>
                                <td className="num" title={row.avgVolume ? `3-month average ${formatCompact(row.avgVolume)}` : undefined}>
                                    {formatCompact(row.volume)}
                                </td>
                                <td className="num">{formatCurrency(row.marketCap, row.currency, { compact: true })}</td>
                                {crypto ? (
                                    <td><RangeMeter row={row} /></td>
                                ) : (
                                    <>
                                        <td className={cx('num', row.peRatio === null && 'muted')}>{formatNumber(row.peRatio, 2)}</td>
                                        <td className={cx('num', row.eps === null ? 'muted' : row.eps < 0 && 'loss')}>{formatNumber(row.eps, 2)}</td>
                                    </>
                                )}
                                <td><ScreenerRating row={row} size="sm" /></td>
                                <td className="scr-col-go" aria-hidden="true"><ChevronRight size={16} /></td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
    );
}

function SkeletonRow({ crypto }) {
    return (
        <tr className="scr-skel-row" aria-hidden="true">
            <td>
                <span className="scr-sym">
                    <Skeleton width={34} height={34} radius={10} />
                    <span className="scr-sym-text">
                        <Skeleton width={52} height={12} />
                        <Skeleton width={110} height={10} />
                    </span>
                </span>
            </td>
            <td className="num"><Skeleton width={64} height={12} style={{ marginLeft: 'auto' }} /></td>
            <td className="num"><Skeleton width={58} height={20} radius={999} style={{ marginLeft: 'auto' }} /></td>
            <td className="num"><Skeleton width={44} height={12} style={{ marginLeft: 'auto' }} /></td>
            <td><Skeleton width={120} height={24} radius={6} /></td>
            <td className="num"><Skeleton width={46} height={12} style={{ marginLeft: 'auto' }} /></td>
            <td className="num"><Skeleton width={54} height={12} style={{ marginLeft: 'auto' }} /></td>
            {crypto ? (
                <td><Skeleton width={96} height={10} radius={999} /></td>
            ) : (
                <>
                    <td className="num"><Skeleton width={36} height={12} style={{ marginLeft: 'auto' }} /></td>
                    <td className="num"><Skeleton width={36} height={12} style={{ marginLeft: 'auto' }} /></td>
                </>
            )}
            <td><Skeleton width={78} height={20} radius={999} /></td>
            <td className="scr-col-go" />
        </tr>
    );
}

/** Phone layout: one compact card per row. */
export function ScreenerList({ rows, onOpen, loading }) {
    if (loading) {
        return (
            <ul className="scr-list" data-testid="scr-table" aria-busy="true">
                {Array.from({ length: 8 }, (_, i) => (
                    <li key={i} className="scr-item scr-item--skeleton" aria-hidden="true">
                        <Skeleton width={36} height={36} radius={10} />
                        <span className="scr-item-main">
                            <Skeleton width={56} height={12} />
                            <Skeleton width={96} height={10} />
                        </span>
                        <span className="scr-item-side">
                            <Skeleton width={68} height={12} />
                            <Skeleton width={54} height={18} radius={999} />
                        </span>
                    </li>
                ))}
            </ul>
        );
    }
    return (
        <ul className="scr-list" data-testid="scr-table">
            {rows.map((row, i) => (
                <li key={row.symbol} className="fade-up" style={{ '--i': Math.min(i, MAX_STAGGER) }}>
                    <button
                        type="button"
                        className="scr-item"
                        data-testid="screener-row"
                        data-symbol={row.symbol}
                        onClick={() => onOpen(row.symbol)}
                        aria-label={`${row.symbol}, ${row.name}: ${formatCurrency(row.price, row.currency)}, ${formatPercent(row.changePercent)} today, rated ${row.technicalRating}. Open research report`}
                    >
                        <SymbolAvatar symbol={row.symbol} size={36} />
                        <span className="scr-item-main">
                            <span className="scr-item-top">
                                <span className="mono scr-sym-ticker">{row.symbol}</span>
                                <ScreenerRating row={row} size="sm" />
                            </span>
                            <span className="truncate scr-sym-name">{row.name}</span>
                        </span>
                        <span className="scr-item-spark" aria-hidden="true">
                            <Sparkline data={row.sparkline} width={56} height={26} />
                        </span>
                        <span className="scr-item-side">
                            <FlashValue value={row.price} className="num scr-strong">{formatCurrency(row.price, row.currency)}</FlashValue>
                            <ChangePill value={row.changePercent} size="sm" />
                        </span>
                    </button>
                </li>
            ))}
        </ul>
    );
}

export default ScreenerTable;
