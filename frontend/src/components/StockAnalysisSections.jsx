import { useEffect, useId, useRef, useState } from 'react';
import {
    Activity,
    BarChart3,
    Building2,
    CalendarRange,
    Clock3,
    Compass,
    Database,
    ExternalLink,
    Flame,
    Globe,
    Landmark,
    LineChart,
    Newspaper,
    ShieldAlert,
    Target,
    Users,
    Zap
} from 'lucide-react';
import {
    Badge,
    Card,
    CardHeader,
    ChangePill,
    Gauge,
    PriceChart,
    RangeBar,
    RecommendationBadge,
    SegmentedControl,
    StatusDot,
    cx
} from './ui';
import { useInterval } from '../hooks/useInterval';
import { EMPTY, formatCurrency, formatDate, formatNumber, formatPercent, timeAgo, toDate } from '../utils/format';

const TONE_BY_SENTIMENT = { positive: 'gain', negative: 'loss', neutral: 'neutral' };
const LEVEL_TONE = { high: 'gain', moderate: 'warn', low: 'neutral' };
const LEVEL_STEPS = { low: 1, moderate: 2, high: 3 };

const levelKey = (text) => String(text || '').trim().toLowerCase();

function signedCurrency(value, currency) {
    if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
    const body = formatCurrency(Math.abs(value), currency);
    if (value > 0) return `+${body}`;
    if (value < 0) return `-${body}`;
    return body;
}

function signed(n, digits = 0) {
    if (n === null || n === undefined || !Number.isFinite(n)) return EMPTY;
    const body = formatNumber(Math.abs(n), digits);
    return n > 0 ? `+${body}` : n < 0 ? `-${body}` : body;
}

/** Three-step meter (Low / Moderate / High). */
function LevelMeter({ level, tone = 'accent', label }) {
    const steps = LEVEL_STEPS[levelKey(level)] || 0;
    return (
        <span className={cx('sa-level', `sa-level--${tone}`)} role="img" aria-label={label || `${level || 'Unknown'} level`}>
            {[1, 2, 3].map((n) => (
                <span key={n} className={cx('sa-level-step', n <= steps && 'is-on')} />
            ))}
        </span>
    );
}

/* Price chart ---------------------------------------------------------------- */

const RANGES = [
    { label: '1M', value: '1m', months: 1, phrase: 'past month' },
    { label: '3M', value: '3m', months: 3, phrase: 'past 3 months' },
    { label: '6M', value: '6m', months: 6, phrase: 'past 6 months' },
    { label: '1Y', value: '1y', months: 12, phrase: 'past year' }
];

function sliceRange(points, months) {
    if (points.length < 2 || months >= 12) return points;
    const last = toDate(points[points.length - 1].date);
    const cutoff = new Date(last);
    cutoff.setMonth(cutoff.getMonth() - months);
    const slice = points.filter((p) => toDate(p.date) >= cutoff);
    return slice.length >= 2 ? slice : points.slice(-2);
}

export function ChartCard({ view, index }) {
    const [range, setRange] = useState('1y');
    const active = RANGES.find((r) => r.value === range) || RANGES[3];
    const points = sliceRange(view.history, active.months);
    const first = points[0].value;
    const last = points[points.length - 1].value;
    const diff = last - first;
    const pct = first ? (diff / Math.abs(first)) * 100 : null;
    const tone = diff > 0 ? 'gain' : diff < 0 ? 'loss' : '';

    return (
        <Card className="sa-card sa-chart-card fade-up" style={{ '--i': index }} data-testid="sa-chart">
            <CardHeader
                icon={LineChart}
                title="Price"
                subtitle={`${formatDate(points[0].date, 'medium')} – ${formatDate(points[points.length - 1].date, 'medium')}`}
                action={(
                    <SegmentedControl
                        size="sm"
                        options={RANGES}
                        value={range}
                        onChange={setRange}
                        testId="sa-range"
                        aria-label="Chart range"
                    />
                )}
            />
            <div className="sa-chart-summary" data-testid="sa-range-return">
                <ChangePill value={pct} />
                <span className={cx('sa-chart-abs num', tone)}>{signedCurrency(diff, view.currency)}</span>
                <span className="sa-chart-period">{active.phrase}</span>
            </div>
            <div className="sa-chart-area">
                <PriceChart key={range} data={points} currency={view.currency} height="100%" className="sa-chart" />
            </div>
        </Card>
    );
}

/* Key stats ---------------------------------------------------------------- */

export function KeyStatsCard({ view, index }) {
    const { stats, range52, currency } = view;
    return (
        <Card className="sa-card sa-stats-card fade-up" style={{ '--i': index }} data-testid="sa-stats">
            <CardHeader icon={BarChart3} title="Key stats" />
            {stats.length > 0 && (
                <dl className="sa-stats">
                    {stats.map((s) => (
                        <div key={s.key} className="sa-stat">
                            <dt>{s.label}</dt>
                            <dd className="num">
                                {s.value}
                                {s.sub && <span className="sa-stat-sub"> / {s.sub}</span>}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
            {range52 && (
                <div className="sa-range52">
                    <span className="sa-subhead">52-week range</span>
                    <RangeBar
                        low={range52.low}
                        high={range52.high}
                        value={view.price}
                        lowLabel="Low"
                        highLabel="High"
                        formatter={(v) => formatCurrency(v, currency)}
                        testId="sa-range52"
                    />
                </div>
            )}
        </Card>
    );
}

/* Verdict ------------------------------------------------------------------ */

const DECISION_TONE = { BUY: 'gain', HOLD: 'warn', SELL: 'loss' };
const THRESHOLD = 3; // backend: +3 or more is BUY, -3 or less is SELL
const DECISION_RULE = {
    BUY: `Score of +${THRESHOLD} or more`,
    HOLD: `Score between -${THRESHOLD - 1} and +${THRESHOLD - 1}`,
    SELL: `Score of -${THRESHOLD} or less`
};

function ScoreScale({ score, span, tone }) {
    const values = [];
    for (let v = -span; v <= span; v += 1) values.push(v);
    const filled = (v) => (score > 0 ? v > 0 && v <= score : score < 0 ? v < 0 && v >= score : v === 0);
    const zoneOf = (v) => (v >= THRESHOLD ? 'buy' : v <= -THRESHOLD ? 'sell' : 'hold');
    const sellCells = span - THRESHOLD + 1;
    return (
        <div
            className={cx('sa-score', `sa-score--${tone}`)}
            role="img"
            aria-label={`Score ${signed(score)} on a scale from ${signed(-span)} to ${signed(span)}. BUY at +${THRESHOLD} or more, SELL at -${THRESHOLD} or less.`}
            style={{ '--cells': values.length }}
        >
            <div className="sa-score-cells">
                {values.map((v, i) => (
                    <span
                        key={v}
                        className={cx('sa-score-cell', `is-${zoneOf(v)}`, filled(v) && 'is-filled', v === 0 && 'is-zero')}
                        style={{ '--d': filled(v) ? Math.abs(v) : 0, '--c': i }}
                    />
                ))}
            </div>
            <div className="sa-score-zones" aria-hidden="true">
                <span style={{ gridColumn: `span ${sellCells}` }}>Sell</span>
                <span style={{ gridColumn: `span ${values.length - sellCells * 2}` }}>Hold</span>
                <span style={{ gridColumn: `span ${sellCells}` }}>Buy</span>
            </div>
        </div>
    );
}

export function VerdictCard({ verdict, index }) {
    const { decision, confidence, score, reasons, signals } = verdict;
    const tone = DECISION_TONE[decision] || 'neutral';
    const span = Math.max(signals.length, Math.abs(score ?? 0), THRESHOLD + 1);
    const showScale = score !== null && signals.length > 0;
    const confTone = LEVEL_TONE[levelKey(confidence)] || 'neutral';
    const tally = ['positive', 'neutral', 'negative']
        .map((k) => ({ k, n: signals.filter((sig) => sig.verdict === k).length }));

    return (
        <Card className={cx('sa-card sa-verdict fade-up', `sa-verdict--${tone}`)} style={{ '--i': index }} data-testid="sa-verdict">
            <CardHeader
                icon={Target}
                title="Verdict"
                subtitle={signals.length ? `${signals.length} technical signals, each scored -1, 0 or +1` : 'Rule-based technical analysis'}
            />

            <div className={cx('sa-verdict-summary', !showScale && 'is-even')}>
                <div className="sa-verdict-tile sa-verdict-decision">
                    <span className="sa-subhead">Recommendation</span>
                    <RecommendationBadge decision={decision} size="lg" className="sa-verdict-badge" data-testid="sa-decision" />
                    {signals.length > 0 && DECISION_RULE[decision] && <span className="sa-verdict-caption">{DECISION_RULE[decision]}</span>}
                </div>
                {confidence && (
                    <div className="sa-verdict-tile">
                        <span className="sa-subhead">Confidence</span>
                        <span className="sa-verdict-value">
                            <LevelMeter level={confidence} tone={confTone} label={`${confidence} confidence`} />
                            {confidence}
                        </span>
                        {signals.length > 0 && (
                            <span className="sa-verdict-caption num">
                                {tally.map((t) => `${t.n} ${t.k}`).join(' · ')}
                            </span>
                        )}
                    </div>
                )}
                {score !== null && showScale && (
                    <div className="sa-verdict-tile sa-verdict-score">
                        <span className="sa-subhead">
                            Score <span className={cx('sa-score-number num', tone)}>{signed(score)}</span>
                            <span className="sa-score-of num"> of ±{span}</span>
                        </span>
                        <ScoreScale score={score} span={span} tone={tone} />
                    </div>
                )}
                {score !== null && !showScale && (
                    <div className="sa-verdict-tile">
                        <span className="sa-subhead">Score</span>
                        <span className={cx('sa-verdict-value num', tone)}>{signed(score)}</span>
                    </div>
                )}
            </div>

            {(reasons.length > 0 || signals.length > 0) && (
                <div className={cx('sa-verdict-detail', reasons.length > 0 && signals.length > 0 && 'is-split')}>
                    {reasons.length > 0 && (
                        <div className="sa-verdict-col">
                            <h4 className="sa-subhead">Why</h4>
                            <ul className="sa-reasons">
                                {reasons.map((reason, n) => (
                                    <li key={n} className="sa-reason">{reason}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {signals.length > 0 && (
                        <div className="sa-verdict-col">
                            <h4 className="sa-subhead">Signals</h4>
                            <div className="ui-table-wrap sa-signals-wrap">
                                <table className="ui-table sa-signals" data-testid="sa-signals">
                                    <thead>
                                        <tr>
                                            <th scope="col">Signal</th>
                                            <th scope="col">Reading</th>
                                            <th scope="col" className="num">Points</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {signals.map((s) => (
                                            <tr key={s.label}>
                                                <td className="sa-signal-label">{s.label}</td>
                                                <td className="sa-signal-value num">{s.value}</td>
                                                <td className="num">
                                                    <Badge size="sm" tone={TONE_BY_SENTIMENT[s.verdict]} dot className="sa-signal-badge">
                                                        {s.points !== null ? signed(s.points) : s.verdict}
                                                        <span className="sr-only"> ({s.verdict})</span>
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <p className="sa-disclaimer">Rule-based technical analysis. Not financial advice.</p>
        </Card>
    );
}

/* Risk --------------------------------------------------------------------- */

const RISK_ZONES = [{ to: 3.5, tone: 'gain' }, { to: 6.5, tone: 'warn' }, { to: 10, tone: 'loss' }];

/** 'Annualized volatility: 32.4%' -> label + short value; longer notes stay sentences. */
function splitFactor(text) {
    const at = text.indexOf(':');
    if (at > 0) {
        const value = text.slice(at + 1).trim();
        if (value && value.length <= 16) return { label: text.slice(0, at).trim(), value };
    }
    return { label: null, value: text };
}

export function RiskCard({ risk, index }) {
    const factors = risk.factors.map(splitFactor);
    const rows = factors.filter((f) => f.label);
    const notes = factors.filter((f) => !f.label);
    return (
        <Card className="sa-card sa-risk fade-up" style={{ '--i': index }} data-testid="sa-risk">
            <CardHeader icon={ShieldAlert} title="Risk" subtitle="From volatility, drawdown and beta" />
            <div className="sa-risk-gauge">
                <Gauge
                    value={risk.score}
                    min={1}
                    max={10}
                    showMax
                    size={184}
                    label="Risk score"
                    sublabel={risk.level}
                    zones={RISK_ZONES}
                    format={(v) => formatNumber(v, 0)}
                    testId="sa-risk-gauge"
                />
                <div className="sa-risk-legend" aria-hidden="true">
                    <span><i className="is-gain" />1–3 low</span>
                    <span><i className="is-warn" />4–6 moderate</span>
                    <span><i className="is-loss" />7–10 high</span>
                </div>
            </div>
            {rows.length > 0 && (
                <dl className="sa-kv">
                    {rows.map((f) => (
                        <div key={f.label} className="sa-kv-row">
                            <dt>{f.label}</dt>
                            <dd className="num">{f.value}</dd>
                        </div>
                    ))}
                </dl>
            )}
            {notes.map((f) => (
                <p key={f.value} className="sa-note">{f.value}</p>
            ))}
            {risk.adjustments.length > 0 && (
                <div className="sa-scoring">
                    <h4 className="sa-subhead">How it is scored</h4>
                    <ul className="sa-scoring-list">
                        {risk.adjustments.map((a) => <li key={a}>{a}</li>)}
                    </ul>
                </div>
            )}
        </Card>
    );
}

/* Technicals --------------------------------------------------------------- */

const RSI_ZONES = [{ to: 30, tone: 'gain' }, { to: 70, tone: 'info' }, { to: 100, tone: 'loss' }];

function rsiLabel(rsi) {
    if (rsi === null) return 'Not enough history';
    if (rsi < 30) return 'Oversold';
    if (rsi > 70) return 'Overbought';
    return 'Neutral';
}

export function TechnicalsCard({ technicals, index }) {
    const { rsi, smas, returns, cross } = technicals;
    const hasReturns = returns.some((r) => r.value !== null);
    return (
        <Card className="sa-card sa-tech fade-up" style={{ '--i': index }} data-testid="sa-technicals">
            <CardHeader
                icon={Activity}
                title="Technicals"
                subtitle="Momentum, moving averages and returns"
                action={cross !== null ? (
                    <Badge tone={cross ? 'gain' : 'loss'} size="sm" dot title={cross ? '50-day average above the 200-day' : '50-day average below the 200-day'}>
                        {cross ? 'Golden cross' : 'Death cross'}
                    </Badge>
                ) : null}
            />
            <div className="sa-tech-grid">
                <div className="sa-tech-rsi">
                    <Gauge value={rsi} min={0} max={100} size={164} label="RSI (14)" sublabel={rsiLabel(rsi)} zones={RSI_ZONES} testId="sa-rsi" />
                    <p className="sa-tech-hint">Under 30 oversold · over 70 overbought</p>
                </div>
                {smas.length > 0 && (
                    <div className="sa-tech-ma">
                        <h4 className="sa-subhead">Price vs moving averages</h4>
                        <ul className="sa-ma-list">
                            {smas.map((m) => {
                                const above = m.diff !== null && m.diff >= 0;
                                return (
                                    <li key={m.label} className="sa-ma-row">
                                        <span className="sa-ma-label">{m.label} <span className="sa-ma-kind">SMA</span></span>
                                        <span className="sa-ma-value num">{m.value}</span>
                                        <span className={cx('sa-ma-diff num', m.diff !== null && (above ? 'gain' : 'loss'))}>
                                            {formatPercent(m.diff, { digits: 1 })}
                                        </span>
                                        {m.diff !== null && (
                                            <Badge size="sm" tone={above ? 'gain' : 'loss'} className="sa-ma-badge">
                                                {above ? 'Above' : 'Below'}
                                            </Badge>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
            {hasReturns && (
                <div className="sa-returns">
                    <h4 className="sa-subhead">Returns</h4>
                    <ul className="sa-returns-list" data-testid="sa-returns">
                        {returns.map((r) => (
                            <li key={r.label} className="sa-return">
                                <span className="sa-return-label">{r.label}</span>
                                <ChangePill value={r.value} size="sm" digits={1} />
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Card>
    );
}

/* Outlook + investor fit ------------------------------------------------------ */

export function OutlookCard({ outlook, index }) {
    const confTone = LEVEL_TONE[levelKey(outlook.confidence)] || 'neutral';
    return (
        <Card className="sa-card sa-outlook fade-up" style={{ '--i': index }} data-testid="sa-outlook">
            <CardHeader
                icon={Compass}
                title="Outlook"
                subtitle="Read from recent momentum and trend"
                action={outlook.confidence ? (
                    <span className="sa-outlook-conf">
                        <LevelMeter level={outlook.confidence} tone={confTone} label={`${outlook.confidence} confidence`} />
                        <span>{outlook.confidence}<span className="sa-wide-only"> confidence</span></span>
                    </span>
                ) : null}
            />
            <div className="sa-outlook-list">
                {outlook.shortTerm && (
                    <div className="sa-outlook-item">
                        <span className="sa-outlook-label"><Clock3 size={14} aria-hidden="true" />Short term</span>
                        <p>{outlook.shortTerm}</p>
                    </div>
                )}
                {outlook.longTerm && (
                    <div className="sa-outlook-item">
                        <span className="sa-outlook-label"><CalendarRange size={14} aria-hidden="true" />Long term</span>
                        <p>{outlook.longTerm}</p>
                    </div>
                )}
            </div>
        </Card>
    );
}

const FIT_ICONS = [
    [/short/i, Zap],
    [/long/i, Landmark],
    [/risk/i, Flame]
];

export function InvestorFitCard({ fit, index }) {
    return (
        <Card className="sa-card sa-fit fade-up" style={{ '--i': index }} data-testid="sa-fit">
            <CardHeader icon={Users} title="Investor fit" subtitle="How well it suits each style" />
            <ul className="sa-fit-list">
                {fit.map((item) => {
                    const Icon = FIT_ICONS.find(([re]) => re.test(item.type))?.[1] || Users;
                    const key = levelKey(item.suitability);
                    const tone = LEVEL_TONE[key] || 'neutral';
                    return (
                        <li key={item.type} className="sa-fit-item">
                            <span className="sa-fit-icon" aria-hidden="true"><Icon size={15} /></span>
                            <div className="sa-fit-body">
                                <div className="sa-fit-head">
                                    <span className="sa-fit-type">{item.type}</span>
                                    {item.suitability && (
                                        <span className={cx('sa-fit-level', `is-${tone}`)}>
                                            <LevelMeter level={item.suitability} tone={tone} label={`${item.suitability} suitability`} />
                                            {item.suitability}
                                        </span>
                                    )}
                                </div>
                                {item.reason && <p className="sa-fit-reason">{item.reason}</p>}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
}

/* News & sentiment --------------------------------------------------------- */

const SENTIMENT_LABEL = { positive: 'Positive', negative: 'Negative', neutral: 'Neutral' };

export function NewsCard({ news, symbol, index }) {
    const { sentiment, summary, note, counts, total, items } = news;
    const tone = TONE_BY_SENTIMENT[sentiment] || 'neutral';
    return (
        <Card className="sa-card sa-news fade-up" style={{ '--i': index }} data-testid="sa-news">
            <CardHeader
                icon={Newspaper}
                title="News & sentiment"
                subtitle={note || 'Keyword-based sentiment of recent headlines'}
            />
            <div className="sa-sentiment">
                <div className="sa-sentiment-head">
                    {sentiment && (
                        <Badge tone={tone} dot size="lg" data-testid="sa-sentiment">
                            {SENTIMENT_LABEL[sentiment] || sentiment}
                        </Badge>
                    )}
                    {summary && <p className="sa-sentiment-summary">{summary}</p>}
                </div>
                {total > 0 && (
                    <>
                        <div
                            className="sa-sentiment-bar"
                            role="img"
                            aria-label={counts.map((c) => `${c.value} ${c.key}`).join(', ')}
                        >
                            {counts.filter((c) => c.value > 0).map((c) => (
                                <span key={c.key} className={`is-${c.key}`} style={{ flexGrow: c.value }} />
                            ))}
                        </div>
                        <ul className="sa-sentiment-legend">
                            {counts.map((c) => (
                                <li key={c.key}>
                                    <i className={`is-${c.key}`} aria-hidden="true" />
                                    <span className="num">{c.value}</span> {c.key}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>

            {items.length > 0 ? (
                <ul className="sa-news-list" data-testid="sa-news-list">
                    {items.map((item, n) => (
                        <li key={`${item.title}-${n}`} className="sa-news-item">
                            <StatusDot tone={TONE_BY_SENTIMENT[item.sentiment]} label={`${SENTIMENT_LABEL[item.sentiment]} headline`} className="sa-news-dot" />
                            <div className="sa-news-body">
                                {item.link ? (
                                    <a className="sa-news-title" href={item.link} target="_blank" rel="noopener noreferrer">
                                        {item.title}
                                        <ExternalLink size={12} aria-hidden="true" className="sa-news-ext" />
                                        <span className="sr-only"> (opens in a new tab)</span>
                                    </a>
                                ) : (
                                    <span className="sa-news-title">{item.title}</span>
                                )}
                                {item.summary && <p className="sa-news-summary">{item.summary}</p>}
                                <p className="sa-news-meta">
                                    <span>{item.publisher}</span>
                                    {item.publishedAt && (
                                        <>
                                            <span aria-hidden="true">·</span>
                                            <time dateTime={String(item.publishedAt)} title={formatDate(item.publishedAt, 'long')}>
                                                {timeAgo(item.publishedAt)}
                                            </time>
                                        </>
                                    )}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : news.hasFeed && !summary ? (
                <p className="sa-news-empty">
                    <Newspaper size={16} aria-hidden="true" />
                    No recent Yahoo Finance headlines for <span className="mono">{symbol}</span>.
                </p>
            ) : null}
        </Card>
    );
}

/* About -------------------------------------------------------------------- */

function hostOf(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

export function AboutCard({ about, index }) {
    const { description, website, employees, sector, industry, exchange } = about;
    const [expanded, setExpanded] = useState(false);
    const [overflowing, setOverflowing] = useState(false);
    const textRef = useRef(null);
    const descId = `sa-about-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

    // Show the toggle only when the clamped text is actually cut off.
    useEffect(() => {
        const el = textRef.current;
        if (!el || expanded || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(() => setOverflowing(el.scrollHeight - el.clientHeight > 2));
        observer.observe(el);
        return () => observer.disconnect();
    }, [expanded, description]);

    const rows = [
        sector && { key: 'sector', label: 'Sector', value: sector },
        industry && { key: 'industry', label: 'Industry', value: industry },
        exchange && { key: 'exchange', label: 'Exchange', value: exchange },
        employees && { key: 'employees', label: 'Employees', value: formatNumber(employees, 0) }
    ].filter(Boolean);

    return (
        <Card className="sa-card sa-about fade-up" style={{ '--i': index }} data-testid="sa-about">
            <CardHeader icon={Building2} title="About" />
            {description && (
                <div className="sa-about-text">
                    <p ref={textRef} id={descId} className={cx('sa-about-desc', !expanded && 'is-clamped')}>
                        {description}
                    </p>
                    {(overflowing || expanded) && (
                        <button
                            type="button"
                            className="sa-link-btn"
                            aria-expanded={expanded}
                            aria-controls={descId}
                            onClick={() => setExpanded((e) => !e)}
                            data-testid="sa-about-toggle"
                        >
                            {expanded ? 'Show less' : 'Show more'}
                        </button>
                    )}
                </div>
            )}
            {rows.length > 0 && (
                <dl className="sa-kv">
                    {rows.map((r) => (
                        <div key={r.key} className="sa-kv-row">
                            <dt>{r.label}</dt>
                            <dd className="num">{r.value}</dd>
                        </div>
                    ))}
                </dl>
            )}
            {website && (
                <a className="sa-website" href={website} target="_blank" rel="noopener noreferrer">
                    <Globe size={15} aria-hidden="true" />
                    <span className="truncate">{hostOf(website)}</span>
                    <ExternalLink size={13} aria-hidden="true" />
                    <span className="sr-only"> (opens in a new tab)</span>
                </a>
            )}
        </Card>
    );
}

/* Footer ------------------------------------------------------------------- */

export function ReportFooter({ source, timestamp, index }) {
    const [, setTick] = useState(0);
    useInterval(() => setTick((t) => t + 1), 60000); // keeps "Updated x ago" honest
    return (
        <footer className="sa-footer fade-up" style={{ '--i': index }} data-testid="sa-footer">
            <span className="sa-footer-source">
                <Database size={13} aria-hidden="true" />
                Data: {source}
                {timestamp && (
                    <>
                        <span aria-hidden="true"> · </span>
                        <span title={formatDate(timestamp, 'long')}>Updated {timeAgo(timestamp)}</span>
                    </>
                )}
            </span>
            <span className="sa-footer-note">Rule-based technical analysis. Not financial advice.</span>
        </footer>
    );
}
