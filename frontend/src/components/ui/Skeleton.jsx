import { cx } from './cx';

/** Shimmering placeholder block. Numbers are px; strings are any CSS length. */
export function Skeleton({ width = '100%', height = 14, radius, className, style, ...rest }) {
    return (
        <span
            aria-hidden="true"
            className={cx('ui-skeleton', className)}
            style={{ width, height, borderRadius: radius, ...style }}
            {...rest}
        />
    );
}

/** A paragraph of skeleton lines; the last line is shorter. */
export function SkeletonText({ lines = 3, lineHeight = 12, gap = 10, lastWidth = '60%', className, style }) {
    const count = Math.max(1, lines);
    return (
        <span aria-hidden="true" className={cx('ui-skeleton-text', className)} style={{ gap, ...style }}>
            {Array.from({ length: count }, (_, i) => (
                <Skeleton key={i} height={lineHeight} width={i === count - 1 && count > 1 ? lastWidth : '100%'} />
            ))}
        </span>
    );
}

export default Skeleton;
