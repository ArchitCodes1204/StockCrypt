import { Coins, Scale, TrendingUp, Wallet } from 'lucide-react';
import { formatCurrency, toNumber } from '../utils/format';
import { AnimatedNumber, Card, Skeleton, StatCard, cx } from './ui';
import { formatSignedCurrency, toneOf } from './PortfolioUtils';

const money = (v) => formatCurrency(v);
const signedMoney = (v) => formatSignedCurrency(v);

function RetryHint({ onRetry }) {
    return (
        <span className="pf-kpi-failed">
            Couldn&apos;t load.{' '}
            <button type="button" className="pf-link-btn" onClick={onRetry}>Retry</button>
        </span>
    );
}

/** Realized vs unrealized gains, with a bar showing how the total splits between them. */
function GainsCard({ performance, loading, error, onRetry, style }) {
    const realized = toNumber(performance?.realizedGains);
    const unrealized = toNumber(performance?.unrealizedGains);
    const absR = Math.abs(realized ?? 0);
    const absU = Math.abs(unrealized ?? 0);
    const sum = absR + absU;
    const realizedShare = sum > 0 ? (absR / sum) * 100 : 0;

    return (
        <Card className="ui-stat pf-gains fade-up" style={style} data-testid="pf-kpi-gains" aria-busy={loading || undefined}>
            <div className="ui-stat-top">
                <span className="ui-stat-label">Realized vs unrealized</span>
                <span className="ui-stat-icon" aria-hidden="true">
                    <Scale size={15} />
                </span>
            </div>
            {loading ? (
                <div className="pf-gains-skeleton">
                    <Skeleton width="80%" height={16} />
                    <Skeleton width="72%" height={16} />
                    <Skeleton width="100%" height={6} radius={999} />
                </div>
            ) : error ? (
                <>
                    <div className="ui-stat-value">—</div>
                    <div className="ui-stat-foot">
                        <span className="ui-stat-hint"><RetryHint onRetry={onRetry} /></span>
                    </div>
                </>
            ) : (
                <>
                    <dl className="pf-gains-list">
                        <div className="pf-gains-row">
                            <dt>
                                <span className="pf-gains-dot pf-gains-dot--realized" aria-hidden="true" />
                                Realized
                            </dt>
                            <dd className={cx('num', toneOf(realized))}>
                                <AnimatedNumber value={realized} format={signedMoney} />
                            </dd>
                        </div>
                        <div className="pf-gains-row">
                            <dt>
                                <span className="pf-gains-dot pf-gains-dot--unrealized" aria-hidden="true" />
                                Unrealized
                            </dt>
                            <dd className={cx('num', toneOf(unrealized))}>
                                <AnimatedNumber value={unrealized} format={signedMoney} />
                            </dd>
                        </div>
                    </dl>
                    <div
                        className="pf-gains-bar"
                        role="img"
                        aria-label={sum > 0
                            ? `Realized gains are ${Math.round(realizedShare)}% of the total, unrealized ${Math.round(100 - realizedShare)}%`
                            : 'No gains or losses yet'}
                    >
                        {sum > 0 && (
                            <>
                                <span className="pf-gains-seg pf-gains-seg--realized" style={{ '--w': `${realizedShare}%` }} />
                                <span className="pf-gains-seg pf-gains-seg--unrealized" style={{ '--w': `${100 - realizedShare}%` }} />
                            </>
                        )}
                    </div>
                </>
            )}
        </Card>
    );
}

/**
 * Four headline figures. Summary (value, invested) and performance (P/L, gains)
 * load independently so one slow request never blanks the whole row.
 */
export function PortfolioKpis({ summary, summaryLoading, summaryError, performance, perfLoading, perfError, onRetrySummary, onRetryPerf }) {
    const count = toNumber(summary?.holdingsCount) ?? 0;
    const totalReturn = toNumber(performance?.totalReturn);
    const plTone = toneOf(totalReturn);
    const realized = toNumber(performance?.realizedGains);

    return (
        <section className="pf-kpis" data-testid="pf-kpis" aria-label="Portfolio summary">
            <StatCard
                className="pf-kpi pf-kpi--hero fade-up"
                style={{ '--i': 1 }}
                testId="pf-kpi-value"
                label="Portfolio value"
                icon={Wallet}
                loading={summaryLoading}
                value={summaryError ? null : summary?.totalValue}
                format={money}
                hint={summaryError
                    ? <RetryHint onRetry={onRetrySummary} />
                    : count ? `${count} open ${count === 1 ? 'position' : 'positions'} at market price` : 'No open positions yet'}
            />
            <StatCard
                className="pf-kpi fade-up"
                style={{ '--i': 2 }}
                testId="pf-kpi-invested"
                label="Invested"
                icon={Coins}
                loading={summaryLoading}
                value={summaryError ? null : summary?.totalInvested}
                format={money}
                hint={summaryError ? <RetryHint onRetry={onRetrySummary} /> : 'Cost basis of open positions'}
            />
            <StatCard
                className={cx('pf-kpi fade-up', plTone && `pf-kpi--${plTone}`)}
                style={{ '--i': 3 }}
                testId="pf-kpi-pl"
                label="Total P/L"
                icon={TrendingUp}
                loading={perfLoading}
                value={perfError ? null : totalReturn}
                format={signedMoney}
                change={perfError ? undefined : performance?.totalReturnPercent}
                hint={perfError
                    ? <RetryHint onRetry={onRetryPerf} />
                    : realized ? `Incl. ${formatSignedCurrency(realized)} realized` : 'Realized + unrealized'}
            />
            <GainsCard
                performance={performance}
                loading={perfLoading}
                error={perfError}
                onRetry={onRetryPerf}
                style={{ '--i': 4 }}
            />
        </section>
    );
}

export default PortfolioKpis;
