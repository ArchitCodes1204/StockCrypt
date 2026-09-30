import { Card, Skeleton, SkeletonText, Spinner, SymbolAvatar } from './ui';
import './StockAnalysis.css';

function CardHead({ width = '32%' }) {
    return (
        <div className="sa-skel-head">
            <Skeleton width={32} height={32} radius={10} />
            <div className="sa-skel-lines">
                <Skeleton width={width} height={13} />
                <Skeleton width="54%" height={10} />
            </div>
        </div>
    );
}

function Rows({ count, className }) {
    return (
        <div className={className}>
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="sa-skel-row">
                    <Skeleton width={`${34 + ((i * 17) % 22)}%`} height={11} />
                    <Skeleton width={`${20 + ((i * 11) % 16)}%`} height={11} />
                </div>
            ))}
        </div>
    );
}

/**
 * Loading placeholder shaped like the StockAnalysis report (same rows and
 * card proportions). `symbol` is shown in the hero so the user sees what is loading.
 */
export default function StockAnalysisSkeleton({ symbol, variant = 'inline' }) {
    return (
        <div
            className={`sa-report sa-report--${variant === 'modal' ? 'modal' : 'inline'} sa-skeleton`}
            aria-busy="true"
            data-testid="analysis-skeleton"
        >
            <p className="sr-only" role="status">{symbol ? `Analyzing ${symbol}` : 'Loading report'}</p>
            <div className="sa-stack">
                <Card className="sa-card sa-hero">
                    <div className="sa-hero-top">
                        <div className="sa-identity">
                            {symbol ? <SymbolAvatar symbol={symbol} size={48} /> : <Skeleton width={48} height={48} radius={14} />}
                            <div className="sa-identity-text">
                                <div className="sa-title-row">
                                    {symbol ? <span className="sa-symbol mono">{symbol}</span> : <Skeleton width={96} height={24} />}
                                    <span className="sa-skel-status">
                                        <Spinner size={13} />
                                        Fetching live data
                                    </span>
                                </div>
                                <Skeleton width={200} height={13} style={{ marginTop: 8 }} />
                                <Skeleton width={150} height={11} style={{ marginTop: 8 }} />
                            </div>
                        </div>
                    </div>
                    <div className="sa-hero-bottom">
                        <div className="sa-quote">
                            <Skeleton width={180} height={40} radius={10} />
                            <div className="sa-quote-line">
                                <Skeleton width={76} height={28} radius={999} />
                                <Skeleton width={64} height={14} />
                            </div>
                        </div>
                        <div className="sa-actions">
                            <Skeleton width={150} height={38} radius={10} />
                            <Skeleton width={110} height={38} radius={10} />
                            <Skeleton width={150} height={38} radius={10} />
                        </div>
                    </div>
                </Card>

                <div className="sa-row sa-row--wide-left">
                    <Card className="sa-card">
                        <CardHead width="18%" />
                        <Skeleton width={180} height={24} radius={999} style={{ marginBottom: 16 }} />
                        <Skeleton height={300} radius={12} />
                    </Card>
                    <Card className="sa-card">
                        <CardHead width="40%" />
                        <Rows count={7} className="sa-skel-rows" />
                        <Skeleton height={6} radius={999} style={{ marginTop: 40 }} />
                    </Card>
                </div>

                <Card className="sa-card">
                    <CardHead width="14%" />
                    <div className="sa-skel-tiles">
                        <Skeleton height={86} radius={12} />
                        <Skeleton height={86} radius={12} />
                        <Skeleton height={86} radius={12} />
                    </div>
                    <div className="sa-skel-split">
                        <SkeletonText lines={5} lineHeight={11} gap={14} />
                        <Rows count={5} className="sa-skel-rows" />
                    </div>
                </Card>

                <div className="sa-row sa-row--wide-right">
                    <Card className="sa-card">
                        <CardHead width="24%" />
                        <div className="sa-skel-gauge"><Skeleton width={184} height={96} radius="96px 96px 0 0" /></div>
                        <Rows count={3} className="sa-skel-rows" />
                    </Card>
                    <Card className="sa-card">
                        <CardHead width="22%" />
                        <div className="sa-skel-split">
                            <div className="sa-skel-gauge"><Skeleton width={164} height={86} radius="86px 86px 0 0" /></div>
                            <Rows count={3} className="sa-skel-rows" />
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
