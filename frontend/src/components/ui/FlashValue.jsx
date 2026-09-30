import { useState } from 'react';
import { toNumber } from '../../utils/format';
import { cx } from './cx';

/**
 * Briefly flashes green/red behind its content when `value` goes up/down.
 * <FlashValue value={price}>{formatCurrency(price)}</FlashValue>
 */
export function FlashValue({ value, children, className, as = 'span' }) {
    const Tag = as;
    const n = toNumber(value);
    const [previous, setPrevious] = useState(n);
    const [flash, setFlash] = useState({ direction: null, key: 0 });

    if (n !== previous) {
        setPrevious(n);
        if (n !== null && previous !== null) {
            setFlash((f) => ({ direction: n > previous ? 'gain' : 'loss', key: f.key + 1 }));
        }
    }

    return (
        <Tag key={flash.key} className={cx('ui-flash', flash.direction && `ui-flash--${flash.direction}`, className)}>
            {children ?? value}
        </Tag>
    );
}

export default FlashValue;
