import { cx } from './cx';

const SIZES = { sm: 14, md: 18, lg: 24 };

/**
 * Small circular spinner that inherits currentColor.
 * Pass `label` when it is the only loading indicator (announced as a status).
 */
export function Spinner({ size = 16, label, className }) {
    const px = typeof size === 'number' ? size : SIZES[size] || 16;
    return (
        <svg
            className={cx('ui-spinner', className)}
            width={px}
            height={px}
            viewBox="0 0 24 24"
            fill="none"
            role={label ? 'status' : undefined}
            aria-label={label || undefined}
            aria-hidden={label ? undefined : true}
        >
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.5" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
    );
}

export default Spinner;
