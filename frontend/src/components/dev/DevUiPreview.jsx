import { useMemo, useRef, useState } from 'react';
import {
    Activity,
    Bell,
    Bitcoin,
    Briefcase,
    CandlestickChart,
    DollarSign,
    Layers,
    LineChart,
    Plus,
    RefreshCw,
    Search,
    Sparkles,
    Star,
    Trash2,
    TrendingUp,
    Wallet
} from 'lucide-react';
import { useConfirm } from '../../hooks/useConfirm';
import { useInterval } from '../../hooks/useInterval';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../hooks/useToast';
import { formatCompact, formatCurrency, formatDate, formatNumber, formatPercent, marketStatus, timeAgo } from '../../utils/format';
import {
    AnimatedNumber,
    Badge,
    Button,
    Card,
    CardHeader,
    ChangePill,
    EmptyState,
    ErrorState,
    Field,
    FlashValue,
    Gauge,
    IconButton,
    Kbd,
    Logo,
    LogoMark,
    Marquee,
    Modal,
    PageHeader,
    Pagination,
    PriceChart,
    RangeBar,
    RecommendationBadge,
    SegmentedControl,
    Skeleton,
    SkeletonText,
    SortHeader,
    Sparkline,
    Spinner,
    StatCard,
    StatusDot,
    SymbolAvatar,
    SymbolSearch
} from '../ui';
import './DevUiPreview.css';

/* Deterministic sample data (seeded PRNG, generated once at module load). */
function mulberry32(seed) {
    let a = seed;
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function walk(seed, count, start, drift, vol) {
    const rand = mulberry32(seed);
    const out = [start];
    for (let i = 1; i < count; i += 1) {
        const shock = (rand() - 0.5) * 2 * vol;
        out.push(Math.max(0.01, out[i - 1] * (1 + drift + shock)));
    }
    return out.map((v) => Math.round(v * 100) / 100);
}

function dailySeries(seed, days, start, drift, vol) {
    const values = walk(seed, days, start, drift, vol);
    const end = new Date(2026, 8, 28);
    return values.map((value, i) => {
        const d = new Date(end);
        d.setDate(end.getDate() - (days - 1 - i));
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { date: iso, value };
    });
}

// Makes a series end up (or down) so sample colors agree with the sample change.
function trending(values, up) {
    const rising = values[values.length - 1] >= values[0];
    return rising === up ? values : [...values].reverse();
}

const YEAR = dailySeries(7, 365, 15200, 0.0009, 0.012);
const RANGES = { '1m': 30, '3m': 91, '6m': 182, '1y': 365 };
const INVESTED = 16850;
const FALLING = (() => {
    const series = dailySeries(33, 45, 64000, -0.003, 0.025);
    const values = trending(series.map((p) => p.value), false);
    return series.map((p, i) => ({ date: p.date, value: values[i] }));
})();

const HOLDINGS = [
    ['AAPL', 'Apple Inc.', 10, 188.2, 227.52, 1.24, 11],
    ['MSFT', 'Microsoft Corporation', 8, 402.5, 509.22, -1.35, 12],
    ['NVDA', 'NVIDIA Corporation', 25, 118.4, 181.9, 2.81, 13],
    ['BTC-USD', 'Bitcoin USD', 0.05, 61250, 84434.69, -0.62, 14],
    ['TSLA', 'Tesla, Inc.', 6, 357.45, 344.1, -2.14, 15],
    ['GOOGL', 'Alphabet Inc.', 12, 151.1, 244.6, 0.48, 16],
    ['AMZN', 'Amazon.com, Inc.', 9, 172.9, 219.3, 0.93, 17],
    ['META', 'Meta Platforms, Inc.', 4, 488.2, 742.8, -0.31, 18],
    ['ETH-USD', 'Ethereum USD', 1.2, 2410, 4105.2, 3.42, 19],
    ['AMD', 'Advanced Micro Devices', 14, 142.3, 161.7, 1.77, 20],
    ['BRK-B', 'Berkshire Hathaway Inc.', 3, 410.2, 478.9, 0.12, 22],
    ['JPM', 'JPMorgan Chase & Co.', 7, 198.4, 301.2, -0.84, 23]
].map(([symbol, name, shares, avg, price, change, seed]) => {
    const spark = trending(walk(seed, 22, price * (1 - change / 40), change / 900, 0.018), change >= 0);
    return { symbol, name, shares, avg, price, change, value: shares * price, pl: (price - avg) * shares, spark };
});

const TAPE = HOLDINGS.slice(0, 9);
const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60000);
const SWATCHES = [
    ['--sc-bg', 'Page'], ['--sc-surface-1', 'Surface 1'], ['--sc-surface-2', 'Surface 2'], ['--sc-surface-3', 'Surface 3'],
    ['--sc-surface-4', 'Surface 4'], ['--sc-text', 'Text'], ['--sc-text-muted', 'Muted'], ['--sc-text-faint', 'Faint'],
    ['--sc-accent', 'Accent'], ['--sc-accent-text', 'Accent text'], ['--sc-gain', 'Gain'], ['--sc-loss', 'Loss'],
    ['--sc-warn', 'Warn'], ['--sc-info', 'Info']
];
const TYPE_SCALE = [
    ['--sc-fs-4xl', '38', 'Portfolio value'], ['--sc-fs-3xl', '30', 'Page title'], ['--sc-fs-2xl', '24', 'Stat value'],
    ['--sc-fs-xl', '20', 'Section heading'], ['--sc-fs-lg', '17', 'Card title large'], ['--sc-fs-md', '15', 'Card title'],
    ['--sc-fs-base', '14', 'Body text (default)'], ['--sc-fs-sm', '13', 'Table cells, secondary'], ['--sc-fs-xs', '12', 'Captions, badges']
];
const SECTIONS = [
    ['foundations', 'Foundations'], ['buttons', 'Buttons'], ['badges', 'Badges'], ['stats', 'Stat cards'],
    ['states', 'Loading & empty'], ['controls', 'Controls'], ['charts', 'Charts'], ['meters', 'Meters'],
    ['search', 'Search'], ['table', 'Table'], ['forms', 'Forms'], ['overlays', 'Overlays'], ['motion', 'Motion'], ['brand', 'Brand']
];

function Section({ id, title, description, children, className }) {
    return (
        <section id={id} className={['dev-section', className].filter(Boolean).join(' ')} aria-labelledby={`${id}-title`}>
            <div className="dev-section-head">
                <h2 id={`${id}-title`} className="dev-section-title">{title}</h2>
                {description && <p className="dev-section-desc">{description}</p>}
            </div>
            {children}
        </section>
    );
}

function Row({ label, children }) {
    return (
        <div className="dev-row">
            {label && <span className="dev-row-label">{label}</span>}
            <div className="dev-row-items">{children}</div>
        </div>
    );
}

const PAGE_SIZE = 5;

export default function DevUiPreview() {
    const toast = useToast();
    const confirm = useConfirm();
    const { theme, setTheme } = useTheme();

    const [range, setRange] = useState('1y');
    const [market, setMarket] = useState('stocks');
    const [density, setDensity] = useState('comfortable');
    const [sort, setSort] = useState({ key: 'value', dir: 'desc' });
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [tallOpen, setTallOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [txType, setTxType] = useState('BUY');
    const [txSymbol, setTxSymbol] = useState('');
    const [confirmResult, setConfirmResult] = useState('Nothing asked yet');
    const [picked, setPicked] = useState(null);
    const [replay, setReplay] = useState(0);
    const [counter, setCounter] = useState(19545.69);
    const [live, setLive] = useState({ price: 227.52, change: 1.24 });
    const [qty, setQty] = useState('');
    const qtyError = qty !== '' && !(Number(qty) > 0) ? 'Enter a quantity greater than 0' : '';
    const saveTimer = useRef(0);

    useInterval(() => {
        setLive((prev) => {
            const step = (((Date.now() / 1000) % 7) - 3.2) * 0.08;
            const price = Math.max(1, Math.round((prev.price + step) * 100) / 100);
            return { price, change: Math.round((prev.change + step / 3) * 100) / 100 };
        });
    }, 2200);

    const chartData = useMemo(() => YEAR.slice(-RANGES[range]), [range]);

    const sorted = useMemo(() => {
        const list = [...HOLDINGS];
        const dir = sort.dir === 'asc' ? 1 : -1;
        list.sort((a, b) => (sort.key === 'symbol' ? a.symbol.localeCompare(b.symbol) : a[sort.key] - b[sort.key]) * dir);
        return list;
    }, [sort]);
    const pages = Math.ceil(sorted.length / PAGE_SIZE);
    const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const toggleSort = (key) => {
        setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
        setPage(1);
    };

    const save = () => {
        setSaving(true);
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            setSaving(false);
            setModalOpen(false);
            toast.success(`${txType === 'BUY' ? 'Bought' : 'Sold'} ${qty || 1} ${txSymbol || 'AAPL'}`, { title: 'Transaction saved' });
        }, 1100);
    };

    const ask = async (tone) => {
        const ok = await confirm(tone === 'danger'
            ? { title: 'Remove NVDA from your portfolio?', message: 'This deletes all 3 NVDA transactions. You cannot undo this.', confirmLabel: 'Remove holding' }
            : { title: 'Refresh every watchlist item?', message: 'This re-runs the analysis for 5 symbols and may take a few seconds.', confirmLabel: 'Refresh all', tone: 'primary' });
        setConfirmResult(ok ? 'Confirmed' : 'Cancelled');
    };

    const status = marketStatus();

    return (
        <div className="dev-page" data-testid="dev-ui">
            <PageHeader
                eyebrow="Design system"
                title="UI kit"
                subtitle="Every StockCrypt primitive and state in one place. Tokens, components and motion shown here are what the pages are built from."
                actions={(
                    <>
                        <Button variant="secondary" icon={RefreshCw} onClick={() => setReplay((r) => r + 1)} data-testid="dev-replay">
                            Replay animations
                        </Button>
                        <Button icon={Plus} onClick={() => setModalOpen(true)}>New transaction</Button>
                    </>
                )}
            />

            <nav className="dev-toc" aria-label="Sections">
                {SECTIONS.map(([id, label]) => (
                    <a key={id} href={`#${id}`} className="dev-toc-link">{label}</a>
                ))}
            </nav>

            <div key={replay} className="dev-stack">
                {/* Foundations */}
                <Section id="foundations" title="Foundations" description={<>Tokens for the {theme} theme. Colors only ever come from <code>--sc-*</code> variables.</>}>
                    <div className="dev-grid dev-grid--2">
                        <Card>
                            <CardHeader title="Color tokens" subtitle="Surfaces are separated by hairlines, never by heavy fills" icon={Layers}
                                action={(
                                    <SegmentedControl
                                        size="sm"
                                        value={theme}
                                        onChange={setTheme}
                                        options={[{ label: 'Dark', value: 'dark' }, { label: 'Light', value: 'light' }]}
                                        aria-label="Theme"
                                        testId="dev-theme"
                                    />
                                )}
                            />
                            <div className="dev-swatches">
                                {SWATCHES.map(([token, label]) => (
                                    <div key={token} className="dev-swatch">
                                        <span className="dev-swatch-chip" style={{ background: `var(${token})` }} />
                                        <span className="dev-swatch-name">{label}</span>
                                        <code className="dev-swatch-token">{token}</code>
                                    </div>
                                ))}
                            </div>
                            <div className="dev-chart-palette" aria-label="Chart palette">
                                {Array.from({ length: 8 }, (_, i) => (
                                    <span key={i} className="dev-chart-chip" style={{ background: `var(--sc-chart-${i + 1})` }}>
                                        <span>{i + 1}</span>
                                    </span>
                                ))}
                            </div>
                        </Card>
                        <Card>
                            <CardHeader title="Type scale" subtitle="Manrope for UI, JetBrains Mono for tickers" icon={Sparkles} />
                            <div className="dev-type">
                                {TYPE_SCALE.map(([token, px, sample]) => (
                                    <div key={token} className="dev-type-row">
                                        <span className="dev-type-sample" style={{ fontSize: `var(${token})` }}>{sample}</span>
                                        <code className="dev-type-token">{px}px</code>
                                    </div>
                                ))}
                                <div className="dev-type-row">
                                    <span className="mono num dev-type-mono">AAPL 227.52 &middot; BTC-USD 84,434.69</span>
                                    <code className="dev-type-token">mono</code>
                                </div>
                            </div>
                        </Card>
                    </div>
                </Section>

                {/* Buttons */}
                <Section id="buttons" title="Buttons" description="Primary is the only gold fill on a screen; use it once per view.">
                    <Card>
                        <Row label="Variants">
                            <Button>Primary</Button>
                            <Button variant="secondary">Secondary</Button>
                            <Button variant="ghost">Ghost</Button>
                            <Button variant="danger" icon={Trash2}>Delete</Button>
                        </Row>
                        <Row label="Sizes">
                            <Button size="sm" icon={Plus}>Small</Button>
                            <Button size="md" icon={Plus}>Medium</Button>
                            <Button size="lg" icon={Plus}>Large</Button>
                            <Button variant="secondary" iconRight={TrendingUp}>Icon right</Button>
                        </Row>
                        <Row label="States">
                            <Button loading>Saving</Button>
                            <Button variant="secondary" icon={RefreshCw} loading>Refreshing</Button>
                            <Button disabled>Disabled</Button>
                            <Button variant="secondary" disabled>Disabled</Button>
                        </Row>
                        <Row label="Icon only">
                            <IconButton icon={RefreshCw} label="Refresh" />
                            <IconButton icon={Star} label="Add to watchlist" variant="secondary" />
                            <IconButton icon={Bell} label="Alerts" variant="secondary" size="sm" />
                            <IconButton icon={Plus} label="Add" variant="primary" />
                            <IconButton icon={Trash2} label="Delete" variant="danger" />
                            <IconButton icon={Search} label="Search" size="lg" />
                        </Row>
                        <Row label="Full width">
                            <div className="dev-narrow">
                                <Button fullWidth size="lg">Sign in</Button>
                            </div>
                        </Row>
                    </Card>
                </Section>

                {/* Badges */}
                <Section id="badges" title="Badges, pills and status" description="Status color always comes with a label, sign or arrow, never color alone.">
                    <Card>
                        <Row label="Tones">
                            <Badge tone="gain" dot>Bullish</Badge>
                            <Badge tone="loss" dot>Bearish</Badge>
                            <Badge tone="warn" dot>Sideways</Badge>
                            <Badge tone="info">Info</Badge>
                            <Badge tone="accent" icon={Sparkles}>Top pick</Badge>
                            <Badge>Neutral</Badge>
                            <Badge size="sm" tone="info">Small</Badge>
                            <Badge size="lg" tone="accent">Large</Badge>
                        </Row>
                        <Row label="Recommendation">
                            <RecommendationBadge decision="BUY" />
                            <RecommendationBadge decision="HOLD" />
                            <RecommendationBadge decision="SELL" />
                            <RecommendationBadge decision="" />
                            <RecommendationBadge decision="BUY" size="lg" />
                        </Row>
                        <Row label="Change pill">
                            <ChangePill value={2.34} />
                            <ChangePill value="-1.35%" />
                            <ChangePill value={0} />
                            <ChangePill value={null} />
                            <ChangePill value={12.5} size="lg" />
                            <ChangePill value={-0.42} size="sm" />
                            <ChangePill value={3.1} showArrow={false} />
                        </Row>
                        <Row label="Status dot">
                            <span className="dev-inline"><StatusDot tone="gain" pulse /> Live</span>
                            <span className="dev-inline"><StatusDot tone="warn" pulse /> Pre-market</span>
                            <span className="dev-inline"><StatusDot /> Closed</span>
                            <span className="dev-inline"><StatusDot tone="loss" /> Error</span>
                            <span className="dev-inline muted">{status.label} ({status.detail})</span>
                        </Row>
                        <Row label="Keys">
                            <span className="dev-inline muted">Press <Kbd>/</Kbd> to search, <Kbd>Esc</Kbd> to close</span>
                        </Row>
                    </Card>
                </Section>

                {/* Stat cards */}
                <Section id="stats" title="Stat cards" description="Values count up from their previous value; loading uses skeletons.">
                    <div className="dev-grid dev-grid--4 stagger">
                        <StatCard label="Portfolio value" value={counter} format={(v) => formatCurrency(v)} change={3.21} hint="vs. cost basis" icon={Wallet} testId="dev-stat-value" />
                        <StatCard label="Today" value={-184.2} format={(v) => formatCurrency(v)} change={-0.94} hint="since yesterday's close" icon={Activity} />
                        <StatCard label="Holdings" value={5} icon={Briefcase} hint="3 stocks, 2 crypto" />
                        <StatCard label="Loading state" loading icon={DollarSign} />
                    </div>
                    <div className="dev-actions">
                        <Button variant="secondary" size="sm" onClick={() => setCounter((c) => Math.round((c * (0.9 + ((c * 7) % 13) / 60)) * 100) / 100)}>
                            Change value
                        </Button>
                        <span className="muted dev-small">
                            <AnimatedNumber value={counter} format={(v) => formatCurrency(v)} /> in a sentence
                        </span>
                    </div>
                </Section>

                {/* Loading & empty */}
                <Section id="states" title="Loading, empty and error states">
                    <div className="dev-grid dev-grid--3">
                        <Card>
                            <CardHeader title="Skeleton" subtitle="Match the shape of the real content" />
                            <div className="dev-skeleton-row">
                                <Skeleton width={36} height={36} radius={10} />
                                <div className="dev-skeleton-lines">
                                    <Skeleton width="45%" height={12} />
                                    <Skeleton width="70%" height={10} />
                                </div>
                                <Skeleton width={64} height={20} radius={999} />
                            </div>
                            <SkeletonText lines={3} style={{ marginTop: 20 }} />
                            <Skeleton height={120} radius={12} style={{ marginTop: 20 }} />
                        </Card>
                        <Card padded={false}>
                            <EmptyState
                                icon={Star}
                                title="Your watchlist is empty"
                                description="Search for a symbol and add it to keep an eye on price, trend and the latest recommendation."
                                action={<Button size="sm" icon={Plus}>Add a symbol</Button>}
                            />
                        </Card>
                        <Card padded={false}>
                            <ErrorState
                                title="Couldn't load prices"
                                message="Yahoo Finance did not respond. Check your connection and try again."
                                onRetry={() => toast.info('Retrying...')}
                            />
                        </Card>
                    </div>
                </Section>

                {/* Controls */}
                <Section id="controls" title="Segmented control" description="The indicator slides to the selected option; arrow keys work.">
                    <Card>
                        <Row label="Range">
                            <SegmentedControl
                                options={[{ label: '1M', value: '1m' }, { label: '3M', value: '3m' }, { label: '6M', value: '6m' }, { label: '1Y', value: '1y' }]}
                                value={range}
                                onChange={setRange}
                                aria-label="Chart range"
                                testId="dev-range"
                            />
                        </Row>
                        <Row label="With icons">
                            <SegmentedControl
                                options={[{ label: 'Stocks', value: 'stocks', icon: CandlestickChart }, { label: 'Crypto', value: 'crypto', icon: Bitcoin }]}
                                value={market}
                                onChange={setMarket}
                                aria-label="Market"
                            />
                            <SegmentedControl
                                size="sm"
                                options={[{ label: 'Comfortable', value: 'comfortable' }, { label: 'Compact', value: 'compact' }]}
                                value={density}
                                onChange={setDensity}
                                aria-label="Density"
                            />
                        </Row>
                        <Row label="Full width">
                            <div className="dev-narrow">
                                <SegmentedControl
                                    fullWidth
                                    size="lg"
                                    options={[{ label: 'Buy', value: 'BUY' }, { label: 'Sell', value: 'SELL' }]}
                                    value={txType}
                                    onChange={setTxType}
                                    aria-label="Transaction type"
                                />
                            </div>
                        </Row>
                    </Card>
                </Section>

                {/* Charts */}
                <Section id="charts" title="Charts" description="Area chart with crosshair tooltip; sparklines draw in on mount.">
                    <Card>
                        <CardHeader
                            title="Portfolio value"
                            subtitle={`${formatDate(chartData[0].date)} to ${formatDate(chartData[chartData.length - 1].date)}`}
                            icon={LineChart}
                            action={(
                                <SegmentedControl
                                    size="sm"
                                    options={[{ label: '1M', value: '1m' }, { label: '3M', value: '3m' }, { label: '6M', value: '6m' }, { label: '1Y', value: '1y' }]}
                                    value={range}
                                    onChange={setRange}
                                    aria-label="Chart range"
                                />
                            )}
                        />
                        <div className="dev-chart-figure">
                            <span className="dev-chart-value">{formatCurrency(chartData[chartData.length - 1].value)}</span>
                            <ChangePill value={((chartData[chartData.length - 1].value - chartData[0].value) / chartData[0].value) * 100} />
                        </div>
                        <PriceChart key={range} data={chartData} color="accent" referenceValue={INVESTED} referenceLabel="Invested" height={300} />
                    </Card>
                    <div className="dev-grid dev-grid--2">
                        <Card>
                            <CardHeader title="Auto color (loss)" subtitle="No axes, compact" icon={Bitcoin} />
                            <PriceChart data={FALLING} height={228} showYAxis={false} showGrid={false} />
                        </Card>
                        <Card>
                            <CardHeader title="Sparklines" subtitle="Gain when last >= first" icon={TrendingUp} />
                            <ul className="dev-spark-list">
                                {HOLDINGS.slice(0, 5).map((h) => (
                                    <li key={h.symbol} className="dev-spark-row">
                                        <SymbolAvatar symbol={h.symbol} size={32} />
                                        <span className="dev-spark-name">
                                            <span className="mono dev-strong">{h.symbol}</span>
                                            <span className="muted truncate">{h.name}</span>
                                        </span>
                                        <Sparkline data={h.spark} width={88} height={30} />
                                        <span className="dev-spark-price num">{formatCurrency(h.price)}</span>
                                        <ChangePill value={h.change} size="sm" />
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    </div>
                    <PriceChart data={[{ date: '2026-09-28', value: 10 }]} height={90} />
                </Section>

                {/* Meters */}
                <Section id="meters" title="Gauges and range">
                    <div className="dev-grid dev-grid--4">
                        <Card className="dev-center">
                            <Gauge value={3} min={1} max={10} label="Risk score" sublabel="Low risk" showMax
                                zones={[{ to: 3.5, tone: 'gain' }, { to: 6.5, tone: 'warn' }, { to: 10, tone: 'loss' }]} />
                        </Card>
                        <Card className="dev-center">
                            <Gauge value={8} min={1} max={10} label="Risk score" sublabel="High risk" showMax
                                zones={[{ to: 3.5, tone: 'gain' }, { to: 6.5, tone: 'warn' }, { to: 10, tone: 'loss' }]} />
                        </Card>
                        <Card className="dev-center">
                            <Gauge value={72.4} label="RSI (14)" sublabel="Overbought"
                                zones={[{ to: 30, tone: 'gain' }, { to: 70, tone: 'info' }, { to: 100, tone: 'loss' }]} />
                        </Card>
                        <Card className="dev-center">
                            <Gauge value={null} label="RSI (14)" sublabel="Not enough history" />
                        </Card>
                    </div>
                    <div className="dev-grid dev-grid--2">
                        <Card>
                            <CardHeader title="52-week range" subtitle="MSFT" />
                            <RangeBar low={402.1} high={553.72} value={509.22} />
                        </Card>
                        <Card>
                            <CardHeader title="Near the edges" subtitle="The value bubble stays inside the card" />
                            <RangeBar low={0.061} high={0.482} value={0.47} formatter={(v) => formatCurrency(v)} lowLabel="Low" highLabel="High" />
                            <div className="dev-gap" />
                            <RangeBar low={100} high={200} value={101} />
                        </Card>
                    </div>
                </Section>

                {/* Search + avatars */}
                <Section id="search" title="Symbol search and avatars" description="Debounced suggestions; Enter searches the typed ticker when nothing is highlighted.">
                    <div className="dev-grid dev-grid--2">
                        <Card>
                            <CardHeader title="Search" subtitle={picked ? `Selected ${picked.symbol}${picked.item?.name ? ` (${picked.item.name})` : ''}` : 'Try "micro", "btc" or "BRK.B"'} icon={Search} />
                            <SymbolSearch size="lg" testId="dev-search" onSelect={(symbol, item) => setPicked({ symbol, item })} />
                            <div className="dev-gap" />
                            <SymbolSearch placeholder="Compact field" clearOnSelect onSelect={(symbol) => toast.info(`Selected ${symbol}`)} />
                        </Card>
                        <Card>
                            <CardHeader title="Symbol avatars" subtitle="Deterministic color per ticker" />
                            <div className="dev-avatars">
                                {['AAPL', 'MSFT', 'NVDA', 'BTC-USD', 'ETH-USD', 'TSLA', 'AMD', 'BRK-B', 'RELIANCE.NS', '^GSPC', 'V', 'SOL-USD'].map((s) => (
                                    <span key={s} className="dev-avatar">
                                        <SymbolAvatar symbol={s} size={40} />
                                        <span className="mono dev-small">{s}</span>
                                    </span>
                                ))}
                            </div>
                            <div className="dev-avatars dev-avatars--sizes">
                                <SymbolAvatar symbol="AAPL" size={24} />
                                <SymbolAvatar symbol="AAPL" size={32} />
                                <SymbolAvatar symbol="AAPL" size={44} />
                                <SymbolAvatar symbol="AAPL" size={56} />
                            </div>
                        </Card>
                    </div>
                </Section>

                {/* Table */}
                <Section id="table" title="Table" description="Sticky header, row hover, right-aligned numbers, sortable headers and pagination.">
                    <div className="ui-table-wrap dev-table-wrap">
                        <table className="ui-table" data-testid="dev-table">
                            <thead>
                                <tr>
                                    <SortHeader label="Symbol" active={sort.key === 'symbol'} direction={sort.dir} onClick={() => toggleSort('symbol')} />
                                    <th scope="col">Trend (1M)</th>
                                    <th scope="col" className="num">Shares</th>
                                    <SortHeader label="Price" align="right" active={sort.key === 'price'} direction={sort.dir} onClick={() => toggleSort('price')} />
                                    <SortHeader label="Today" align="right" active={sort.key === 'change'} direction={sort.dir} onClick={() => toggleSort('change')} />
                                    <SortHeader label="Value" align="right" active={sort.key === 'value'} direction={sort.dir} onClick={() => toggleSort('value')} testId="dev-sort-value" />
                                    <SortHeader label="P/L" align="right" active={sort.key === 'pl'} direction={sort.dir} onClick={() => toggleSort('pl')} />
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.map((h) => (
                                    <tr key={h.symbol} className="is-clickable">
                                        <td>
                                            <span className="dev-cell-symbol">
                                                <SymbolAvatar symbol={h.symbol} size={32} />
                                                <span className="dev-cell-text">
                                                    <span className="mono dev-strong">{h.symbol}</span>
                                                    <span className="muted truncate dev-cell-name">{h.name}</span>
                                                </span>
                                            </span>
                                        </td>
                                        <td><Sparkline data={h.spark} width={80} height={26} animate={false} /></td>
                                        <td className="num">{formatNumber(h.shares)}</td>
                                        <td className="num">{formatCurrency(h.price)}</td>
                                        <td className="num"><ChangePill value={h.change} size="sm" /></td>
                                        <td className="num dev-strong">{formatCurrency(h.value)}</td>
                                        <td className={`num ${h.pl >= 0 ? 'gain' : 'loss'}`}>{h.pl >= 0 ? '+' : ''}{formatCurrency(h.pl)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="dev-table-foot">
                        <span className="muted dev-small num">
                            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
                        </span>
                        <Pagination page={page} pages={pages} onChange={setPage} testId="dev-pagination" />
                    </div>
                    <p className="muted dev-small">
                        Formatting: {formatCompact(3781236359168)} market cap, {formatCurrency(0.1234567)} DOGE, {formatCurrency(2848.1, 'INR')} RELIANCE.NS,{' '}
                        {formatCurrency(512430000, 'USD', { compact: true })} volume, {formatPercent(-1.35)}, {timeAgo(FIVE_MINUTES_AGO)}.
                    </p>
                </Section>

                {/* Forms */}
                <Section id="forms" title="Form fields">
                    <Card>
                        <div className="dev-form-grid">
                            <Field label="Email address" hint="We never share it">
                                <input className="ui-input" type="email" placeholder="you@example.com" />
                            </Field>
                            <Field label="Quantity" required error={qtyError} hint="Fractional shares are fine">
                                <input className="ui-input num" type="number" inputMode="decimal" placeholder="10" value={qty} onChange={(e) => setQty(e.target.value)} />
                            </Field>
                            <Field label="Price per share" htmlFor="dev-price">
                                <div className="ui-input-group">
                                    <DollarSign size={15} className="ui-input-icon" aria-hidden="true" />
                                    <input id="dev-price" className="ui-input num" type="text" inputMode="decimal" defaultValue="227.52" />
                                    <span className="ui-input-suffix">USD</span>
                                </div>
                            </Field>
                            <Field label="Type">
                                <select className="ui-select" defaultValue="BUY">
                                    <option value="BUY">Buy</option>
                                    <option value="SELL">Sell</option>
                                </select>
                            </Field>
                            <Field label="Date">
                                <input className="ui-input" type="date" defaultValue="2026-09-28" />
                            </Field>
                            <Field label="Disabled">
                                <input className="ui-input" disabled value="Read only" readOnly />
                            </Field>
                            <Field label="Notes" optional className="dev-span-2">
                                <textarea className="ui-textarea" placeholder="Why did you make this trade?" />
                            </Field>
                            <Field label="Small input">
                                <input className="ui-input ui-input--sm" placeholder="Small" />
                            </Field>
                            <Field label="Large input">
                                <input className="ui-input ui-input--lg" placeholder="Large" />
                            </Field>
                        </div>
                    </Card>
                </Section>

                {/* Overlays */}
                <Section id="overlays" title="Modal, confirm and toasts">
                    <Card>
                        <Row label="Modal">
                            <Button icon={Plus} onClick={() => setModalOpen(true)} data-testid="dev-open-modal">Open form modal</Button>
                            <Button variant="secondary" onClick={() => setTallOpen(true)} data-testid="dev-open-tall">Open tall modal</Button>
                        </Row>
                        <Row label="Confirm">
                            <Button variant="danger" icon={Trash2} onClick={() => ask('danger')} data-testid="dev-confirm-danger">Remove holding</Button>
                            <Button variant="secondary" icon={RefreshCw} onClick={() => ask('primary')}>Refresh all</Button>
                            <span className="muted dev-small" data-testid="dev-confirm-result">Result: {confirmResult}</span>
                        </Row>
                        <Row label="Toasts">
                            <Button variant="secondary" size="sm" onClick={() => toast.success('Added MSFT to your watchlist')} data-testid="dev-toast-success">Success</Button>
                            <Button variant="secondary" size="sm" onClick={() => toast.error('No data found for symbol "XYZ"')}>Error</Button>
                            <Button variant="secondary" size="sm" onClick={() => toast.info('Prices refreshed a minute ago')}>Info</Button>
                            <Button variant="secondary" size="sm" onClick={() => toast.success('3 holdings updated with the latest prices.', { title: 'Portfolio refreshed' })}>With title</Button>
                        </Row>
                    </Card>
                </Section>

                {/* Motion */}
                <Section id="motion" title="Motion" description="Subtle and fast; all of it switches off under prefers-reduced-motion.">
                    <div className="dev-grid dev-grid--2">
                        <Card>
                            <CardHeader title="Staggered entrance" subtitle={<><code>stagger</code> on a list, or <code>fade-up</code> with <code>--i</code></>} action={<Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => setReplay((r) => r + 1)}>Replay</Button>} />
                            <ul className="dev-stagger stagger">
                                {['Fetch quote', 'Compute indicators', 'Score the signals', 'Write the summary'].map((s, i) => (
                                    <li key={s} className="dev-stagger-item">
                                        <span className="dev-step num">{i + 1}</span>
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        </Card>
                        <Card>
                            <CardHeader title="Live value" subtitle="Background flash when a price updates" />
                            <div className="dev-live">
                                <SymbolAvatar symbol="AAPL" size={40} />
                                <div>
                                    <div className="mono dev-strong">AAPL</div>
                                    <div className="muted dev-small">Apple Inc.</div>
                                </div>
                                <div className="dev-live-price">
                                    <FlashValue value={live.price} className="num dev-live-number">{formatCurrency(live.price)}</FlashValue>
                                    <ChangePill value={live.change} size="sm" />
                                </div>
                            </div>
                            <div className="dev-gap" />
                            <div className="dev-inline muted dev-small"><Spinner size={14} /> Spinner for inline, in-progress actions (not page loads)</div>
                        </Card>
                    </div>
                    <Card padded={false} className="dev-tape">
                        <Marquee duration={36} aria-label="Ticker tape">
                            {TAPE.map((h) => (
                                <span key={h.symbol} className="dev-tape-item">
                                    <span className="mono dev-strong">{h.symbol}</span>
                                    <span className="num">{formatCurrency(h.price)}</span>
                                    <span className={`num ${h.change >= 0 ? 'gain' : 'loss'}`}>{formatPercent(h.change)}</span>
                                </span>
                            ))}
                        </Marquee>
                    </Card>
                    <div className="dev-grid dev-grid--3">
                        {['hover-lift utility', 'Card interactive', 'Press me'].map((label, i) => (
                            i === 1 ? (
                                <Card key={label} as="button" type="button" interactive onClick={() => toast.info('Interactive card pressed')}>
                                    <strong>{label}</strong>
                                    <p className="muted dev-small">Hover lifts, press scales. Rendered as a real button.</p>
                                </Card>
                            ) : (
                                <Card key={label} className="hover-lift">
                                    <strong>{label}</strong>
                                    <p className="muted dev-small">translateY(-2px) and a deeper shadow on hover.</p>
                                </Card>
                            )
                        ))}
                    </div>
                </Section>

                {/* Brand */}
                <Section id="brand" title="Brand">
                    <Card className="dev-brand">
                        <Logo size={40} />
                        <Logo size={28} />
                        <Logo size={28} withWordmark={false} />
                        <LogoMark size={64} />
                        <LogoMark size={16} />
                    </Card>
                </Section>
            </div>

            <Modal
                open={modalOpen}
                onClose={() => !saving && setModalOpen(false)}
                title="New transaction"
                description="Record a buy or sell. Prices are prefilled from the latest quote."
                testId="dev-modal"
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
                        <Button onClick={save} loading={saving} data-testid="dev-modal-save">Save transaction</Button>
                    </>
                )}
            >
                <div className="dev-modal-form">
                    <SegmentedControl
                        fullWidth
                        options={[{ label: 'Buy', value: 'BUY' }, { label: 'Sell', value: 'SELL' }]}
                        value={txType}
                        onChange={setTxType}
                        aria-label="Transaction type"
                    />
                    <Field label="Symbol" htmlFor="dev-tx-symbol">
                        <SymbolSearch id="dev-tx-symbol" value={txSymbol} onChange={setTxSymbol} onSelect={setTxSymbol} placeholder="AAPL, BTC-USD..." />
                    </Field>
                    <div className="dev-form-pair">
                        <Field label="Quantity" error={qtyError}>
                            <input className="ui-input num" type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="10" />
                        </Field>
                        <Field label="Price" hint="Latest: $227.52">
                            <input className="ui-input num" type="text" defaultValue="227.52" />
                        </Field>
                    </div>
                    <Field label="Date">
                        <input className="ui-input" type="date" defaultValue="2026-09-28" />
                    </Field>
                </div>
            </Modal>

            <Modal open={tallOpen} onClose={() => setTallOpen(false)} title="Analysis details" description="A long body scrolls inside the dialog; the header stays put." size="lg" testId="dev-tall-modal"
                footer={<Button onClick={() => setTallOpen(false)}>Done</Button>}>
                {Array.from({ length: 14 }, (_, i) => (
                    <p key={i} className="dev-para">
                        {i + 1}. The price is {i % 2 ? 'above' : 'below'} its 50-day average and the 14-day RSI sits at {40 + i * 2}.
                        Signals are combined with a transparent points system; nothing here is financial advice.
                    </p>
                ))}
            </Modal>
        </div>
    );
}
