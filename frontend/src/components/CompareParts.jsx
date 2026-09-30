import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BadgeCheck,
    BarChart3,
    Check,
    Equal,
    Gauge as GaugeIcon,
    MoveRight,
    ShieldCheck,
    Table2,
    TrendingDown,
    TrendingUp,
    Trophy
} from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent, toNumber } from '../utils/format';
import {
    AnimatedNumber,
    Badge,
    Card,
    CardHeader,
    ChangePill,
    RecommendationBadge,
    Skeleton,
    SkeletonText,
    SymbolAvatar,
    cx
} from './ui';
import { METRIC_HINTS, SIDE_COLORS, formatMetric, quoteOf, typeLabel } from './CompareModel';

function riskTone(score) {
    if (score === null) return 'neutral';
    if (score <= 3) return 'gain';
    if (score <= 6) return 'warn';
    return 'loss';
}

/** 10-step risk meter (filled up to the score, coloured by zone). */
function RiskMeter({ score }) {
    const n = toNumber(score);
    const tone = riskTone(n);
    return (
        <span className={cx('cmp-risk', `cmp-risk--${tone}`)} role="img" aria-label={n === null ? 'Risk unavailable' : `Risk ${n} out of 10`}>
            {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={cx('cmp-risk-step', n !== null && i < n && 'is-on')} style={{ '--i': i }} />
            ))}
        </span>
    );
}

function signed(value, currency) {
    if (value === null) return '—';
    return `${value > 0 ? '+' : ''}${formatCurrency(value, currency)}`;
}

/** Identity card for one side of the comparison. */
export function CompareHero({ stock, side, className, style }) {
    const color = SIDE_COLORS[side];
    const { price, change, changePercent, currency } = quoteOf(stock);
    const overview = stock.companyOverview || {};
    const rec = stock.recommendation || {};
    const risk = stock.riskScore || {};
    const riskScore = toNumber(risk.score);
    const yearReturn = toNumber(stock.indicators?.returns?.['1y']) ?? toNumber(stock.yearPerformance?.percentChange);
    const kind = typeLabel(stock.quoteType);
    const crypto = String(stock.quoteType || '').toUpperCase() === 'CRYPTOCURRENCY';
    const meta = crypto
        ? `${currency} · Trades around the clock`
        : [overview.exchange, overview.sector && overview.sector !== 'N/A' ? overview.sector : null, currency !== 'USD' ? currency : null]
            .filter(Boolean).join(' · ');

    return (
        <Card
            className={cx('cmp-hero', className)}
            style={{ ...style, '--cmp-color': color }}
            data-testid={`cmp-hero-${side + 1}`}
        >
            <div className="cmp-hero-top">
                <SymbolAvatar symbol={stock.symbol} size={44} />
                <div className="cmp-hero-id">
                    <div className="cmp-hero-symbol-row">
                        <span className="mono cmp-hero-symbol">{stock.symbol}</span>
                        {kind && <Badge size="sm" tone="neutral">{kind}</Badge>}
                    </div>
                    <div className="truncate cmp-hero-name">{overview.name || stock.symbol}</div>
                </div>
                <span className="cmp-hero-side" aria-hidden="true">{side === 0 ? 'A' : 'B'}</span>
            </div>

            <div className="cmp-hero-quote">
                <AnimatedNumber value={price} format={(v) => formatCurrency(v, currency)} className="num cmp-hero-price" />
                <div className="cmp-hero-change">
                    <ChangePill value={changePercent} />
                    <span className={cx('num', change > 0 ? 'gain' : change < 0 ? 'loss' : 'muted')}>{signed(change, currency)}</span>
                    <span className="muted">today</span>
                </div>
                {meta && <div className="cmp-hero-meta truncate">{meta}</div>}
            </div>

            <dl className="cmp-hero-stats">
                <div className="cmp-hero-stat">
                    <dt>Rating</dt>
                    <dd>
                        <RecommendationBadge decision={rec.decision} size="sm" />
                        {rec.confidence && <span className="cmp-hero-sub">{rec.confidence}</span>}
                    </dd>
                </div>
                <div className="cmp-hero-stat">
                    <dt>Risk</dt>
                    <dd className="cmp-hero-risk">
                        <span className="cmp-hero-risk-top">
                            <span className="num cmp-hero-strong">{riskScore === null ? '—' : `${riskScore}/10`}</span>
                            <span className="cmp-hero-sub">{String(risk.level || '').replace(/ Risk$/, '')}</span>
                        </span>
                        <RiskMeter score={riskScore} />
                    </dd>
                </div>
                <div className="cmp-hero-stat">
                    <dt>1Y return</dt>
                    <dd className={cx('num', 'cmp-hero-strong', yearReturn > 0 ? 'gain' : yearReturn < 0 ? 'loss' : '')}>
                        {formatPercent(yearReturn)}
                    </dd>
                </div>
            </dl>

            <Link to={`/research?symbol=${encodeURIComponent(stock.symbol)}`} className="cmp-hero-link" data-testid={`cmp-report-${side + 1}`}>
                Full report
                <ArrowRight size={14} aria-hidden="true" />
            </Link>
        </Card>
    );
}

/** Side-by-side metrics from comparison.metrics, better value highlighted. */
export function CompareMetrics({ stockA, stockB, metrics, className, style }) {
    const rows = Array.isArray(metrics) ? metrics : [];
    const winsA = rows.filter((m) => m.better === 'stock1').length;
    const winsB = rows.filter((m) => m.better === 'stock2').length;
    const decided = rows.filter((m) => m.better === 'stock1' || m.better === 'stock2' || m.better === 'tie').length;
    const stocks = [stockA, stockB];

    return (
        <Card className={cx('cmp-metrics-card', className)} style={style} padded={false} data-testid="cmp-metrics">
            <div className="cmp-card-pad">
                <CardHeader icon={Table2} title="Key metrics" subtitle="The better value is highlighted where one is clearly preferable" />
            </div>
            <div className="ui-table-wrap ui-table-wrap--flush cmp-metrics-wrap">
                <table className="ui-table cmp-metrics">
                    <thead>
                        <tr>
                            <th scope="col">Metric</th>
                            {stocks.map((s, i) => (
                                <th key={s.symbol} scope="col" className="num">
                                    <span className="cmp-th-symbol">
                                        <span className="cmp-swatch" style={{ '--cmp-color': SIDE_COLORS[i] }} aria-hidden="true" />
                                        <span className="mono">{s.symbol}</span>
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((m) => (
                            <tr key={m.key} data-testid={`cmp-metric-${m.key}`}>
                                <th scope="row" className="cmp-metric-label">
                                    <span className="cmp-metric-name">{m.label}</span>
                                    {METRIC_HINTS[m.key] && <span className="cmp-metric-hint">{METRIC_HINTS[m.key]}</span>}
                                </th>
                                {['stock1', 'stock2'].map((key, i) => {
                                    const wins = m.better === key;
                                    return (
                                        <td
                                            key={key}
                                            className={cx('num', 'cmp-metric-value', wins && 'is-better', m[key] === null && 'is-empty')}
                                            style={{ '--cmp-color': SIDE_COLORS[i] }}
                                            data-better={wins ? 'true' : undefined}
                                        >
                                            <span className="cmp-metric-cell">
                                                {wins && <Check size={13} strokeWidth={3} className="cmp-metric-check" aria-hidden="true" />}
                                                {formatMetric(m, m[key], stocks[i].currency)}
                                                {wins && <span className="sr-only"> (better)</span>}
                                            </span>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {decided > 0 && (
                <div className="cmp-tally">
                    <span className="cmp-tally-label">Better on</span>
                    {stocks.map((s, i) => (
                        <span key={s.symbol} className="cmp-tally-item" style={{ '--cmp-color': SIDE_COLORS[i] }}>
                            <span className="cmp-swatch" aria-hidden="true" />
                            <span className="mono">{s.symbol}</span>
                            <strong className="num">{i === 0 ? winsA : winsB}</strong>
                        </span>
                    ))}
                    <span className="cmp-tally-of num">of {decided} comparable</span>
                </div>
            )}
        </Card>
    );
}

const PERIODS = [
    { key: '1w', label: '1W' },
    { key: '1m', label: '1M' },
    { key: '3m', label: '3M' },
    { key: '6m', label: '6M' },
    { key: '1y', label: '1Y' }
];

/** Diverging bars of 1W to 1Y returns for both symbols. */
export function CompareReturns({ stockA, stockB, className, style }) {
    const stocks = [stockA, stockB];
    const rows = PERIODS.map((p) => ({
        ...p,
        values: stocks.map((s) => toNumber(s.indicators?.returns?.[p.key]))
    })).filter((r) => r.values.some((v) => v !== null));
    if (!rows.length) return null;
    const max = Math.max(1, ...rows.flatMap((r) => r.values.map((v) => Math.abs(v ?? 0))));

    return (
        <Card className={cx('cmp-returns-card', className)} style={style} data-testid="cmp-returns">
            <CardHeader icon={BarChart3} title="Returns by period" subtitle="Price change over each lookback" />
            <div className="cmp-returns">
                {rows.map((row, r) => (
                    <div key={row.key} className="cmp-returns-row">
                        <span className="cmp-returns-period">{row.label}</span>
                        <div className="cmp-returns-bars">
                            {row.values.map((v, i) => {
                                const width = v === null ? 0 : (Math.abs(v) / max) * 34;
                                const negative = v !== null && v < 0;
                                return (
                                    <div key={stocks[i].symbol} className="cmp-returns-line" title={`${stocks[i].symbol} ${row.label}: ${formatPercent(v)}`}>
                                        <span className="cmp-returns-axis" aria-hidden="true" />
                                        {v !== null && (
                                            <span
                                                className={cx('cmp-returns-bar', negative && 'is-negative')}
                                                style={{ '--cmp-color': SIDE_COLORS[i], width: `${width}%`, '--i': r * 2 + i }}
                                                aria-hidden="true"
                                            />
                                        )}
                                        <span
                                            className={cx('cmp-returns-value', 'num', negative ? 'is-left' : 'is-right', v === null && 'muted')}
                                            style={{ '--offset': `${width}%` }}
                                        >
                                            <span className="sr-only">{stocks[i].symbol} </span>
                                            {formatPercent(v, { digits: 1 })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            <div className="cmp-returns-legend" aria-hidden="true">
                {stocks.map((s, i) => (
                    <span key={s.symbol} className="cmp-legend-item">
                        <span className="cmp-swatch" style={{ '--cmp-color': SIDE_COLORS[i] }} />
                        <span className="mono">{s.symbol}</span>
                    </span>
                ))}
            </div>
        </Card>
    );
}

const TREND = {
    bullish: { label: 'Uptrend', tone: 'gain', icon: TrendingUp },
    bearish: { label: 'Downtrend', tone: 'loss', icon: TrendingDown },
    sideways: { label: 'Sideways', tone: 'neutral', icon: MoveRight }
};

function vsAverage(stock, key) {
    const price = quoteOf(stock).price;
    const avg = toNumber(stock.indicators?.[key]);
    return price !== null && avg ? ((price - avg) / avg) * 100 : null;
}

function PctCell({ value }) {
    return (
        <span className={cx('num', value > 0 ? 'gain' : value < 0 ? 'loss' : 'muted')}>
            {formatPercent(value, { digits: 1 })}
        </span>
    );
}

/** Trend direction and distance from the moving averages and 52-week high. */
export function CompareTrend({ stockA, stockB, className, style }) {
    const stocks = [stockA, stockB];
    if (!stocks.some((s) => s.indicators)) return null;
    const rows = [
        {
            label: 'Trend',
            render: (s) => {
                const t = TREND[s.currentMarketStatus?.trend] || TREND.sideways;
                return <Badge size="sm" tone={t.tone} icon={t.icon}>{t.label}</Badge>;
            }
        },
        { label: 'vs 50-day average', render: (s) => <PctCell value={vsAverage(s, 'sma50')} /> },
        { label: 'vs 200-day average', render: (s) => <PctCell value={vsAverage(s, 'sma200')} /> },
        { label: 'From 52-week high', render: (s) => <PctCell value={toNumber(s.indicators?.distanceFromHigh)} /> },
        {
            label: 'RSI (14)',
            render: (s) => {
                const rsi = toNumber(s.indicators?.rsi14);
                const zone = rsi === null ? '' : rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral';
                return (
                    <span className="cmp-rsi">
                        <span className="num">{formatNumber(rsi, 1)}</span>
                        {zone && <span className="cmp-rsi-zone">{zone}</span>}
                    </span>
                );
            }
        }
    ];
    return (
        <Card className={cx('cmp-trend-card', className)} style={style} data-testid="cmp-trend">
            <CardHeader icon={GaugeIcon} title="Trend and momentum" subtitle="Where each price sits against its averages" />
            <div className="cmp-trend" role="table" aria-label="Trend and momentum">
                <div className="cmp-trend-row cmp-trend-head" role="row">
                    <span role="columnheader" className="sr-only">Signal</span>
                    {stocks.map((s, i) => (
                        <span key={s.symbol} role="columnheader" className="cmp-th-symbol">
                            <span className="cmp-swatch" style={{ '--cmp-color': SIDE_COLORS[i] }} aria-hidden="true" />
                            <span className="mono">{s.symbol}</span>
                        </span>
                    ))}
                </div>
                {rows.map((row) => (
                    <div key={row.label} className="cmp-trend-row" role="row">
                        <span role="rowheader" className="cmp-trend-label">{row.label}</span>
                        {stocks.map((s) => (
                            <span key={s.symbol} role="cell" className="cmp-trend-cell">{row.render(s)}</span>
                        ))}
                    </div>
                ))}
            </div>
        </Card>
    );
}

function Sym({ s }) {
    return <span className="mono cmp-nowrap">{s}</span>;
}

function Winner({ symbol, stocks, fallback }) {
    const index = stocks.findIndex((s) => s.symbol === symbol);
    if (index === -1) {
        return (
            <div className="cmp-verdict-winner is-even">
                <span className="cmp-verdict-even" aria-hidden="true"><Equal size={16} /></span>
                <span className="cmp-verdict-name">{fallback}</span>
            </div>
        );
    }
    return (
        <div className="cmp-verdict-winner" style={{ '--cmp-color': SIDE_COLORS[index] }}>
            <SymbolAvatar symbol={symbol} size={30} />
            <span className="mono cmp-verdict-name">{symbol}</span>
            <span className="cmp-swatch" aria-hidden="true" />
        </div>
    );
}

/** Three summary cards from comparison.performance / risk / recommendation. */
export function CompareVerdicts({ stockA, stockB, comparison, startIndex = 0 }) {
    const stocks = [stockA, stockB];
    const perf = comparison?.performance || {};
    const risk = comparison?.risk || {};
    const rec = comparison?.recommendation || {};
    const ret = stocks.map((s) => toNumber(s.indicators?.returns?.['1y']) ?? toNumber(s.yearPerformance?.percentChange));
    const riskScores = stocks.map((s) => toNumber(s.riskScore?.score));
    const decisions = stocks.map((s) => s.recommendation || {});
    const gap = toNumber(perf.difference);
    const sameDecision = decisions[0].decision && decisions[0].decision === decisions[1].decision;

    const cards = [
        {
            key: 'performance',
            icon: Trophy,
            title: 'Better 1-year return',
            winner: perf.winner,
            fallback: perf.difference === 'N/A' ? 'Not enough history' : 'Level',
            detail: gap !== null
                ? <>{formatNumber(gap, 2)} pts apart: <Sym s={stocks[0].symbol} /> {formatPercent(ret[0])} vs <Sym s={stocks[1].symbol} /> {formatPercent(ret[1])}</>
                : 'A full year of prices is not available for both.'
        },
        {
            key: 'risk',
            icon: ShieldCheck,
            title: 'Lower risk',
            winner: risk.lowerRisk,
            fallback: 'Same risk',
            detail: riskScores.every((v) => v !== null)
                ? <>{risk.scoreDifference ? `${risk.scoreDifference} point${risk.scoreDifference === 1 ? '' : 's'} lower` : 'Equal scores'}: <Sym s={stocks[0].symbol} /> {riskScores[0]}/10 vs <Sym s={stocks[1].symbol} /> {riskScores[1]}/10, based on volatility and drawdowns</>
                : 'Risk scores are not available for both.'
        },
        {
            key: 'recommendation',
            icon: BadgeCheck,
            title: 'Stronger rating',
            winner: rec.stronger,
            fallback: 'Tied',
            detail: (
                <>
                    <Sym s={stocks[0].symbol} /> {decisions[0].decision || 'N/A'} ({decisions[0].confidence || '—'} confidence) vs{' '}
                    <Sym s={stocks[1].symbol} /> {decisions[1].decision || 'N/A'} ({decisions[1].confidence || '—'})
                    {sameDecision && rec.stronger && rec.stronger !== 'Equal'
                        ? `. Same call, split by the points score: ${toNumber(decisions[0].score) ?? '—'} vs ${toNumber(decisions[1].score) ?? '—'}.`
                        : ''}
                </>
            )
        }
    ];

    return (
        <div className="cmp-verdicts" data-testid="cmp-verdicts">
            {cards.map((card, i) => {
                const Icon = card.icon;
                const index = stocks.findIndex((s) => s.symbol === card.winner);
                return (
                    <Card
                        key={card.key}
                        className={cx('cmp-verdict', 'fade-up', index === -1 && 'is-even')}
                        style={{ '--i': startIndex + i, '--cmp-color': index === -1 ? 'var(--sc-text-faint)' : SIDE_COLORS[index] }}
                        data-testid={`cmp-verdict-${card.key}`}
                    >
                        <div className="cmp-verdict-head">
                            <span className="cmp-verdict-icon" aria-hidden="true"><Icon size={16} /></span>
                            <span className="cmp-verdict-title">{card.title}</span>
                        </div>
                        <Winner symbol={card.winner} stocks={stocks} fallback={card.fallback} />
                        <p className="cmp-verdict-detail num">{card.detail}</p>
                    </Card>
                );
            })}
        </div>
    );
}

function HeroSkeleton({ side, symbol }) {
    return (
        <Card className="cmp-hero cmp-hero--skeleton fade-up" style={{ '--i': side, '--cmp-color': SIDE_COLORS[side] }} aria-hidden="true">
            <div className="cmp-hero-top">
                <SymbolAvatar symbol={symbol} size={44} />
                <div className="cmp-hero-id">
                    <span className="mono cmp-hero-symbol">{symbol}</span>
                    <Skeleton width="60%" height={12} style={{ marginTop: 6 }} />
                </div>
            </div>
            <div className="cmp-hero-quote">
                <Skeleton width="46%" height={34} radius={8} />
                <Skeleton width="38%" height={20} radius={999} style={{ marginTop: 10 }} />
            </div>
            <div className="cmp-hero-stats">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="cmp-hero-stat">
                        <Skeleton width="50%" height={10} />
                        <Skeleton width="80%" height={18} radius={6} style={{ marginTop: 8 }} />
                    </div>
                ))}
            </div>
        </Card>
    );
}

/** Loading placeholder shaped like the results. */
export function CompareSkeleton({ symbols }) {
    return (
        <div className="cmp-results" aria-busy="true" data-testid="cmp-loading">
            <p className="sr-only" role="status">Comparing {symbols.join(' and ')}…</p>
            <div className="cmp-heroes">
                <HeroSkeleton side={0} symbol={symbols[0]} />
                <span className="cmp-vs fade-up" style={{ '--i': 1 }} aria-hidden="true">vs</span>
                <HeroSkeleton side={1} symbol={symbols[1]} />
            </div>
            <Card className="fade-up" style={{ '--i': 2 }} aria-hidden="true">
                <div className="cmp-skel-head">
                    <Skeleton width={180} height={14} />
                    <Skeleton width={150} height={28} radius={10} />
                </div>
                <Skeleton height={320} radius={12} style={{ marginTop: 16 }} />
            </Card>
            <div className="cmp-grid">
                <Card className="fade-up" style={{ '--i': 3 }} aria-hidden="true">
                    <Skeleton width={140} height={14} />
                    <SkeletonText lines={8} lineHeight={14} gap={20} lastWidth="80%" style={{ marginTop: 24 }} />
                </Card>
                <Card className="fade-up" style={{ '--i': 4 }} aria-hidden="true">
                    <Skeleton width={160} height={14} />
                    <SkeletonText lines={6} lineHeight={12} gap={20} style={{ marginTop: 24 }} />
                </Card>
            </div>
        </div>
    );
}

export default CompareHero;
