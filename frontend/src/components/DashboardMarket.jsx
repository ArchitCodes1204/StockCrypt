import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Flame, RefreshCw, Search, Star } from 'lucide-react';
import { formatCurrency, formatPercent, timeAgo, toDate, toNumber } from '../utils/format';
import {
    Badge,
    Button,
    Card,
    CardHeader,
    ChangePill,
    EmptyState,
    ErrorState,
    FlashValue,
    Marquee,
    RecommendationBadge,
    Skeleton,
    Sparkline,
    SymbolAvatar
} from './ui';

/* Ticker tape -------------------------------------------------------------- */

export function DashboardTickerTape({ resource, onOpen, style }) {
    const rows = useMemo(
        () => (Array.isArray(resource.data) ? resource.data : []).filter((r) => r?.symbol && toNumber(r.price) !== null),
        [resource.data]
    );
    const sample = rows.some((r) => r.isSample);

    let body;
    if (!resource.data && resource.error) {
        body = (
            <div className="dash-tape-msg" role="alert">
                <span className="muted">Live prices are unavailable right now.</span>
                <Button variant="ghost" size="sm" icon={RefreshCw} onClick={resource.reload}>Retry</Button>
            </div>
        );
    } else if (!resource.data) {
        body = (
            <div className="dash-tape-skeleton" aria-hidden="true">
                {Array.from({ length: 9 }, (_, i) => (
                    <span key={i} className="dash-tape-skeleton-item">
                        <Skeleton width={44} height={12} />
                        <Skeleton width={58} height={12} />
                        <Skeleton width={54} height={18} radius={999} />
                    </span>
                ))}
            </div>
        );
    } else if (!rows.length) {
        body = <div className="dash-tape-msg muted">No market prices to show right now.</div>;
    } else {
        body = (
            <Marquee duration={Math.max(45, rows.length * 3.2)} gap={4} aria-label="Stock prices, pauses on hover">
                {rows.map((r) => {
                    const price = formatCurrency(r.price, r.currency);
                    return (
                        <button
                            key={r.symbol}
                            type="button"
                            className="dash-tape-item"
                            onClick={() => onOpen(r.symbol)}
                            aria-label={`${r.symbol} ${price}, ${formatPercent(r.changePercent)} today. Open research`}
                        >
                            <span className="mono dash-tape-symbol">{r.symbol}</span>
                            <FlashValue value={r.price} className="num dash-tape-price">{price}</FlashValue>
                            <ChangePill value={r.changePercent} size="sm" />
                        </button>
                    );
                })}
            </Marquee>
        );
    }

    return (
        <Card padded={false} className="dash-tape fade-up" style={style} data-testid="ticker-tape">
            {sample && <Badge tone="warn" size="sm" className="dash-tape-badge">Sample data</Badge>}
            <div className="dash-tape-body">{body}</div>
        </Card>
    );
}

/* Market movers ------------------------------------------------------------ */

function ListSkeleton({ rows, withSpark = false, withBadge = false }) {
    return (
        <ul className="dash-list" aria-hidden="true">
            {Array.from({ length: rows }, (_, i) => (
                <li key={i} className="dash-skeleton-row">
                    <Skeleton width={36} height={36} radius={11} />
                    <span className="dash-skeleton-lines">
                        <Skeleton width={52} height={12} />
                        <Skeleton width="70%" height={10} />
                    </span>
                    {withSpark && <Skeleton width={120} height={30} radius={8} className="dash-hide-sm" />}
                    <span className="dash-skeleton-lines dash-skeleton-end">
                        <Skeleton width={72} height={12} />
                        <Skeleton width={56} height={16} radius={999} />
                    </span>
                    {withBadge && <Skeleton width={52} height={22} radius={999} className="dash-hide-sm" />}
                </li>
            ))}
        </ul>
    );
}

export function DashboardMovers({ resource, onOpen, style }) {
    const rows = useMemo(() => {
        const list = (Array.isArray(resource.data) ? resource.data : []).filter((r) => r?.symbol);
        const move = (r) => Math.abs(toNumber(r.changePercentRaw) ?? toNumber(r.change) ?? 0);
        return [...list].sort((a, b) => move(b) - move(a));
    }, [resource.data]);

    let body;
    if (!resource.data && resource.error) {
        body = <ErrorState compact title="Couldn't load market movers" message={resource.error.message} onRetry={resource.reload} />;
    } else if (!resource.data) {
        body = <ListSkeleton rows={5} withSpark withBadge />;
    } else if (!rows.length) {
        body = <EmptyState compact icon={Flame} title="No market data right now" description="Try again in a minute." />;
    } else {
        body = (
            <ul className="dash-list dash-reveal">
                {rows.map((r) => {
                    const pct = toNumber(r.changePercentRaw) ?? toNumber(r.change);
                    const price = formatCurrency(r.price, r.currency);
                    return (
                        <li key={r.symbol}>
                            <button
                                type="button"
                                className="dash-row dash-mover"
                                onClick={() => onOpen(r.symbol)}
                                aria-label={`${r.symbol} ${price}, ${formatPercent(pct)} today, signal ${r.recommendation || 'none'}. Open research`}
                            >
                                <SymbolAvatar symbol={r.symbol} size={36} />
                                <span className="dash-row-name">
                                    <span className="mono dash-row-symbol">{r.symbol}</span>
                                    <span className="dash-row-sub truncate">{r.name || r.symbol}</span>
                                </span>
                                <Sparkline data={r.sparkline} width={120} height={32} className="dash-mover-spark" />
                                <span className="dash-row-end">
                                    <FlashValue value={r.price} className="num dash-row-price">{price}</FlashValue>
                                    <ChangePill value={pct} size="sm" />
                                </span>
                                <RecommendationBadge decision={r.recommendation} size="sm" className="dash-mover-rec" />
                            </button>
                        </li>
                    );
                })}
            </ul>
        );
    }

    return (
        <Card className="dash-card dash-movers fade-up" style={style} data-testid="dash-movers">
            <CardHeader title="Market movers" subtitle="Popular US large caps, biggest moves today first" icon={Flame} />
            {body}
            <p className="dash-fineprint">Signals are rule-based technical analysis. Not financial advice.</p>
        </Card>
    );
}

/* Watchlist preview -------------------------------------------------------- */

export function DashboardWatchlist({ resource, onOpen, style }) {
    const navigate = useNavigate();
    const items = useMemo(() => (Array.isArray(resource.data?.items) ? resource.data.items : []), [resource.data]);
    const total = toNumber(resource.data?.total) ?? items.length;
    const updated = useMemo(() => {
        const times = items
            .map((w) => toDate(w?.lastAnalysis?.currentMarketStatus?.lastUpdated || w?.lastAnalysis?.timestamp || w?.updatedAt))
            .filter(Boolean)
            .map((d) => d.getTime());
        return times.length ? new Date(Math.min(...times)) : null;
    }, [items]);

    let body;
    if (!resource.data && resource.error) {
        body = <ErrorState compact title="Couldn't load your watchlist" message={resource.error.message} onRetry={resource.reload} />;
    } else if (!resource.data) {
        body = <ListSkeleton rows={4} />;
    } else if (!items.length) {
        body = (
            <EmptyState
                compact
                icon={Star}
                title="Your watchlist is empty"
                description="Research a symbol and add it to follow its price, trend and signals."
                action={<Button size="sm" variant="secondary" icon={Search} onClick={() => navigate('/research')}>Find a symbol</Button>}
                className="dash-watch-empty"
            />
        );
    } else {
        body = (
            <ul className="dash-list dash-reveal">
                {items.map((w) => {
                    const analysis = w.lastAnalysis || {};
                    const market = analysis.currentMarketStatus || {};
                    const currency = analysis.currency || 'USD';
                    const pct = toNumber(market.changePercentRaw) ?? toNumber(market.changePercent);
                    const priceValue = toNumber(market.currentPrice);
                    const price = formatCurrency(priceValue, currency);
                    const name = analysis.companyOverview?.name;
                    return (
                        <li key={w._id || w.symbol}>
                            <button
                                type="button"
                                className="dash-row dash-watch-row"
                                onClick={() => onOpen(w.symbol)}
                                aria-label={`${w.symbol}${priceValue !== null ? ` ${price}` : ''}${pct !== null ? `, ${formatPercent(pct)}` : ''}. Open research`}
                            >
                                <SymbolAvatar symbol={w.symbol} size={36} />
                                <span className="dash-row-name">
                                    <span className="mono dash-row-symbol">{w.symbol}</span>
                                    <span className="dash-row-sub truncate">{name || 'Not analyzed yet'}</span>
                                </span>
                                <span className="dash-row-end">
                                    <FlashValue value={priceValue} className="num dash-row-price">{price}</FlashValue>
                                    {pct !== null && <ChangePill value={pct} size="sm" />}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        );
    }

    const hasItems = items.length > 0;
    return (
        <Card className="dash-card dash-watch fade-up" style={style} data-testid="dash-watchlist">
            <CardHeader
                title="Watchlist"
                subtitle={hasItems ? `${total} ${total === 1 ? 'symbol' : 'symbols'} followed` : 'Symbols you follow'}
                icon={Star}
                action={(
                    <Link to="/watchlist" className="ui-btn ui-btn--ghost ui-btn--sm" data-testid="dash-watchlist-link">
                        <span className="ui-btn-label">{hasItems && total > items.length ? `View all ${total}` : 'Open'}</span>
                        <ArrowRight size={14} aria-hidden="true" className="ui-btn-icon-right" />
                    </Link>
                )}
            />
            {body}
            {hasItems && updated && (
                <p className="dash-fineprint">Prices as of your last refresh, {timeAgo(updated)}.</p>
            )}
        </Card>
    );
}
