import { cx } from './cx';

/**
 * Seamless horizontal ticker tape. Children are rendered twice (the copy is
 * inert + aria-hidden). Pauses on hover/focus; stops under reduced motion.
 * <Marquee duration={45}>{quotes.map(q => <TickerItem key={q.symbol} {...q} />)}</Marquee>
 */
export function Marquee({ children, duration = 40, gap = 32, pauseOnHover = true, paused = false, className, 'aria-label': ariaLabel }) {
    return (
        <div
            className={cx('ui-marquee', pauseOnHover && 'ui-marquee--pausable', paused && 'is-paused', className)}
            style={{ '--marquee-duration': `${duration}s`, '--marquee-gap': `${gap}px` }}
            role={ariaLabel ? 'region' : undefined}
            aria-label={ariaLabel}
        >
            <div className="ui-marquee-track">
                <div className="ui-marquee-group">{children}</div>
                <div className="ui-marquee-group" aria-hidden="true" inert>
                    {children}
                </div>
            </div>
        </div>
    );
}

export default Marquee;
