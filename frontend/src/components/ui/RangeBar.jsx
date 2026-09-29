import { formatCurrency, toNumber } from '../../utils/format';
import { cx } from './cx';

/**
 * Low-high range with a marker for the current value (52-week range).
 * <RangeBar low={402.1} high={553.72} value={509.22} formatter={(v) => formatCurrency(v, 'USD')} />
 */
export function RangeBar({
    low,
    high,
    value,
    lowLabel = '52W low',
    highLabel = '52W high',
    formatter = (v) => formatCurrency(v),
    className,
    testId
}) {
    const lo = toNumber(low);
    const hi = toNumber(high);
    const v = toNumber(value);
    const valid = lo !== null && hi !== null && v !== null && hi > lo;
    const pct = valid ? Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100)) : 0;
    const label = valid
        ? `${formatter(v)}, ${Math.round(pct)}% of the range between ${formatter(lo)} and ${formatter(hi)}`
        : 'Range unavailable';

    return (
        <div className={cx('ui-range', className)} style={{ '--range-target': `${pct}%` }} data-testid={testId}>
            <div className="ui-range-track" role="img" aria-label={label}>
                {valid && (
                    <>
                        <span className="ui-range-fill" />
                        <span className="ui-range-marker" />
                        <span className="ui-range-bubble">{formatter(v)}</span>
                    </>
                )}
            </div>
            <div className="ui-range-labels">
                <span>
                    {lowLabel}
                    <strong>{lo === null ? '—' : formatter(lo)}</strong>
                </span>
                <span>
                    {highLabel}
                    <strong>{hi === null ? '—' : formatter(hi)}</strong>
                </span>
            </div>
        </div>
    );
}

export default RangeBar;
