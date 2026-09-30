import { useId } from 'react';
import { toNumber } from '../../utils/format';
import { cx, safeId } from './cx';

function resolveColor(color, first, last) {
    if (!color || color === 'auto') return last >= first ? 'var(--sc-gain)' : 'var(--sc-loss)';
    if (color === 'accent') return 'var(--sc-chart-1)';
    return color;
}

/**
 * Tiny trend line (pure SVG). Renders nothing for fewer than 2 points.
 * <Sparkline data={[1, 3, 2, 5]} /> (color 'auto' = gain if last >= first, else loss)
 * width/height are pixels. Decorative by default; pass ariaLabel to expose it.
 */
export function Sparkline({
    data,
    width = 96,
    height = 32,
    color = 'auto',
    strokeWidth = 1.75,
    fill = true,
    animate = true,
    className,
    ariaLabel
}) {
    const uid = safeId(useId());
    const points = Array.isArray(data) ? data.map(toNumber).filter((v) => v !== null) : [];
    if (points.length < 2) return null;

    const w = Number(width) || 96;
    const h = Number(height) || 32;
    const pad = strokeWidth / 2 + 1;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min;
    const stepX = (w - pad * 2) / (points.length - 1);
    const y = (v) => (range === 0 ? h / 2 : pad + (1 - (v - min) / range) * (h - pad * 2));
    const coords = points.map((v, i) => [pad + i * stepX, y(v)]);
    const line = coords.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(2)} ${py.toFixed(2)}`).join(' ');
    let length = 0;
    for (let i = 1; i < coords.length; i += 1) {
        length += Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);
    }
    length = Math.ceil(length) + 2;
    const lastX = coords[coords.length - 1][0].toFixed(2);
    const area = `${line} L${lastX} ${h} L${coords[0][0].toFixed(2)} ${h} Z`;
    const stroke = resolveColor(color, points[0], points[points.length - 1]);
    const gradientId = `sc-spark-${uid}`;

    return (
        <svg
            className={cx('ui-sparkline', animate && 'is-animated', className)}
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            role={ariaLabel ? 'img' : undefined}
            aria-label={ariaLabel || undefined}
            aria-hidden={ariaLabel ? undefined : true}
            focusable="false"
        >
            {fill && (
                <>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" style={{ stopColor: stroke, stopOpacity: 0.24 }} />
                            <stop offset="100%" style={{ stopColor: stroke, stopOpacity: 0 }} />
                        </linearGradient>
                    </defs>
                    <path className="ui-sparkline-area" d={area} fill={`url(#${gradientId})`} />
                </>
            )}
            <path
                className="ui-sparkline-line"
                d={line}
                fill="none"
                style={{ stroke, strokeDasharray: `${length} ${length}`, '--sc-line-length': length }}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default Sparkline;
