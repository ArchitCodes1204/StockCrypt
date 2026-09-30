import { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { Check, MoveRight, Plus, RotateCcw, Scale, Star, TrendingDown, TrendingUp, X } from 'lucide-react';
import {
    AnimatedNumber,
    Badge,
    Button,
    Card,
    ChangePill,
    FlashValue,
    IconButton,
    StatusDot,
    SymbolAvatar,
    cx
} from './ui';
import { EMPTY, formatCompact, formatCurrency, formatDate, formatNumber, formatPercent, symbolColor, toDate, toNumber } from '../utils/format';
import {
    AboutCard,
    ChartCard,
    InvestorFitCard,
    KeyStatsCard,
    NewsCard,
    OutlookCard,
    ReportFooter,
    RiskCard,
    TechnicalsCard,
    VerdictCard
} from './StockAnalysisSections';
import './StockAnalysis.css';

/* ---------------------------------------------------------------------------
   View model: turns an analysis object (new or legacy shape) into plain,
   display-ready values. Anything missing becomes null so the matching
   section can hide itself instead of crashing.
   --------------------------------------------------------------------------- */

const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const asList = (value) => (Array.isArray(value) ? value : []);

/** A trimmed string, or null for '', 'N/A', non-strings. */
function cleanText(value) {
    if (typeof value !== 'string') return null;
    const s = value.trim();
    return s && !/^n\/?a$/i.test(s) ? s : null;
}

function signedCurrency(value, currency) {
    const n = toNumber(value);
    if (n === null) return EMPTY;
    const body = formatCurrency(Math.abs(n), currency);
    if (n > 0) return `+${body}`;
    if (n < 0) return `-${body}`;
    return body;
}

const TYPE_LABELS = { EQUITY: 'Stock', ETF: 'ETF', CRYPTOCURRENCY: 'Crypto', INDEX: 'Index', MUTUALFUND: 'Fund', CURRENCY: 'FX', FUTURE: 'Future' };

const TRENDS = {
    bullish: { label: 'Uptrend', tone: 'gain', icon: TrendingUp },
    bearish: { label: 'Downtrend', tone: 'loss', icon: TrendingDown },
    sideways: { label: 'Sideways', tone: 'warn', icon: MoveRight }
};

function sessionOf(state, isCrypto) {
    if (isCrypto) return { label: 'Trades 24/7', tone: 'gain', pulse: true };
    switch (String(state || '').toUpperCase()) {
        case 'REGULAR':
            return { label: 'Market open', tone: 'gain', pulse: true };
        case 'PRE':
            return { label: 'Pre-market', tone: 'warn', pulse: true };
        case 'POST':
            return { label: 'After hours', tone: 'warn', pulse: false };
        case 'PREPRE':
        case 'POSTPOST':
        case 'CLOSED':
            return { label: 'Market closed', tone: 'neutral', pulse: false };
        default:
            return null;
    }
}

function asOfLabel(dateLike) {
    const d = toDate(dateLike);
    if (!d) return null;
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay ? `as of ${formatDate(d, 'time')}` : `as of ${formatDate(d, 'short')}, ${formatDate(d, 'time')}`;
}

const SAFE_URL = /^https?:\/\//i;

function buildView(a) {
    const co = asObject(a.companyOverview);
    const ms = asObject(a.currentMarketStatus);
    const ind = a.indicators && typeof a.indicators === 'object' ? a.indicators : null;
    const yp = asObject(a.yearPerformance);
    const rec = asObject(a.recommendation);
    const risk = asObject(a.riskScore);
    const gf = asObject(a.growthForecast);
    const ns = asObject(a.newsSentiment);

    const symbol = String(a.symbol || '').trim().toUpperCase();
    const currency = cleanText(a.currency) || 'USD';
    const quoteType = (cleanText(a.quoteType) || '').toUpperCase() || null;
    const isCrypto = quoteType === 'CRYPTOCURRENCY' || /-USD[T]?$/.test(symbol);
    const price = toNumber(ms.priceRaw) ?? toNumber(ms.currentPrice) ?? toNumber(yp.currentPrice);
    const money = (v, opts) => formatCurrency(v, currency, opts);

    const sector = cleanText(co.sector);
    const industry = cleanText(co.industry);
    const exchange = cleanText(co.exchange);

    // Price history (ascending, numbers only)
    const history = asList(a.priceHistory)
        .map((p) => ({ date: p?.date, value: toNumber(p?.close ?? p?.value) }))
        .filter((p) => p.value !== null && toDate(p.date));

    // Key stats (rows without data are left out)
    const capRaw = toNumber(co.marketCapRaw) ?? toNumber(co.marketCap);
    const marketCap = capRaw !== null ? money(capRaw, { compact: true }) : cleanText(co.marketCap);
    const pe = toNumber(co.peRatio);
    const eps = toNumber(co.eps);
    const beta = toNumber(co.beta);
    const dividend = toNumber(co.dividendYield);
    const volume = toNumber(ms.volume);
    const avgVolume = toNumber(ms.avgVolume);
    const dayLow = toNumber(ms.dayLow);
    const dayHigh = toNumber(ms.dayHigh);
    const stats = [
        marketCap && { key: 'cap', label: 'Market cap', value: marketCap },
        pe !== null && { key: 'pe', label: 'P/E ratio (TTM)', value: formatNumber(pe, 2) },
        eps !== null && { key: 'eps', label: 'EPS (TTM)', value: money(eps) },
        beta !== null && { key: 'beta', label: 'Beta', value: formatNumber(beta, 2) },
        dividend !== null && dividend > 0 && { key: 'div', label: 'Dividend yield', value: formatPercent(dividend * 100, { sign: false }) },
        volume !== null && {
            key: 'vol',
            label: 'Volume',
            value: formatCompact(volume),
            sub: avgVolume !== null ? `${formatCompact(avgVolume)} avg` : null
        },
        dayLow !== null && dayHigh !== null && { key: 'day', label: 'Day range', value: `${money(dayLow)} – ${money(dayHigh)}` }
    ].filter(Boolean);
    // Crypto and some funds have few fundamentals: fill in with the session prices.
    const open = toNumber(ms.open);
    const prevClose = toNumber(ms.previousClose);
    if (stats.length < 6) {
        if (open !== null) stats.push({ key: 'open', label: 'Open', value: money(open) });
        if (prevClose !== null) stats.push({ key: 'prev', label: 'Previous close', value: money(prevClose) });
    }

    const low52 = toNumber(ind?.fiftyTwoWeekLow) ?? toNumber(yp.low);
    const high52 = toNumber(ind?.fiftyTwoWeekHigh) ?? toNumber(yp.high);
    const range52 = low52 !== null && high52 !== null && high52 > low52 && price !== null ? { low: low52, high: high52 } : null;

    // Verdict
    const decision = cleanText(rec.decision)?.toUpperCase() || null;
    const allReasons = asList(rec.reasons).filter((r) => typeof r === 'string' && r.trim());
    const summaryReason = allReasons.find((r) => /^total score/i.test(r)) || null;
    const signals = asList(rec.signals)
        .filter((s) => s && typeof s === 'object' && cleanText(s.label))
        .map((s) => ({
            label: s.label,
            value: cleanText(s.value) || EMPTY,
            verdict: ['positive', 'negative', 'neutral'].includes(s.verdict) ? s.verdict : 'neutral',
            points: toNumber(s.points)
        }));
    const verdict = decision ? {
        decision,
        confidence: cleanText(rec.confidence),
        score: toNumber(rec.score),
        reasons: allReasons.filter((r) => r !== summaryReason),
        summary: summaryReason,
        signals
    } : null;

    // Risk
    const riskScore = toNumber(risk.score);
    const riskView = riskScore !== null ? {
        score: riskScore,
        level: cleanText(risk.level),
        factors: asList(risk.factors).filter((f) => typeof f === 'string' && f.trim()),
        adjustments: asList(risk.adjustments).filter((f) => typeof f === 'string' && f.trim())
    } : null;

    // Technicals (new analyses only)
    let technicals = null;
    if (ind) {
        const smas = [['20-day', ind.sma20], ['50-day', ind.sma50], ['200-day', ind.sma200]]
            .map(([label, v]) => {
                const value = toNumber(v);
                if (value === null) return null;
                return { label, value: money(value), diff: price !== null && value ? ((price - value) / value) * 100 : null };
            })
            .filter(Boolean);
        const r = asObject(ind.returns);
        const returns = [['1W', r['1w']], ['1M', r['1m']], ['3M', r['3m']], ['6M', r['6m']], ['1Y', r['1y']]]
            .map(([label, v]) => ({ label, value: toNumber(v) }));
        const rsi = toNumber(ind.rsi14);
        const hasCross = toNumber(ind.sma50) !== null && toNumber(ind.sma200) !== null;
        if (rsi !== null || smas.length || returns.some((x) => x.value !== null)) {
            technicals = { rsi, smas, returns, cross: hasCross ? Boolean(ind.goldenCross) : null };
        }
    }

    // Outlook + investor fit
    const outlook = cleanText(gf.shortTerm) || cleanText(gf.longTerm) ? {
        shortTerm: cleanText(gf.shortTerm),
        longTerm: cleanText(gf.longTerm),
        confidence: cleanText(gf.confidence)
    } : null;
    const fit = asList(a.investmentType)
        .filter((t) => t && typeof t === 'object' && cleanText(t.type))
        .map((t) => ({ type: t.type, suitability: cleanText(t.suitability), reason: cleanText(t.reason) }));

    // News
    const items = asList(a.news)
        .filter((n) => n && typeof n === 'object' && cleanText(n.title))
        .map((n) => ({
            title: n.title.trim(),
            link: typeof n.link === 'string' && SAFE_URL.test(n.link) ? n.link : null,
            summary: cleanText(n.summary),
            publishedAt: n.publishedAt || null,
            publisher: cleanText(n.publisher) || 'Yahoo Finance',
            sentiment: ['positive', 'negative', 'neutral'].includes(n.sentiment) ? n.sentiment : 'neutral'
        }));
    const counts = asObject(ns.counts);
    const countList = ['positive', 'neutral', 'negative'].map((k) => ({ key: k, value: Math.max(0, toNumber(counts[k]) || 0) }));
    const sentiment = cleanText(ns.sentiment)?.toLowerCase() || null;
    const news = sentiment || cleanText(ns.summary) || items.length ? {
        sentiment,
        summary: cleanText(ns.summary),
        note: cleanText(ns.note),
        counts: countList,
        total: countList.reduce((sum, c) => sum + c.value, 0),
        items,
        hasFeed: Array.isArray(a.news)
    } : null;

    // About
    const website = typeof co.website === 'string' && SAFE_URL.test(co.website.trim()) ? co.website.trim() : null;
    const employees = toNumber(co.employees);
    const description = cleanText(co.description);
    const about = description || website || employees || sector || industry ? {
        description, website, employees, sector, industry, exchange
    } : null;

    const oneYear = toNumber(ind?.returns?.['1y']) ?? toNumber(yp.percentChange);

    return {
        symbol,
        name: cleanText(co.name),
        currency,
        typeLabel: quoteType ? TYPE_LABELS[quoteType] || null : null,
        isCrypto,
        price,
        change: toNumber(ms.change),
        changePct: toNumber(ms.changePercentRaw) ?? toNumber(ms.changePercent),
        trend: TRENDS[String(ms.trend || '').toLowerCase()] || null,
        session: sessionOf(ms.marketState, isCrypto),
        asOf: asOfLabel(ms.lastUpdated),
        meta: [exchange, sector, currency].filter(Boolean).join(' · '),
        history,
        stats,
        range52,
        verdict,
        risk: riskView,
        technicals,
        outlook,
        fit,
        news,
        about,
        oneYear,
        timestamp: a.timestamp || ms.lastUpdated || null,
        dataSource: cleanText(a.dataSource) || 'Yahoo Finance'
    };
}

/* ---------------------------------------------------------------------------
   Hero
   --------------------------------------------------------------------------- */

function WatchlistButton({ status, inWatchlist, onAdd, onOpen }) {
    if (inWatchlist || status === 'added') {
        return (
            <Button variant="secondary" icon={Check} onClick={onOpen} title="Open your watchlist" data-testid="watchlist-add" className="sa-watch-btn is-added">
                In watchlist
            </Button>
        );
    }
    if (status === 'adding') {
        return (
            <Button icon={Star} loading data-testid="watchlist-add" className="sa-watch-btn">
                Adding…
            </Button>
        );
    }
    if (status === 'error') {
        return (
            <Button icon={RotateCcw} onClick={onAdd} data-testid="watchlist-add" className="sa-watch-btn" title="Adding failed. Try again">
                Retry
            </Button>
        );
    }
    return (
        <Button icon={Star} onClick={onAdd} data-testid="watchlist-add" className="sa-watch-btn">
            Add to watchlist
        </Button>
    );
}

function Hero({ view, variant, onClose, watchButton }) {
    const navigate = useNavigate();
    const { symbol, currency, change } = view;
    const changeTone = change === null || change === 0 ? '' : change > 0 ? 'gain' : 'loss';
    const TrendIcon = view.trend?.icon;

    return (
        <Card className="sa-card sa-hero fade-up" style={{ '--i': 0, '--sa-tint': symbolColor(symbol) }}>
            <div className="sa-hero-top">
                <div className="sa-identity">
                    <SymbolAvatar symbol={symbol} size={48} />
                    <div className="sa-identity-text">
                        <div className="sa-title-row">
                            <h2 className="sa-symbol mono">{symbol || EMPTY}</h2>
                            {view.typeLabel && <Badge size="sm">{view.typeLabel}</Badge>}
                            {view.trend && (
                                <Badge size="sm" tone={view.trend.tone} icon={TrendIcon}>{view.trend.label}</Badge>
                            )}
                        </div>
                        {view.name && <p className="sa-name">{view.name}</p>}
                        {view.meta && <p className="sa-meta">{view.meta}</p>}
                    </div>
                </div>
                {variant === 'inline' && onClose && (
                    <IconButton icon={X} label="Close report" size="sm" className="sa-close" onClick={onClose} data-testid="sa-close" />
                )}
            </div>

            <div className="sa-hero-bottom">
                <div className="sa-quote">
                    <FlashValue value={view.price} className="sa-price-flash">
                        <span className="sa-price num" data-testid="sa-price">
                            <AnimatedNumber value={view.price} format={(v) => formatCurrency(v, currency)} />
                        </span>
                    </FlashValue>
                    <div className="sa-quote-line">
                        <ChangePill value={view.changePct} size="lg" />
                        {change !== null && (
                            <span className={cx('sa-quote-abs num', changeTone)}>{signedCurrency(change, currency)}</span>
                        )}
                        <span className="sa-quote-period">today</span>
                    </div>
                    {(view.session || view.asOf) && (
                        <p className="sa-session">
                            {view.session && <StatusDot tone={view.session.tone} pulse={view.session.pulse} />}
                            {view.session && <span className="sa-session-label">{view.session.label}</span>}
                            {view.session && view.asOf && <span aria-hidden="true">·</span>}
                            {view.asOf && <span className="num">{view.asOf}</span>}
                        </p>
                    )}
                </div>

                <div className="sa-actions">
                    {watchButton}
                    <Button
                        variant="secondary"
                        icon={Scale}
                        onClick={() => navigate(`/insights?s1=${encodeURIComponent(symbol)}`)}
                        data-testid="sa-compare"
                        className="sa-action"
                    >
                        Compare
                    </Button>
                    <Button
                        variant={watchButton ? 'secondary' : 'primary'}
                        icon={Plus}
                        onClick={() => navigate(`/portfolio?add=1&symbol=${encodeURIComponent(symbol)}`)}
                        data-testid="sa-trade"
                        className="sa-action"
                    >
                        Add transaction
                    </Button>
                </div>
            </div>
        </Card>
    );
}

/* ---------------------------------------------------------------------------
   Report
   --------------------------------------------------------------------------- */

/** A two-card row; a single present card spans the full width. */
function Row({ layout, children }) {
    const present = (Array.isArray(children) ? children : [children]).filter(Boolean);
    if (!present.length) return null;
    return <div className={cx('sa-row', present.length > 1 && `sa-row--${layout}`)}>{present}</div>;
}

const StockAnalysis = ({ analysis, onClose, onAddToWatchlist, inWatchlist = false, variant = 'inline' }) => {
    const navigate = useNavigate();
    const symbol = analysis && typeof analysis === 'object' ? String(analysis.symbol || '').toUpperCase() : '';
    // Watchlist button state belongs to one symbol; a new symbol starts from idle.
    const [watch, setWatch] = useState({ symbol, status: 'idle' });
    const watchStatus = watch.symbol === symbol ? watch.status : 'idle';

    if (!analysis || typeof analysis !== 'object') return null;

    const view = buildView(analysis);
    const mode = variant === 'modal' ? 'modal' : 'inline';

    const handleAdd = () => {
        if (!onAddToWatchlist) return;
        setWatch({ symbol, status: 'adding' });
        Promise.resolve()
            .then(() => onAddToWatchlist(analysis))
            .then(() => setWatch({ symbol, status: 'added' }))
            .catch(() => setWatch({ symbol, status: 'error' }));
    };

    const watchButton = onAddToWatchlist ? (
        <WatchlistButton
            status={watchStatus}
            inWatchlist={inWatchlist}
            onAdd={handleAdd}
            onOpen={() => navigate('/watchlist')}
        />
    ) : null;

    // Stagger order follows reading order.
    let i = 1;
    const next = () => i++;
    const hasChart = view.history.length >= 2;
    const hasStats = view.stats.length > 0 || Boolean(view.range52);

    return (
        <article
            className={cx('sa-report', `sa-report--${mode}`)}
            data-testid="analysis-report"
            aria-label={`${view.symbol} report`}
        >
            <div className="sa-stack">
                <Hero view={view} variant={mode} onClose={onClose} watchButton={watchButton} />

                <Row layout="wide-left">
                    {hasChart && <ChartCard view={view} index={next()} />}
                    {hasStats && <KeyStatsCard view={view} index={next()} />}
                </Row>

                {view.verdict && <VerdictCard verdict={view.verdict} index={next()} />}

                <Row layout="wide-right">
                    {view.risk && <RiskCard risk={view.risk} index={next()} />}
                    {view.technicals && <TechnicalsCard technicals={view.technicals} index={next()} />}
                </Row>

                <Row layout="even">
                    {view.outlook && <OutlookCard outlook={view.outlook} index={next()} />}
                    {view.fit.length > 0 && <InvestorFitCard fit={view.fit} index={next()} />}
                </Row>

                <Row layout="wide-left">
                    {view.news && <NewsCard news={view.news} symbol={view.symbol} index={next()} />}
                    {view.about && <AboutCard about={view.about} index={next()} />}
                </Row>

                <ReportFooter source={view.dataSource} timestamp={view.timestamp} index={next()} />
            </div>
        </article>
    );
};

StockAnalysis.propTypes = {
    analysis: PropTypes.object,
    onClose: PropTypes.func,
    onAddToWatchlist: PropTypes.func,
    inWatchlist: PropTypes.bool,
    variant: PropTypes.oneOf(['inline', 'modal'])
};

export default StockAnalysis;
