import { baseSymbol, symbolColor } from '../../utils/format';
import { cx } from './cx';

/** Monogram for a ticker (the same symbol always gets the same palette color). */
export function SymbolAvatar({ symbol, size = 36, className, style }) {
    const base = baseSymbol(symbol);
    const text = base.length <= 3 ? base : base.slice(0, 2);
    const fontSize = Math.round(size * (text.length >= 3 ? 0.3 : text.length === 2 ? 0.36 : 0.42));
    return (
        <span
            className={cx('ui-avatar', className)}
            aria-hidden="true"
            style={{
                width: size,
                height: size,
                borderRadius: Math.round(size * 0.3),
                fontSize,
                '--avatar-color': symbolColor(symbol),
                ...style
            }}
        >
            {text || '?'}
        </span>
    );
}

export default SymbolAvatar;
