import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatPercent, toNumber } from '../../utils/format';
import { cx } from './cx';

const TONES = ['gain', 'loss', 'warn', 'info', 'accent', 'neutral'];
const DECISION_TONES = { BUY: 'gain', HOLD: 'warn', SELL: 'loss' };

/** Small status label. tone: gain | loss | warn | info | accent | neutral; size: sm | md | lg */
export function Badge({ tone = 'neutral', dot = false, size = 'md', icon: Icon, className, children, ...rest }) {
    const safeTone = TONES.includes(tone) ? tone : 'neutral';
    return (
        <span className={cx('ui-badge', `ui-badge--${safeTone}`, `ui-badge--${size}`, className)} {...rest}>
            {dot && <span className="ui-badge-dot" aria-hidden="true" />}
            {Icon && <Icon size={size === 'sm' ? 11 : size === 'lg' ? 14 : 12} aria-hidden="true" />}
            {children}
        </span>
    );
}

/** BUY (gain) / HOLD (warn) / SELL (loss); anything else renders neutral. */
export function RecommendationBadge({ decision, size = 'md', className, ...rest }) {
    const label = String(decision ?? '').trim().toUpperCase();
    const tone = DECISION_TONES[label] || 'neutral';
    return (
        <Badge tone={tone} dot size={size} className={cx('ui-rec-badge', className)} {...rest}>
            {label || 'N/A'}
        </Badge>
    );
}

/**
 * Signed percent change with an arrow: <ChangePill value={-1.35} /> renders "-1.35%".
 * `value` is a percent number (strings like '-1.35%' are parsed too).
 */
export function ChangePill({ value, size = 'md', showArrow = true, digits = 2, className, ...rest }) {
    const n = toNumber(value);
    const rounded = n === null ? null : Number(n.toFixed(digits));
    const direction = rounded === null || rounded === 0 ? 'flat' : rounded > 0 ? 'gain' : 'loss';
    const Arrow = direction === 'gain' ? ArrowUpRight : direction === 'loss' ? ArrowDownRight : null;
    const withArrow = showArrow && Arrow;
    return (
        <span
            className={cx('ui-pill', `ui-pill--${direction}`, `ui-pill--${size}`, withArrow && 'ui-pill--arrow', className)}
            {...rest}
        >
            {withArrow && <Arrow size={size === 'lg' ? 15 : size === 'sm' ? 12 : 13} strokeWidth={2.4} aria-hidden="true" />}
            {formatPercent(n, { digits })}
        </span>
    );
}

/** 8px status dot; `pulse` adds a soft expanding ring (used for "live" states). */
export function StatusDot({ tone = 'neutral', pulse = false, className, label }) {
    return (
        <span
            className={cx('ui-status-dot', `ui-status-dot--${tone}`, pulse && 'is-pulsing', className)}
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
        />
    );
}

export default Badge;
