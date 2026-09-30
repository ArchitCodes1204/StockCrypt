import { useEffect, useState } from 'react';
import { ChartLine, Moon, ShieldCheck, Sun, Wallet } from 'lucide-react';
import stockApi from '../services/stockApi';
import { useTheme } from '../hooks';
import { ChangePill, IconButton, Logo, Sparkline, StatusDot, SymbolAvatar, cx } from './ui';
import { formatCurrency, toNumber } from '../utils/format';
import './Auth.css';

const POINTS = [
    { icon: ChartLine, title: 'Real market data', text: 'Live quotes and a year of daily prices from Yahoo Finance.' },
    { icon: ShieldCheck, title: 'Signals that show their work', text: 'Rule-based BUY / HOLD / SELL calls with the numbers behind each reason.' },
    { icon: Wallet, title: 'Portfolio and watchlist', text: 'Log trades, follow your profit and loss, and watch what is next.' }
];

// Preferred tickers for the snapshot, in order; the first three that load are shown.
const PREFERRED = ['AAPL', 'NVDA', 'BTC-USD', 'MSFT', 'ETH-USD', 'GOOGL'];

/* Decorative chart for the brand panel: a deterministic upward random walk,
   smoothed into a cubic path (computed once, no data implied). */
const CHART_W = 520;
const CHART_H = 164;
const CHART_END_X = CHART_W - 44; // room for the end marker
const CHART = (() => {
    let seed = 7;
    const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    };
    const n = 42;
    const values = [];
    let v = 40;
    for (let i = 0; i < n; i += 1) {
        v += (rand() - 0.4) * 9 + Math.sin(i / 4) * 1.6;
        values.push(v);
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pts = values.map((val, i) => [
        (i / (n - 1)) * CHART_END_X,
        CHART_H - 20 - ((val - min) / (max - min)) * (CHART_H - 50)
    ]);
    let line = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i += 1) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || p2;
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        line += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    const end = pts[pts.length - 1];
    const area = `${line} L${end[0].toFixed(1)} ${CHART_H} L0 ${CHART_H} Z`;
    // A slower "average" line under the price.
    const avg = pts.map((p, i) => {
        const from = Math.max(0, i - 6);
        const slice = pts.slice(from, i + 1);
        return [p[0], slice.reduce((s, q) => s + q[1], 0) / slice.length + 6];
    });
    const avgLine = avg.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    return { line, area, avgLine, end };
})();

function BrandChart() {
    const [x, y] = CHART.end;
    return (
        <div className="auth-chart" aria-hidden="true">
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="auth-chart-svg" focusable="false">
                <defs>
                    <linearGradient id="auth-chart-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" className="auth-chart-stop-top" />
                        <stop offset="100%" className="auth-chart-stop-bottom" />
                    </linearGradient>
                </defs>
                {[0.2, 0.45, 0.7].map((f) => (
                    <line key={f} x1="0" x2={CHART_W} y1={CHART_H * f} y2={CHART_H * f} className="auth-chart-grid" />
                ))}
                <path d={CHART.area} className="auth-chart-area" fill="url(#auth-chart-fill)" />
                <path d={CHART.avgLine} className="auth-chart-avg" pathLength="1" />
                <path d={CHART.line} className="auth-chart-line" pathLength="1" />
                <line x1={x} x2={x} y1={y} y2={CHART_H} className="auth-chart-marker" />
                <circle cx={x} cy={y} r="11" className="auth-chart-ring" />
                <circle cx={x} cy={y} r="5" className="auth-chart-dot" />
            </svg>
        </div>
    );
}

/** Three small live quotes from the public screener. Renders nothing if both requests fail. */
function TickerCards() {
    const [rows, setRows] = useState(null);

    useEffect(() => {
        let cancelled = false;
        Promise.allSettled([stockApi.getScreenerStocks('stocks'), stockApi.getScreenerStocks('crypto')])
            .then((results) => {
                if (cancelled) return;
                const all = results
                    .filter((r) => r.status === 'fulfilled' && Array.isArray(r.value))
                    .flatMap((r) => r.value)
                    // Never show generated sample rows here: real numbers or nothing.
                    .filter((row) => row && !row.isSample && toNumber(row.price) !== null);
                const bySymbol = new Map(all.map((row) => [row.symbol, row]));
                const picked = PREFERRED.map((s) => bySymbol.get(s)).filter(Boolean).slice(0, 3);
                setRows(picked.length ? picked : all.slice(0, 3));
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (!rows || rows.length === 0) return null;

    return (
        <div className="auth-tickers">
            <p className="auth-tickers-label">
                <StatusDot tone="gain" pulse />
                Market snapshot
            </p>
            <ul className="auth-ticker-list">
                {rows.map((row, i) => (
                    <li key={row.symbol} className="auth-ticker fade-up" style={{ '--i': i + 4 }}>
                        <div className="auth-ticker-top">
                            <SymbolAvatar symbol={row.symbol} size={26} />
                            <span className="auth-ticker-symbol mono">{row.symbol}</span>
                        </div>
                        <span className="auth-ticker-price num">{formatCurrency(row.price, row.currency)}</span>
                        <div className="auth-ticker-foot">
                            <ChangePill value={row.changePercent} size="sm" />
                            <Sparkline data={row.sparkline} width={56} height={20} strokeWidth={1.5} fill={false} color="var(--sc-text-muted)" ariaLabel={`${row.symbol} over the last month`} />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function AuthThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const dark = theme === 'dark';
    const Icon = dark ? Sun : Moon;
    return (
        <IconButton
            label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={toggleTheme}
            className="auth-theme"
            data-testid="auth-theme-toggle"
        >
            <Icon key={theme} size={18} className="auth-theme-icon" aria-hidden="true" />
        </IconButton>
    );
}

/**
 * Split auth layout: brand panel (>= 960px) + form card. Rendered outside the AppShell.
 * <AuthLayout title="Welcome back" subtitle="..." footer={<p>...</p>}>{form}</AuthLayout>
 */
export function AuthLayout({ title, subtitle, children, footer }) {
    return (
        <div className="auth">
            <main className="auth-main">
                <div className="auth-topbar">
                    <Logo size={30} className="auth-mobile-logo" />
                    <AuthThemeToggle />
                </div>
                <div className="auth-card fade-up" style={{ '--i': 1 }}>
                    <header className="auth-card-head">
                        <h1 className="auth-title">{title}</h1>
                        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
                    </header>
                    {children}
                    {footer && <div className="auth-card-foot">{footer}</div>}
                </div>
                <p className="auth-mobile-tagline fade-up" style={{ '--i': 3 }}>
                    <span>Research smarter.</span> Track everything.
                </p>
            </main>

            <aside className="auth-brand" aria-label="About StockCrypt">
                <div className="auth-brand-glow" aria-hidden="true" />
                <Logo size={34} className="auth-brand-logo fade-up" />
                <div className="auth-brand-body">
                    <p className="auth-eyebrow fade-up" style={{ '--i': 1 }}>Stocks and crypto, one workspace</p>
                    <h2 className="auth-headline fade-up" style={{ '--i': 2 }}>
                        Research smarter.
                        <span className="auth-headline-accent">Track everything.</span>
                    </h2>
                    <ul className="auth-points">
                        {POINTS.map((point, i) => {
                            const PointIcon = point.icon;
                            return (
                                <li key={point.title} className="auth-point fade-up" style={{ '--i': i + 3 }}>
                                    <span className="auth-point-icon" aria-hidden="true">
                                        <PointIcon size={17} />
                                    </span>
                                    <span className="auth-point-text">
                                        <strong>{point.title}</strong>
                                        <span>{point.text}</span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                    <TickerCards />
                </div>
                <div className="auth-visual">
                    <BrandChart />
                    <p className="auth-brand-note">Rule-based technical analysis. Not financial advice.</p>
                </div>
            </aside>
        </div>
    );
}

/**
 * Label + icon input (+ optional trailing control) + hint/error, wired for screen readers.
 * `status` = 'ok' shows the hint as satisfied.
 */
export function AuthField({ id, label, icon: Icon, hint, error, status, trailing, className, ...inputProps }) {
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const describedBy = error ? errorId : hint ? hintId : undefined;
    return (
        <div className={cx('ui-field', 'auth-field', error && 'has-error', className)}>
            <label className="ui-field-label" htmlFor={id}>{label}</label>
            <div className={cx('ui-input-group', 'auth-input-group', trailing && 'has-trailing')}>
                {Icon && <Icon size={17} className="ui-input-icon auth-input-icon" aria-hidden="true" />}
                <input
                    id={id}
                    className={cx('ui-input', 'ui-input--lg', 'auth-input', error && 'is-invalid')}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    {...inputProps}
                />
                {trailing && <span className="auth-input-trailing">{trailing}</span>}
            </div>
            {error ? (
                <p id={errorId} className="auth-field-msg auth-field-msg--error">{error}</p>
            ) : hint ? (
                <p id={hintId} className={cx('auth-field-msg', status === 'ok' && 'is-ok')}>{hint}</p>
            ) : null}
        </div>
    );
}

export default AuthLayout;
