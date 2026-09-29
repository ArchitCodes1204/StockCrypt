import { formatNumber, toNumber } from '../../utils/format';
import { cx } from './cx';

const TONE_VAR = {
    gain: ['var(--sc-gain)', 'var(--sc-gain-soft)'],
    loss: ['var(--sc-loss)', 'var(--sc-loss-soft)'],
    warn: ['var(--sc-warn)', 'var(--sc-warn-soft)'],
    info: ['var(--sc-info)', 'var(--sc-info-soft)'],
    accent: ['var(--sc-accent)', 'var(--sc-accent-soft)'],
    neutral: ['var(--sc-text-muted)', 'var(--sc-surface-4)']
};

const toneOf = (tone) => TONE_VAR[tone] || TONE_VAR.accent;

/**
 * Semicircle meter with an animated sweep.
 * <Gauge value={6} min={1} max={10} label="Risk score" sublabel="Moderate risk"
 *        zones={[{ to: 3, tone: 'gain' }, { to: 6, tone: 'warn' }, { to: 10, tone: 'loss' }]} />
 * The value arc takes the tone of the zone it falls in; the track shows every zone as a soft band.
 */
export function Gauge({
    value,
    min = 0,
    max = 100,
    label,
    sublabel,
    zones = [],
    size = 160,
    format,
    showMax = false,
    className,
    testId
}) {
    const n = toNumber(value);
    const lo = Number(min);
    const hi = Number(max) > lo ? Number(max) : lo + 1;
    const clamped = n === null ? lo : Math.min(hi, Math.max(lo, n));
    const frac = (clamped - lo) / (hi - lo);

    const sorted = [...zones]
        .map((z) => ({ to: toNumber(z.to), tone: z.tone }))
        .filter((z) => z.to !== null)
        .sort((a, b) => a.to - b.to);
    const activeZone = n === null ? null : sorted.find((z) => clamped <= z.to) || sorted[sorted.length - 1];
    const tone = n === null ? 'neutral' : activeZone?.tone || 'accent';
    const [strokeColor] = toneOf(tone);

    const stroke = Math.max(8, Math.round(size * 0.085));
    const r = (size - stroke) / 2;
    const cx0 = size / 2;
    const cy0 = size / 2;
    const svgH = size / 2 + stroke / 2 + 1;
    const arc = `M ${cx0 - r} ${cy0} A ${r} ${r} 0 0 1 ${cx0 + r} ${cy0}`;
    const len = Math.PI * r;
    const gap = sorted.length > 1 ? 3 : 0;

    // Soft track segments, one per zone (or a single neutral track).
    const segments = [];
    for (let i = 0, start = lo; i < sorted.length; i += 1) {
        const end = Math.min(hi, sorted[i].to);
        const s = Math.max(0, (start - lo) / (hi - lo));
        const e = i === sorted.length - 1 ? 1 : Math.max(s, (end - lo) / (hi - lo));
        if (e > s) segments.push({ s, e, tone: sorted[i].tone });
        start = end;
    }

    const formatted = n === null ? '—' : format ? format(n) : formatNumber(n, Number.isInteger(n) ? 0 : 1);
    const numberSize = Math.round(size * 0.2);

    return (
        <div
            className={cx('ui-gauge', className)}
            data-testid={testId}
            style={{ '--gauge-tone': strokeColor }}
            role="meter"
            aria-valuemin={lo}
            aria-valuemax={hi}
            aria-valuenow={n === null ? undefined : clamped}
            aria-valuetext={[formatted, sublabel].filter(Boolean).join(', ')}
            aria-label={typeof label === 'string' ? label : undefined}
        >
            <div className="ui-gauge-dial" style={{ width: size, height: svgH }}>
                <svg width={size} height={svgH} viewBox={`0 0 ${size} ${svgH}`} aria-hidden="true" focusable="false">
                    {segments.length ? segments.map((seg, i) => {
                        const segLen = Math.max(0, (seg.e - seg.s) * len - (i < segments.length - 1 ? gap : 0));
                        return (
                            <path
                                key={i}
                                d={arc}
                                fill="none"
                                strokeWidth={stroke}
                                style={{
                                    stroke: toneOf(seg.tone)[1],
                                    strokeDasharray: `${segLen} ${len * 2}`,
                                    strokeDashoffset: -seg.s * len
                                }}
                            />
                        );
                    }) : (
                        <path d={arc} fill="none" strokeWidth={stroke} style={{ stroke: 'var(--sc-surface-4)' }} />
                    )}
                    {n !== null && (
                        <>
                            <path
                                className="ui-gauge-value"
                                d={arc}
                                strokeWidth={stroke}
                                style={{
                                    stroke: strokeColor,
                                    strokeDasharray: `${len} ${len}`,
                                    strokeDashoffset: len * (1 - frac),
                                    '--gauge-len': len
                                }}
                            />
                            <g
                                className="ui-gauge-knob"
                                style={{ transform: `rotate(${frac * 180}deg)`, transformOrigin: `${cx0}px ${cy0}px` }}
                            >
                                <circle
                                    cx={cx0 - r}
                                    cy={cy0}
                                    r={stroke * 0.5 + 1.5}
                                    style={{ fill: 'var(--sc-surface-2)' }}
                                />
                                <circle cx={cx0 - r} cy={cy0} r={stroke * 0.26} style={{ fill: strokeColor }} />
                            </g>
                        </>
                    )}
                </svg>
                <div className="ui-gauge-readout">
                    <span className="ui-gauge-number" style={{ fontSize: numberSize }}>
                        {formatted}
                        {showMax && n !== null && <span className="ui-gauge-max">/{formatNumber(hi, 0)}</span>}
                    </span>
                </div>
            </div>
            {label && <div className="ui-gauge-label">{label}</div>}
            {sublabel && <div className="ui-gauge-sublabel">{sublabel}</div>}
        </div>
    );
}

export default Gauge;
