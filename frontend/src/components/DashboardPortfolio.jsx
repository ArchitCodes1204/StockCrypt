import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart } from 'recharts';
import { ArrowRight, Briefcase, ChevronDown, ChevronUp, LineChart, PieChart as PieIcon, Plus, Search } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { formatCurrency, formatDate, formatNumber, formatPercent, toDate, toNumber } from '../utils/format';
import {
    AnimatedNumber,
    Button,
    Card,
    CardHeader,
    ChangePill,
    EmptyState,
    ErrorState,
    PriceChart,
    SegmentedControl,
    Skeleton,
    SortHeader,
    Spinner,
    SymbolAvatar
} from './ui';

const RANGES = [
    { label: '1M', value: '1m', days: 31, text: 'Past month' },
    { label: '3M', value: '3m', days: 92, text: 'Past 3 months' },
    { label: '6M', value: '6m', days: 183, text: 'Past 6 months' },
    { label: '1Y', value: '1y', days: 366, text: 'Past year' }
];
const RANGE_OPTIONS = RANGES.map(({ label, value }) => ({ label, value }));
const TOP_ROWS = 5;
const DONUT = 208;

const signedCurrency = (v, currency) => `${v > 0 ? '+' : ''}${formatCurrency(v, currency)}`;

/* Portfolio value chart ---------------------------------------------------- */

function periodLabel(range, firstDate) {
    const meta = RANGES.find((r) => r.value === range) || RANGES[RANGES.length - 1];
    const first = toDate(firstDate);
    if (!first) return meta.text;
    const expectedStart = new Date();
    expectedStart.setDate(expectedStart.getDate() - meta.days);
    // History starts at the first trade when that is later than the range start.
    return first - expectedStart > 7 * 86400000 ? `Since ${formatDate(first, 'medium')}` : meta.text;
}

function ChartSkeleton({ height }) {
    return (
        <div className="dash-chart-skeleton" aria-hidden="true">
            <div className="dash-chart-figure">
                <Skeleton width={90} height={12} />
                <Skeleton width={220} height={34} radius={10} />
                <Skeleton width={180} height={12} />
            </div>
            <Skeleton height={height} radius={12} />
        </div>
    );
}

export function DashboardValueChart({ resource, range, onRangeChange, onAdd, style }) {
    const isPhone = useMediaQuery('(max-width: 559px)');
    const height = isPhone ? 220 : 300;
    const data = resource.data;
    const points = useMemo(
        () => (Array.isArray(data?.points) ? data.points : []).map((p) => ({ date: p.date, value: p.value, invested: p.invested })),
        [data]
    );

    let body;
    if (!data && resource.error) {
        body = <ErrorState compact title="Couldn't load portfolio history" message={resource.error.message} onRetry={resource.reload} />;
    } else if (!data) {
        body = <ChartSkeleton height={height} />;
    } else if (points.length < 2) {
        body = (
            <EmptyState
                icon={LineChart}
                title="Your value chart starts with your first trade"
                description="Add a buy transaction and StockCrypt will track what your holdings are worth every day."
                action={<Button size="sm" variant="secondary" icon={Plus} onClick={onAdd}>Add transaction</Button>}
                className="dash-chart-empty"
            />
        );
    } else {
        const currency = data.currency || 'USD';
        const first = points[0];
        const last = points[points.length - 1];
        const change = toNumber(data.change) ?? (toNumber(last.value) ?? 0) - (toNumber(first.value) ?? 0);
        const changePercent = toNumber(data.changePercent);
        const investedStart = toNumber(first.invested);
        const investedEnd = toNumber(last.invested);
        const flow = investedStart !== null && investedEnd !== null ? investedEnd - investedStart : 0;
        const flatInvested = investedEnd !== null && points.every((p) => Math.abs((toNumber(p.invested) ?? investedEnd) - investedEnd) < 0.01);
        const unpriced = Array.isArray(data.unpricedSymbols) ? data.unpricedSymbols.filter(Boolean) : [];
        const stale = resource.loading && data.range !== range;

        // Money added or taken out during the period moves the value too; say so,
        // and drop the % (it would read as performance) when that is material.
        const startValue = Math.abs(toNumber(first.value) ?? 0);
        const hasFlows = Math.abs(flow) > Math.max(1, startValue * 0.01);
        let note = null;
        if (flow > 0.5) note = `Includes ${formatCurrency(flow, currency)} of new purchases`;
        else if (flow < -0.5) note = `After selling holdings that cost ${formatCurrency(-flow, currency)}`;
        else if (flatInvested && investedEnd) note = `No trades in this period, ${formatCurrency(investedEnd, currency)} invested`;

        body = (
            <div className={stale ? 'dash-chart-body is-stale' : 'dash-chart-body'} aria-busy={stale || undefined}>
                <div className="dash-chart-figure">
                    <span className="dash-chart-period">{periodLabel(data.range || range, first.date)}</span>
                    <div className="dash-chart-value-row">
                        <AnimatedNumber value={change} format={(v) => signedCurrency(v, currency)} className="dash-chart-value num" />
                        {changePercent !== null && !hasFlows && <ChangePill value={changePercent} />}
                    </div>
                    {note && <p className="dash-chart-note">{note}</p>}
                </div>
                <PriceChart
                    key={data.range || range}
                    data={points}
                    color="accent"
                    currency={currency}
                    height={height}
                    referenceValue={flatInvested ? investedEnd : undefined}
                    referenceLabel={flatInvested ? 'Invested' : undefined}
                    ariaLabel={`Portfolio value, ${periodLabel(data.range || range, first.date).toLowerCase()}: `
                        + `${formatCurrency(first.value, currency)} to ${formatCurrency(last.value, currency)}`}
                />
                {unpriced.length > 0 && (
                    <p className="dash-chart-note dash-chart-warn">
                        No price history for {unpriced.join(', ')}; {unpriced.length === 1 ? 'it is' : 'they are'} left out of this chart.
                    </p>
                )}
            </div>
        );
    }

    const hasChart = points.length >= 2;
    let subtitle = 'Based on your transactions, valued at each day\'s close';
    if (data && !hasChart) subtitle = 'What your holdings are worth, day by day';
    else if (data?.basis === 'current-holdings') subtitle = 'Your current holdings valued over time';

    return (
        <Card className="dash-card dash-chart fade-up" style={style} data-testid="dash-chart" aria-busy={resource.loading || undefined}>
            <CardHeader
                title="Portfolio value"
                subtitle={subtitle}
                icon={LineChart}
                action={data && !hasChart ? null : (
                    <>
                        {resource.loading && data && <Spinner size={14} />}
                        <SegmentedControl
                            size="sm"
                            options={RANGE_OPTIONS}
                            value={range}
                            onChange={onRangeChange}
                            aria-label="Chart range"
                            testId="dash-range"
                        />
                    </>
                )}
            />
            {body}
        </Card>
    );
}

/* Allocation donut --------------------------------------------------------- */

function AllocationSkeleton() {
    return (
        <div className="dash-alloc-body" aria-hidden="true">
            <div className="dash-donut">
                <Skeleton width={DONUT} height={DONUT} radius={999} />
            </div>
            <ul className="dash-legend">
                {Array.from({ length: 4 }, (_, i) => (
                    <li key={i} className="dash-legend-row">
                        <Skeleton width={10} height={10} radius={3} />
                        <Skeleton width={64} height={12} />
                        <Skeleton width={44} height={12} />
                        <Skeleton width={70} height={12} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function DashboardAllocation({ resource, allocation, onOpen, style }) {
    const reduced = usePrefersReducedMotion();
    const [active, setActive] = useState(null);
    const { slices, total } = allocation;
    const current = active !== null ? slices[active] : null;

    let body;
    if (!resource.data && resource.error) {
        body = <ErrorState compact title="Couldn't load allocation" message={resource.error.message} onRetry={resource.reload} />;
    } else if (!resource.data) {
        body = <AllocationSkeleton />;
    } else if (!slices.length) {
        body = (
            <EmptyState
                compact
                icon={PieIcon}
                title="Nothing to allocate yet"
                description="Once you own something, this shows how your money is split across holdings."
                className="dash-alloc-empty"
            />
        );
    } else {
        const summary = slices.map((s) => `${s.symbol} ${formatPercent(s.percent, { sign: false, digits: 1 })}`).join(', ');
        body = (
            <div className="dash-alloc-body dash-reveal">
                <div className="dash-donut" role="img" aria-label={`Allocation by value: ${summary}`}>
                    <PieChart width={DONUT} height={DONUT} accessibilityLayer={false} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie
                            data={slices}
                            dataKey="value"
                            nameKey="symbol"
                            cx="50%"
                            cy="50%"
                            innerRadius={DONUT / 2 - 30}
                            outerRadius={DONUT / 2 - 4}
                            startAngle={90}
                            endAngle={-270}
                            cornerRadius={4}
                            stroke="var(--sc-surface-2)"
                            strokeWidth={2}
                            rootTabIndex={-1}
                            isAnimationActive={!reduced}
                            animationBegin={200}
                            animationDuration={900}
                            animationEasing="ease-out"
                            onMouseEnter={(_, index) => setActive(index)}
                            onMouseLeave={() => setActive(null)}
                        >
                            {slices.map((s, i) => (
                                <Cell
                                    key={s.symbol}
                                    fill={s.color}
                                    className="dash-donut-slice"
                                    style={{ opacity: active === null || active === i ? 1 : 0.28 }}
                                />
                            ))}
                        </Pie>
                    </PieChart>
                    <div className="dash-donut-center" aria-hidden="true">
                        <span className="dash-donut-label">{current ? current.symbol : 'Total value'}</span>
                        <span className="dash-donut-value num">
                            {current ? formatPercent(current.percent, { sign: false, digits: 1 }) : <AnimatedNumber value={total} format={(v) => formatCurrency(v)} />}
                        </span>
                        <span className="dash-donut-sub num">
                            {current ? formatCurrency(current.value) : `${slices.length === 1 ? '1 holding' : `${slices.reduce((n, s) => n + (s.isOther ? s.members.length : 1), 0)} holdings`}`}
                        </span>
                    </div>
                </div>
                <ul className="dash-legend" onMouseLeave={() => setActive(null)}>
                    {slices.map((s, i) => {
                        const content = (
                            <>
                                <span className="dash-legend-swatch" style={{ background: s.color }} aria-hidden="true" />
                                <span className={s.isOther ? 'dash-legend-symbol' : 'dash-legend-symbol mono'}>
                                    {s.isOther ? `Other (${s.members.length})` : s.symbol}
                                </span>
                                <span className="dash-legend-pct num">{formatPercent(s.percent, { sign: false, digits: 1 })}</span>
                                <span className="dash-legend-value num">{formatCurrency(s.value)}</span>
                            </>
                        );
                        return (
                            <li
                                key={s.symbol}
                                className={active !== null && active !== i ? 'dash-legend-item is-dimmed' : 'dash-legend-item'}
                                onMouseEnter={() => setActive(i)}
                            >
                                {s.isOther ? (
                                    <div className="dash-legend-row" title={s.members.join(', ')}>{content}</div>
                                ) : (
                                    <button
                                        type="button"
                                        className="dash-legend-row dash-legend-btn"
                                        onClick={() => onOpen(s.symbol)}
                                        onFocus={() => setActive(i)}
                                        onBlur={() => setActive(null)}
                                        aria-label={`${s.symbol}: ${formatPercent(s.percent, { sign: false, digits: 1 })} of your portfolio, ${formatCurrency(s.value)}. Open research`}
                                    >
                                        {content}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    }

    return (
        <Card className="dash-card dash-alloc fade-up" style={style} data-testid="dash-allocation">
            <CardHeader title="Allocation" subtitle="Holdings by current value" icon={PieIcon} />
            {body}
        </Card>
    );
}

/* Holdings table ----------------------------------------------------------- */

const COLUMNS = [
    { key: 'symbol', label: 'Asset', align: 'left' },
    { key: 'totalShares', label: 'Shares', align: 'right' },
    { key: 'averageBuyPrice', label: 'Avg cost', align: 'right' },
    { key: 'currentPrice', label: 'Price', align: 'right' },
    { key: 'currentValue', label: 'Value', align: 'right' },
    { key: 'profitLoss', label: 'P/L', align: 'right' },
    { key: 'weight', label: 'Weight', align: 'left' }
];

const SHARES_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
const SMALL_SHARES_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 });

// Fractional crypto positions (0.0012 BTC) must not round to 0.
function formatShares(value) {
    const n = toNumber(value);
    if (n === null) return formatNumber(null);
    return (Math.abs(n) < 1 ? SMALL_SHARES_FORMAT : SHARES_FORMAT).format(n);
}

const isCrypto = (symbol) => /-USD$/i.test(String(symbol || ''));

function sortValue(h, key) {
    if (key === 'symbol') return String(h.symbol || '');
    if (key === 'weight') return toNumber(h.currentValue) ?? -Infinity;
    return toNumber(h[key]) ?? -Infinity;
}

function HoldingsSkeleton() {
    return (
        <ul className="dash-holdings-skeleton" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="dash-holdings-skeleton-row">
                    <Skeleton width={34} height={34} radius={10} />
                    <span className="dash-holdings-skeleton-name">
                        <Skeleton width={56} height={12} />
                        <Skeleton width={110} height={10} />
                    </span>
                    <Skeleton width="12%" height={12} />
                    <Skeleton width="12%" height={12} />
                    <Skeleton width="14%" height={12} />
                    <Skeleton width={120} height={8} radius={999} />
                </li>
            ))}
        </ul>
    );
}

export function DashboardHoldings({ resource, colors, total, names, onOpen, hasHoldings, style }) {
    const navigate = useNavigate();
    const [sort, setSort] = useState({ key: 'currentValue', dir: 'desc' });
    const [showAll, setShowAll] = useState(false);
    const list = useMemo(() => (Array.isArray(resource.data) ? resource.data : []), [resource.data]);

    const sorted = useMemo(() => {
        const dir = sort.dir === 'asc' ? 1 : -1;
        return [...list].sort((a, b) => {
            const av = sortValue(a, sort.key);
            const bv = sortValue(b, sort.key);
            if (typeof av === 'string') return av.localeCompare(bv) * dir;
            return (av - bv) * dir;
        });
    }, [list, sort]);

    const rows = showAll ? sorted : sorted.slice(0, TOP_ROWS);
    const hidden = sorted.length - TOP_ROWS;

    const toggleSort = (key) => {
        setSort((s) => (s.key === key
            ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
            : { key, dir: key === 'symbol' ? 'asc' : 'desc' }));
    };

    let body;
    if (!resource.data && resource.error) {
        body = <ErrorState compact title="Couldn't load holdings" message={resource.error.message} onRetry={resource.reload} />;
    } else if (!resource.data) {
        body = <HoldingsSkeleton />;
    } else if (!list.length) {
        body = (
            <EmptyState
                icon={Briefcase}
                title="No holdings yet"
                description="Record your first buy with Add transaction and each position shows up here with its cost, value and profit or loss."
                action={<Button size="sm" variant="secondary" icon={Search} onClick={() => navigate('/research')}>Research a symbol</Button>}
            />
        );
    } else {
        const sortLabel = COLUMNS.find((c) => c.key === sort.key)?.label || 'Value';
        body = (
            <>
                <div className="ui-table-wrap ui-table-wrap--flush dash-table-wrap dash-reveal">
                    <table className="ui-table dash-table">
                        <caption className="sr-only">
                            Your holdings, sorted by {sortLabel.toLowerCase()} {sort.dir === 'asc' ? 'ascending' : 'descending'}. Select a row to open its research report.
                        </caption>
                        <thead>
                            <tr>
                                {COLUMNS.map((c) => (
                                    <SortHeader
                                        key={c.key}
                                        label={c.label}
                                        align={c.align}
                                        active={sort.key === c.key}
                                        direction={sort.dir}
                                        onClick={() => toggleSort(c.key)}
                                        testId={`holdings-sort-${c.key}`}
                                        className={c.key === 'symbol' ? 'dash-col-asset' : c.key === 'weight' ? 'dash-col-weight' : undefined}
                                    />
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((h) => {
                                const value = toNumber(h.currentValue);
                                const pl = toNumber(h.profitLoss);
                                const weight = total && value !== null ? (value / total) * 100 : 0;
                                const name = names[h.symbol] || (isCrypto(h.symbol) ? 'Crypto' : '');
                                return (
                                    <tr
                                        key={h.symbol}
                                        className="is-clickable"
                                        tabIndex={0}
                                        data-testid="holding-row"
                                        aria-label={`${h.symbol}, value ${formatCurrency(value)}. Open research`}
                                        onClick={() => onOpen(h.symbol)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                onOpen(h.symbol);
                                            }
                                        }}
                                    >
                                        <td className="dash-col-asset">
                                            <span className="dash-asset">
                                                <SymbolAvatar symbol={h.symbol} size={34} />
                                                <span className="dash-asset-text">
                                                    <span className="mono dash-asset-symbol">{h.symbol}</span>
                                                    {name && <span className="dash-asset-name truncate">{name}</span>}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="num">{formatShares(h.totalShares)}</td>
                                        <td className="num muted">{formatCurrency(h.averageBuyPrice)}</td>
                                        <td className="num">{formatCurrency(h.currentPrice)}</td>
                                        <td className="num dash-strong">{formatCurrency(value)}</td>
                                        <td className="num">
                                            <span className="dash-pl">
                                                <span className={pl === null ? 'muted' : pl >= 0 ? 'gain' : 'loss'}>{pl === null ? formatCurrency(null) : signedCurrency(pl)}</span>
                                                <ChangePill value={h.profitLossPercent} size="sm" showArrow={false} />
                                            </span>
                                        </td>
                                        <td className="dash-col-weight">
                                            <span className="dash-weight">
                                                <span className="dash-weight-track" aria-hidden="true">
                                                    <span
                                                        className="dash-weight-fill"
                                                        style={{ width: `${Math.min(100, Math.max(0, weight))}%`, background: colors[h.symbol] || 'var(--sc-chart-8)' }}
                                                    />
                                                </span>
                                                <span className="num dash-weight-pct">{formatPercent(weight, { sign: false, digits: 1 })}</span>
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {hidden > 0 && (
                    <div className="dash-table-foot">
                        <span className="muted num">
                            {showAll ? `Showing all ${sorted.length}` : `Showing top ${TOP_ROWS} of ${sorted.length}`}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            iconRight={showAll ? ChevronUp : ChevronDown}
                            onClick={() => setShowAll((v) => !v)}
                            aria-expanded={showAll}
                            data-testid="holdings-toggle"
                        >
                            {showAll ? 'Show top 5' : `View all ${sorted.length}`}
                        </Button>
                    </div>
                )}
            </>
        );
    }

    const count = list.length;
    return (
        <Card padded={false} className="dash-card dash-holdings fade-up" style={style} data-testid="holdings-table">
            <div className="dash-card-head">
                <CardHeader
                    title="Holdings"
                    subtitle={count ? `${count} ${count === 1 ? 'position' : 'positions'} · select a row to research it` : 'Your positions at current prices'}
                    icon={Briefcase}
                    action={hasHoldings ? (
                        <Link to="/portfolio" className="ui-btn ui-btn--ghost ui-btn--sm">
                            <span className="ui-btn-label">Manage</span>
                            <ArrowRight size={14} aria-hidden="true" className="ui-btn-icon-right" />
                        </Link>
                    ) : null}
                />
            </div>
            {body}
        </Card>
    );
}
