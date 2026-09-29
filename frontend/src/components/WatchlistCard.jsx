import { useEffect, useRef, useState } from 'react';
import { Clock, FileText, MoveRight, RefreshCw, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import {
    Button,
    ChangePill,
    FlashValue,
    IconButton,
    RecommendationBadge,
    Skeleton,
    Sparkline,
    Spinner,
    SymbolAvatar,
    cx
} from './ui';
import { formatCurrency, formatDate, formatPercent, timeAgo, toDate, toNumber } from '../utils/format';

const SPARK_POINTS = 30;
const SPARK_HEIGHT = 56;

const TRENDS = {
    bullish: { label: 'Uptrend', icon: TrendingUp, tone: 'gain' },
    bearish: { label: 'Downtrend', icon: TrendingDown, tone: 'loss' },
    sideways: { label: 'Sideways', icon: MoveRight, tone: 'flat' }
};

/** Same zones as the risk gauge in the full report: 1-3 low, 4-6 moderate, 7-10 high. */
function riskTone(score) {
    if (score <= 3) return 'gain';
    if (score <= 6) return 'warn';
    return 'loss';
}

/** Width of an element in px (0 until measured); ResizeObserver reports the first size itself. */
function useWidth(ref) {
    const [width, setWidth] = useState(0);
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(([entry]) => {
            setWidth(Math.floor(entry.contentRect.width));
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref]);
    return width;
}

/** timeAgo that treats timestamps newer than the last clock tick as "just now". */
function ago(dateLike, now) {
    const d = toDate(dateLike);
    if (d && now && d > now) return 'just now';
    return timeAgo(d, now);
}

function signedCurrency(value, currency) {
    const n = toNumber(value);
    if (n === null) return null;
    return `${n > 0 ? '+' : ''}${formatCurrency(n, currency)}`;
}

/** Ten-segment risk meter (1-10). */
function RiskMeter({ score, level }) {
    const n = toNumber(score);
    if (n === null) return null;
    const value = Math.min(10, Math.max(1, Math.round(n)));
    const tone = riskTone(value);
    const text = String(level || '').replace(/\s*risk$/i, '') || null;
    return (
        <div
            className={cx('wl-risk', `wl-risk--${tone}`)}
            role="meter"
            aria-label="Risk score"
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={value}
            aria-valuetext={`${value} of 10${level ? `, ${level}` : ''}`}
        >
            <span className="wl-risk-label">Risk</span>
            <span className="wl-risk-bars" aria-hidden="true">
                {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} className={cx('wl-risk-bar', i < value && 'is-on')} style={{ '--b': i }} />
                ))}
            </span>
            <span className="wl-risk-value num">
                {value}
                <span className="wl-risk-max">/10</span>
            </span>
            {text && <span className="wl-risk-level">{text}</span>}
        </div>
    );
}

/**
 * One watchlist item. The whole card opens the report (mouse); keyboard users
 * use the "View report" button. Refresh/remove are separate buttons.
 */
export function WatchlistCard({
    item,
    index = 0,
    now,
    refreshing = false,
    removing = false,
    leaving = false,
    highlighted = false,
    onView,
    onRefresh,
    onRemove
}) {
    const cardRef = useRef(null);
    const chartRef = useRef(null);
    const chartWidth = useWidth(chartRef);

    useEffect(() => {
        if (highlighted) cardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [highlighted]);

    const symbol = item.symbol;
    const analysis = item.lastAnalysis || null;
    const status = analysis?.currentMarketStatus || {};
    const currency = analysis?.currency || 'USD';
    const name = analysis?.companyOverview?.name;
    const price = toNumber(status.currentPrice);
    const changePct = toNumber(status.changePercentRaw) ?? toNumber(status.changePercent);
    const change = signedCurrency(status.change, currency);
    const decision = analysis?.recommendation?.decision;
    const risk = analysis?.riskScore;
    const trend = TRENDS[status.trend] || null;
    const TrendIcon = trend?.icon;
    const updatedAt = analysis?.timestamp || status.lastUpdated || item.updatedAt;

    const history = Array.isArray(analysis?.priceHistory) ? analysis.priceHistory : [];
    const sparkRows = history.slice(-SPARK_POINTS).filter((p) => toNumber(p?.close) !== null);
    const spark = sparkRows.map((p) => toNumber(p.close));
    const hasSpark = spark.length >= 2;
    const sparkChange = hasSpark && spark[0] ? ((spark[spark.length - 1] - spark[0]) / spark[0]) * 100 : null;
    const sparkTone = sparkChange === null || Number(sparkChange.toFixed(2)) === 0 ? 'flat' : sparkChange > 0 ? 'gain' : 'loss';

    const busy = refreshing || removing;

    const openFromBody = (event) => {
        if (!analysis || leaving) return;
        if (event.target.closest('button, a, input, select, textarea')) return;
        if (window.getSelection?.()?.toString()) return; // let people select text
        onView?.(item);
    };

    return (
        <article
            ref={cardRef}
            className={cx(
                'wl-card',
                'hover-lift',
                'fade-up',
                analysis && 'is-clickable',
                busy && 'is-busy',
                removing && 'is-removing',
                leaving && 'is-leaving',
                highlighted && 'is-highlighted'
            )}
            style={{ '--i': index }}
            data-testid="watchlist-card"
            data-symbol={symbol}
            aria-busy={busy || undefined}
            aria-label={`${symbol}${name ? `, ${name}` : ''}`}
            onClick={openFromBody}
        >
            <header className="wl-card-head">
                <SymbolAvatar symbol={symbol} size={40} />
                <div className="wl-card-id">
                    <h3 className="wl-card-symbol mono">{symbol}</h3>
                    <p className="wl-card-name truncate" title={name || undefined}>{name || 'No analysis yet'}</p>
                </div>
                {decision && <RecommendationBadge decision={decision} className="wl-card-rec" />}
            </header>

            {analysis ? (
                <>
                    <div className="wl-card-quote">
                        <FlashValue value={price} className="wl-card-price num">
                            {formatCurrency(price, currency)}
                        </FlashValue>
                        <div className="wl-card-change">
                            {changePct !== null && <ChangePill value={changePct} size="sm" />}
                            {change && <span className="wl-card-abs num">{change}</span>}
                            <span className="wl-card-today">today</span>
                        </div>
                    </div>

                    {hasSpark && (
                        <div className="wl-card-chart-head">
                            <span>Since {formatDate(sparkRows[0].date, 'short')}</span>
                            {sparkChange !== null && (
                                <span className={cx('wl-card-chart-change', 'num', `is-${sparkTone}`)}>
                                    {formatPercent(sparkChange)}
                                </span>
                            )}
                        </div>
                    )}
                    <div ref={chartRef} className={cx('wl-card-chart', !hasSpark && 'is-empty')}>
                        {hasSpark ? (
                            chartWidth > 0 && (
                                <Sparkline
                                    key={updatedAt}
                                    data={spark}
                                    width={chartWidth}
                                    height={SPARK_HEIGHT}
                                    strokeWidth={2}
                                    ariaLabel={`${symbol} closing prices over the last ${spark.length} sessions`}
                                />
                            )
                        ) : (
                            <span className="wl-card-chart-note">Refresh to load the price chart</span>
                        )}
                    </div>

                    <div className="wl-card-meta">
                        {risk ? <RiskMeter score={risk.score} level={risk.level} /> : <span />}
                        {trend && (
                            <span className={cx('wl-card-trend', `wl-card-trend--${trend.tone}`)}>
                                <TrendIcon size={14} aria-hidden="true" />
                                {trend.label}
                            </span>
                        )}
                    </div>
                </>
            ) : (
                <div className="wl-card-missing">
                    <p>
                        There is no saved analysis for <span className="mono">{symbol}</span> yet. Run one to see its
                        price, trend and signal.
                    </p>
                    <Button
                        size="sm"
                        variant="primary"
                        icon={RefreshCw}
                        loading={refreshing}
                        onClick={() => onRefresh?.(item)}
                        data-testid="wl-refresh"
                    >
                        Analyze now
                    </Button>
                </div>
            )}

            <footer className="wl-card-foot">
                <span className="wl-card-updated" key={updatedAt}>
                    {refreshing ? (
                        <>
                            <Spinner size={12} />
                            Refreshing…
                        </>
                    ) : (
                        <>
                            <Clock size={12} aria-hidden="true" />
                            {analysis ? `Updated ${ago(updatedAt, now)}` : `Added ${ago(item.addedAt, now)}`}
                        </>
                    )}
                </span>
                <div className="wl-card-actions">
                    {analysis && (
                        <>
                            <Button
                                size="sm"
                                variant="secondary"
                                icon={FileText}
                                onClick={() => onView?.(item)}
                                disabled={leaving}
                                data-testid="wl-view"
                            >
                                View report
                            </Button>
                            <IconButton
                                size="sm"
                                icon={RefreshCw}
                                label={refreshing ? `Refreshing ${symbol}` : `Refresh ${symbol}`}
                                className={cx('wl-icon-btn', refreshing && 'is-spinning')}
                                onClick={() => onRefresh?.(item)}
                                disabled={busy || leaving}
                                aria-busy={refreshing || undefined}
                                data-testid="wl-refresh"
                            />
                        </>
                    )}
                    <IconButton
                        size="sm"
                        icon={Trash2}
                        label={`Remove ${symbol} from watchlist`}
                        className="wl-icon-btn wl-icon-btn--danger"
                        onClick={() => onRemove?.(item)}
                        disabled={busy || leaving}
                        data-testid="wl-remove"
                    />
                </div>
            </footer>
        </article>
    );
}

/** Placeholder shaped like a card. */
export function WatchlistCardSkeleton({ index = 0 }) {
    return (
        <div className="wl-card wl-card--skeleton fade-up" style={{ '--i': index }} aria-hidden="true">
            <div className="wl-card-head">
                <Skeleton width={40} height={40} radius={12} />
                <div className="wl-card-id wl-skel-stack">
                    <Skeleton width={68} height={15} />
                    <Skeleton width="72%" height={11} />
                </div>
                <Skeleton width={56} height={24} radius={999} />
            </div>
            <div className="wl-card-quote">
                <Skeleton width={132} height={28} />
                <Skeleton width={120} height={20} radius={999} />
            </div>
            <Skeleton height={SPARK_HEIGHT} radius={10} />
            <div className="wl-card-meta">
                <Skeleton width={150} height={12} />
                <Skeleton width={72} height={12} />
            </div>
            <div className="wl-card-foot">
                <Skeleton width={96} height={12} />
                <Skeleton width={176} height={32} radius={8} />
            </div>
        </div>
    );
}

/** Shown at the top of the grid while a new symbol is being analysed and saved. */
export function WatchlistPendingCard({ symbol }) {
    return (
        <div className="wl-card wl-card--pending fade-up" role="status" aria-live="polite">
            <div className="wl-card-head">
                <SymbolAvatar symbol={symbol} size={40} />
                <div className="wl-card-id">
                    <p className="wl-card-symbol mono">{symbol}</p>
                    <p className="wl-card-name">Adding to your watchlist…</p>
                </div>
                <Spinner size={18} className="wl-pending-spinner" />
            </div>
            <div className="wl-card-quote">
                <Skeleton width={132} height={28} />
                <Skeleton width={120} height={20} radius={999} />
            </div>
            <Skeleton height={SPARK_HEIGHT} radius={10} />
            <p className="wl-pending-note">Fetching a year of prices and computing signals</p>
        </div>
    );
}

export default WatchlistCard;
