import { useId } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { formatCompact, formatCurrency, formatDate, formatPercent, toDate, toNumber } from '../../utils/format';
import { cx, safeId } from './cx';

function resolveColor(color, first, last) {
    if (!color || color === 'auto') return last >= first ? 'var(--sc-gain)' : 'var(--sc-loss)';
    if (color === 'accent') return 'var(--sc-chart-1)';
    return color;
}

// Axis ticks: fewer decimals than the tooltip, compact above 10k.
function axisCurrency(value, currency) {
    const abs = Math.abs(value);
    if (abs >= 10000) return formatCurrency(value, currency, { compact: true });
    if (abs >= 100) return formatCurrency(value, currency, { decimals: 0 });
    if (abs >= 1) return formatCurrency(value, currency, { decimals: 2 });
    return formatCurrency(value, currency);
}

function ChartTooltip({ active, payload, valueFormat, base }) {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload;
    if (!point) return null;
    const change = base ? ((point.value - base) / Math.abs(base)) * 100 : null;
    return (
        <div className="ui-chart-tooltip">
            <div className="ui-chart-tooltip-value">{valueFormat(point.value)}</div>
            <div className="ui-chart-tooltip-meta">
                <span>{formatDate(point.date, 'medium')}</span>
                {change !== null && Number.isFinite(change) && (
                    <span className={change >= 0 ? 'gain' : 'loss'}>{formatPercent(change)}</span>
                )}
            </div>
        </div>
    );
}

/**
 * Area chart for a price or portfolio series.
 * <PriceChart data={[{ date: '2025-10-01', value: 512.3 }, ...]} color="accent" referenceValue={invested} referenceLabel="Invested" />
 * color: 'auto' (gain/loss by first vs last), 'accent' (gold) or any CSS color / var().
 */
export function PriceChart({
    data,
    height = 280,
    color = 'auto',
    currency = 'USD',
    showXAxis = true,
    showYAxis = true,
    showGrid = true,
    referenceValue,
    referenceLabel,
    valueFormatter,
    animate = true,
    className,
    ariaLabel
}) {
    const reduced = usePrefersReducedMotion();
    const gradientId = `sc-area-${safeId(useId())}`;

    const points = (Array.isArray(data) ? data : [])
        .map((d) => ({ date: d?.date, value: toNumber(d?.value) }))
        .filter((d) => d.value !== null && toDate(d.date));

    if (points.length < 2) {
        return (
            <div className={cx('ui-chart-empty', className)} style={{ height }}>
                Not enough data to draw a chart yet
            </div>
        );
    }

    const first = points[0].value;
    const last = points[points.length - 1].value;
    const stroke = resolveColor(color, first, last);
    const valueFormat = valueFormatter || ((v) => formatCurrency(v, currency));
    const tickFormat = valueFormatter
        ? (v) => (Math.abs(v) >= 10000 ? formatCompact(v) : valueFormatter(v))
        : (v) => axisCurrency(v, currency);

    const firstDate = toDate(points[0].date);
    const lastDate = toDate(points[points.length - 1].date);
    const spanDays = (lastDate - firstDate) / 86400000;
    const dateStyle = spanDays > 200 ? 'month' : 'short';

    const ref = toNumber(referenceValue);
    const values = points.map((p) => p.value);
    let lo = Math.min(...values, ...(ref !== null ? [ref] : []));
    let hi = Math.max(...values, ...(ref !== null ? [ref] : []));
    const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.02 || 1;
    lo -= pad;
    hi += pad;
    if (Math.min(...values) >= 0 && lo < 0) lo = 0;

    const change = first ? ((last - first) / Math.abs(first)) * 100 : 0;
    const summary = ariaLabel || `Chart from ${formatDate(firstDate, 'medium')} to ${formatDate(lastDate, 'medium')}: `
        + `${valueFormat(first)} to ${valueFormat(last)} (${formatPercent(change)})`;

    return (
        <div className={cx('ui-price-chart', className)} style={{ height }} role="figure" aria-label={summary}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height }}>
                <AreaChart data={points} margin={{ top: 8, right: showYAxis ? 4 : 2, bottom: 0, left: 2 }}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
                            <stop offset="72%" stopColor={stroke} stopOpacity={0.04} />
                            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    {showGrid && <CartesianGrid vertical={false} stroke="var(--sc-chart-grid)" />}
                    <XAxis
                        dataKey="date"
                        hide={!showXAxis}
                        tickFormatter={(d) => formatDate(d, dateStyle)}
                        tick={{ fill: 'var(--sc-text-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        minTickGap={36}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        orientation="right"
                        hide={!showYAxis}
                        domain={[lo, hi]}
                        tickFormatter={tickFormat}
                        tick={{ fill: 'var(--sc-text-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        width="auto"
                        tickCount={5}
                        allowDataOverflow
                    />
                    <Tooltip
                        content={<ChartTooltip valueFormat={valueFormat} base={first} />}
                        cursor={{ stroke: 'var(--sc-border-strong)', strokeWidth: 1 }}
                        isAnimationActive={false}
                        wrapperStyle={{ outline: 'none', zIndex: 2 }}
                    />
                    {ref !== null && (
                        <ReferenceLine
                            y={ref}
                            stroke="var(--sc-text-faint)"
                            strokeDasharray="4 4"
                            label={referenceLabel ? {
                                value: referenceLabel,
                                position: 'insideTopLeft',
                                fill: 'var(--sc-text-muted)'
                            } : undefined}
                        />
                    )}
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={stroke}
                        strokeWidth={2}
                        fill={`url(#${gradientId})`}
                        dot={false}
                        activeDot={{ r: 4.5, fill: stroke, stroke: 'var(--sc-surface-2)', strokeWidth: 2 }}
                        isAnimationActive={animate && !reduced}
                        animationDuration={900}
                        animationEasing="ease-out"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export default PriceChart;
