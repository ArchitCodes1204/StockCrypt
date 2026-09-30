import { useId } from 'react';
import { cx, safeId } from './cx';

// Brand constants: the mark looks the same in both themes.
const GOLD_TOP = '#FFD56B';
const GOLD_BOTTOM = '#F0A800';
const INK = '#1A1404';

/** The 32x32 logomark (gold tile, three rising bars and a trend line). */
export function LogoMark({ size = 28, title, className }) {
    const gradientId = `sc-logo-${safeId(useId())}`;
    return (
        <svg
            className={cx('ui-logo-mark', className)}
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            role={title ? 'img' : undefined}
            aria-label={title || undefined}
            aria-hidden={title ? undefined : true}
            focusable="false"
        >
            <defs>
                <linearGradient id={gradientId} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor={GOLD_TOP} />
                    <stop offset="1" stopColor={GOLD_BOTTOM} />
                </linearGradient>
            </defs>
            <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
            <rect x="7.75" y="18.5" width="4.1" height="6.5" rx="1.4" fill={INK} />
            <rect x="13.95" y="15" width="4.1" height="10" rx="1.4" fill={INK} />
            <rect x="20.15" y="11.5" width="4.1" height="13.5" rx="1.4" fill={INK} />
            <path d="M7.2 15.2 12.6 11.2 16.6 12.6 23.4 7.6" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="24.1" cy="7.1" r="1.75" fill={INK} />
        </svg>
    );
}

/** Logomark + "StockCrypt" wordmark ("Crypt" in the accent text color). */
export function Logo({ size = 28, withWordmark = true, className }) {
    return (
        <span className={cx('ui-logo', className)} style={{ '--logo-size': `${size}px` }}>
            <LogoMark size={size} title={withWordmark ? undefined : 'StockCrypt'} />
            {withWordmark && (
                <span className="ui-logo-word">
                    Stock<span className="ui-logo-accent">Crypt</span>
                </span>
            )}
        </span>
    );
}

export default Logo;
