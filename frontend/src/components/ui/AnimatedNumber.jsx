import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { EMPTY, toNumber } from '../../utils/format';
import { cx } from './cx';

function decimalsOf(n) {
    if (!Number.isFinite(n) || Number.isInteger(n)) return 0;
    const text = String(n);
    const dot = text.indexOf('.');
    return dot === -1 ? 0 : Math.min(6, text.length - dot - 1);
}

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/**
 * Counts up from the previous value (0 on first render) to `value`.
 * <AnimatedNumber value={19545.69} format={(v) => formatCurrency(v)} />
 * Non-numeric values render '—'. Reduced motion shows the final value at once.
 */
export function AnimatedNumber({ value, format = String, duration = 900, className }) {
    const reduced = usePrefersReducedMotion();
    const target = toNumber(value);
    const [display, setDisplay] = useState(0);
    const current = useRef(0);

    useEffect(() => {
        if (target === null || reduced) return undefined;
        const from = current.current;
        if (from === target) return undefined;
        const places = decimalsOf(target);
        const factor = 10 ** places;
        let frame = 0;
        let start = 0;
        const tick = (now) => {
            if (!start) start = now;
            const t = Math.min(1, (now - start) / Math.max(1, duration));
            const raw = from + (target - from) * easeOutCubic(t);
            const next = t >= 1 ? target : Math.round(raw * factor) / factor;
            current.current = next;
            setDisplay(next);
            if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [target, duration, reduced]);

    const shown = target === null ? null : reduced ? target : display;
    return (
        <span className={cx('ui-animated-number', className)}>
            {shown === null ? EMPTY : format(shown)}
        </span>
    );
}

export default AnimatedNumber;
