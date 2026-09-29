import { useLayoutEffect, useRef } from 'react';
import { cx } from './cx';

/**
 * Pill toggle with a sliding indicator.
 * <SegmentedControl options={[{ label: '1M', value: '1m' }, ...]} value={range} onChange={setRange} testId="range" />
 * Buttons get data-testid `${testId}-${value}`. Arrow keys move the selection.
 */
export function SegmentedControl({
    options = [],
    value,
    onChange,
    size = 'md',
    fullWidth = false,
    testId,
    className,
    'aria-label': ariaLabel
}) {
    const trackRef = useRef(null);
    const indicatorRef = useRef(null);
    const activeIndex = options.findIndex((o) => o.value === value);

    useLayoutEffect(() => {
        const track = trackRef.current;
        const indicator = indicatorRef.current;
        if (!track || !indicator) return undefined;

        const place = () => {
            const button = track.querySelector('[data-active="true"]');
            if (!button) {
                indicator.style.opacity = '0';
                return;
            }
            indicator.style.opacity = '1';
            indicator.style.width = `${button.offsetWidth}px`;
            indicator.style.transform = `translateX(${button.offsetLeft}px)`;
        };

        place();
        // Turn transitions on only after the first placement (no slide-in from 0 on mount).
        const frame = requestAnimationFrame(() => {
            indicator.dataset.ready = 'true';
        });
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
        if (observer) {
            observer.observe(track);
            track.querySelectorAll('button').forEach((b) => observer.observe(b));
        }
        document.fonts?.ready?.then(place).catch(() => {});
        return () => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
        };
    }, [activeIndex, options.length]);

    const select = (index) => {
        const option = options[index];
        if (option && !option.disabled && option.value !== value) onChange?.(option.value);
    };

    const onKeyDown = (event) => {
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        let next = null;
        if (event.key in keys) next = (Math.max(0, activeIndex) + keys[event.key] + options.length) % options.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = options.length - 1;
        if (next === null) return;
        event.preventDefault();
        select(next);
        const buttons = trackRef.current?.querySelectorAll('button');
        buttons?.[next]?.focus();
    };

    return (
        <div
            ref={trackRef}
            role="radiogroup"
            aria-label={ariaLabel}
            className={cx('ui-seg', `ui-seg--${size}`, fullWidth && 'ui-seg--full', className)}
            data-testid={testId}
            onKeyDown={onKeyDown}
        >
            <span ref={indicatorRef} className="ui-seg-indicator" aria-hidden="true" />
            {options.map((option, index) => {
                const active = index === activeIndex;
                const Icon = option.icon;
                return (
                    <button
                        key={String(option.value)}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        tabIndex={active || (activeIndex === -1 && index === 0) ? 0 : -1}
                        disabled={option.disabled}
                        data-active={active ? 'true' : undefined}
                        data-testid={testId ? `${testId}-${option.value}` : undefined}
                        className="ui-seg-btn"
                        onClick={() => select(index)}
                    >
                        {Icon && <Icon size={size === 'sm' ? 13 : 15} aria-hidden="true" />}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export default SegmentedControl;
