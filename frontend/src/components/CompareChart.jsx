import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { formatCurrency, formatDate, formatNumber, formatPercent } from '../utils/format';
import { Card, CardHeader, ChangePill, SegmentedControl, cx } from './ui';
import { RANGES, SIDE_COLORS, alignSeries, monthStarts, niceTicks } from './CompareModel';

const MARGIN = { top: 14, right: 0, bottom: 0, left: 4 };
const X_AXIS_H = 28;
const Y_AXIS_W = 60;
const TAG_H = 22;

function ChartTooltip({ active, payload, symbols, currencies }) {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload;
    if (!point) return null;
    const rows = [
        { symbol: symbols[0], value: point.ia, price: point.priceA, closed: point.closedA, color: SIDE_COLORS[0], currency: currencies[0] },
        { symbol: symbols[1], value: point.ib, price: point.priceB, closed: point.closedB, color: SIDE_COLORS[1], currency: currencies[1] }
    ];
    const spread = point.ia - point.ib;
    return (
        <div className="ui-chart-tooltip cmp-tooltip">
            <div className="cmp-tooltip-date">{formatDate(point.date, 'medium')}</div>
            {rows.map((row) => {
                const change = row.value - 100;
                return (
                    <div key={row.symbol} className="cmp-tooltip-row">
                        <span className="cmp-swatch" style={{ '--cmp-color': row.color }} aria-hidden="true" />
                        <span className="mono cmp-tooltip-symbol">{row.symbol}</span>
                        <span className={cx('num', 'cmp-tooltip-change', change > 0 ? 'gain' : change < 0 ? 'loss' : 'muted')}>
                            {formatPercent(change)}
                        </span>
                        <span className="num cmp-tooltip-price">
                            {formatCurrency(row.price, row.currency)}
                            {row.closed && <span className="cmp-tooltip-closed"> · closed</span>}
                        </span>
                    </div>
                );
            })}
            <div className="cmp-tooltip-spread num">
                Gap {formatNumber(Math.abs(spread), 1)} pts{Math.abs(spread) >= 0.05 ? `, ${spread > 0 ? symbols[0] : symbols[1]} ahead` : ''}
            </div>
        </div>
    );
}

/** Keep the two end-of-line value tags from overlapping. */
function placeTags(ya, yb, min, max) {
    let a = ya;
    let b = yb;
    const gap = TAG_H + 2;
    if (Math.abs(a - b) < gap) {
        const mid = (a + b) / 2;
        const up = a <= b ? 'a' : 'b';
        a = up === 'a' ? mid - gap / 2 : mid + gap / 2;
        b = up === 'a' ? mid + gap / 2 : mid - gap / 2;
    }
    const clamp = (v) => Math.min(max, Math.max(min, v));
    return [clamp(a), clamp(b)];
}

/** Both symbols rebased to 100 on a shared date axis, with range selector and legend. */
export function CompareChart({ stockA, stockB, height = 320, className, style }) {
    const reduced = usePrefersReducedMotion();
    const [range, setRange] = useState('1y');
    const months = RANGES.find((r) => r.value === range)?.months || 12;
    const symbols = [stockA.symbol, stockB.symbol];
    const currencies = [stockA.currency || 'USD', stockB.currency || 'USD'];

    const series = useMemo(
        () => alignSeries(stockA.priceHistory, stockB.priceHistory, months),
        [stockA.priceHistory, stockB.priceHistory, months]
    );

    let body;
    let legend = null;
    if (!series) {
        body = (
            <div className="ui-chart-empty cmp-chart-empty" style={{ height }}>
                Price history is not available for {!stockA.priceHistory?.length ? symbols[0] : symbols[1]}, so the two cannot be charted together.
            </div>
        );
    } else {
        const values = series.points.flatMap((p) => [p.ia, p.ib]);
        let lo = Math.min(...values, 100);
        let hi = Math.max(...values, 100);
        const pad = (hi - lo) * 0.08 || 2;
        lo -= pad;
        hi += pad;
        const ticks = niceTicks(lo, hi, 5);
        const spanDays = (Date.parse(series.end) - Date.parse(series.start)) / 86400000;
        const dateStyle = spanDays > 200 ? 'month' : 'short';
        const xTicks = dateStyle === 'month' ? monthStarts(series.points) : undefined;

        const plotTop = MARGIN.top;
        const plotH = height - MARGIN.top - MARGIN.bottom - X_AXIS_H;
        const yOf = (v) => plotTop + ((hi - v) / (hi - lo)) * plotH;
        const [tagA, tagB] = placeTags(yOf(series.lastA.a), yOf(series.lastB.b), TAG_H / 2, plotTop + plotH - TAG_H / 2);
        const lead = series.returnA - series.returnB;
        const leader = lead >= 0 ? symbols[0] : symbols[1];
        const summary = `${symbols[0]} ${formatPercent(series.returnA)} and ${symbols[1]} ${formatPercent(series.returnB)} from `
            + `${formatDate(series.start, 'medium')} to ${formatDate(series.end, 'medium')}`;

        legend = (
            <div className="cmp-legend">
                {[series.returnA, series.returnB].map((ret, i) => (
                    <span key={symbols[i]} className="cmp-legend-item">
                        <span className="cmp-swatch cmp-swatch--line" style={{ '--cmp-color': SIDE_COLORS[i] }} aria-hidden="true" />
                        <span className="mono cmp-legend-symbol">{symbols[i]}</span>
                        <ChangePill value={ret} size="sm" />
                    </span>
                ))}
                <span className="cmp-legend-note num" data-testid="cmp-chart-lead">
                    {Math.abs(lead) < 0.05
                        ? 'Level over this period'
                        : <><span className="mono">{leader}</span> ahead by {formatNumber(Math.abs(lead), 1)} pts</>}
                </span>
            </div>
        );

        body = (
            <>
                <div className="cmp-chart-frame" style={{ height }} role="img" aria-label={`Performance rebased to 100: ${summary}`}>
                    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 800, height }}>
                        <LineChart data={series.points} margin={MARGIN}>
                            <CartesianGrid vertical={false} stroke="var(--sc-chart-grid)" />
                            <XAxis
                                dataKey="date"
                                height={X_AXIS_H}
                                ticks={xTicks}
                                tickFormatter={(d) => formatDate(d, dateStyle)}
                                tick={{ fill: 'var(--sc-text-muted)' }}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                minTickGap={28}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                orientation="right"
                                width={Y_AXIS_W}
                                domain={[lo, hi]}
                                ticks={ticks}
                                tickFormatter={(v) => formatNumber(v, v % 1 ? 1 : 0)}
                                tick={{ fill: 'var(--sc-text-muted)' }}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                allowDataOverflow
                            />
                            <ReferenceLine y={100} stroke="var(--sc-text-faint)" strokeDasharray="4 4" />
                            <Tooltip
                                content={<ChartTooltip symbols={symbols} currencies={currencies} />}
                                cursor={{ stroke: 'var(--sc-border-strong)', strokeWidth: 1 }}
                                isAnimationActive={false}
                                wrapperStyle={{ outline: 'none', zIndex: 3 }}
                            />
                            {['a', 'b'].map((key, i) => (
                                <Line
                                    key={`${key}-${range}`}
                                    type="monotone"
                                    dataKey={key}
                                    name={symbols[i]}
                                    stroke={SIDE_COLORS[i]}
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls
                                    activeDot={{ r: 4.5, fill: SIDE_COLORS[i], stroke: 'var(--sc-surface-2)', strokeWidth: 2 }}
                                    isAnimationActive={!reduced}
                                    animationDuration={900}
                                    animationBegin={i * 120}
                                    animationEasing="ease-out"
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                    <div className="cmp-tags" key={range} aria-hidden="true" style={{ width: Y_AXIS_W }}>
                        {[{ y: tagA, v: series.returnA }, { y: tagB, v: series.returnB }].map((tag, i) => (
                            <span
                                key={symbols[i]}
                                className="cmp-tag num"
                                style={{ top: tag.y, '--cmp-color': SIDE_COLORS[i] }}
                            >
                                {formatPercent(tag.v, { digits: 1 })}
                            </span>
                        ))}
                    </div>
                </div>
                {series.lateStart && (
                    <p className="cmp-chart-note">
                        Starts {formatDate(series.start, 'medium')}, the first day both symbols have prices in this range.
                    </p>
                )}
            </>
        );
    }

    return (
        <Card className={cx('cmp-chart-card', className)} style={style} data-testid="cmp-chart">
            <CardHeader
                icon={LineChartIcon}
                title="Relative performance"
                subtitle="Both rebased to 100 at the start of the period, on a shared calendar"
                action={(
                    <SegmentedControl
                        options={RANGES}
                        value={range}
                        onChange={setRange}
                        size="sm"
                        testId="cmp-range"
                        aria-label="Chart range"
                    />
                )}
            />
            {legend}
            {body}
        </Card>
    );
}

export default CompareChart;
