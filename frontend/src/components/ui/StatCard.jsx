import { formatNumber } from '../../utils/format';
import { AnimatedNumber } from './AnimatedNumber';
import { ChangePill } from './Badge';
import { Card } from './Card';
import { cx } from './cx';
import { Skeleton } from './Skeleton';

const defaultFormat = (v) => formatNumber(v);

/**
 * KPI tile: label, animated value, optional % change pill and hint.
 * <StatCard label="Portfolio value" value={19545.69} format={(v) => formatCurrency(v)} change={2.4} hint="vs. cost basis" icon={Wallet} />
 */
export function StatCard({
    label,
    value,
    format = defaultFormat,
    change,
    icon: Icon,
    loading = false,
    hint,
    testId,
    className,
    style,
    ...rest
}) {
    const hasChange = change !== undefined && change !== null && change !== '';
    return (
        <Card
            className={cx('ui-stat', className)}
            style={style}
            data-testid={testId}
            aria-busy={loading || undefined}
            {...rest}
        >
            <div className="ui-stat-top">
                <span className="ui-stat-label">{label}</span>
                {Icon && (
                    <span className="ui-stat-icon" aria-hidden="true">
                        <Icon size={15} />
                    </span>
                )}
            </div>
            {loading ? (
                <div className="ui-stat-skeleton">
                    <Skeleton width="64%" height={28} radius={8} />
                    <Skeleton width="36%" height={16} radius={999} />
                </div>
            ) : (
                <>
                    <div className="ui-stat-value">
                        <AnimatedNumber value={value} format={format} />
                    </div>
                    {(hasChange || hint) && (
                        <div className="ui-stat-foot">
                            {hasChange && <ChangePill value={change} size="sm" />}
                            {hint && <span className="ui-stat-hint">{hint}</span>}
                        </div>
                    )}
                </>
            )}
        </Card>
    );
}

export default StatCard;
