import { Activity, ArrowDownRight, ArrowUpRight, Flame } from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/format';
import { AnimatedNumber, Card, ChangePill, Skeleton, SymbolAvatar } from './ui';

function pick(rows, score) {
    let best = null;
    rows.forEach((row) => {
        const value = score(row);
        if (value === null || value === undefined) return;
        if (!best || value > best.value) best = { row, value };
    });
    return best?.row || null;
}

function TileSkeleton({ index }) {
    return (
        <Card className="scr-tile fade-up" style={{ '--i': index }} aria-hidden="true">
            <Skeleton width="48%" height={12} />
            <Skeleton width="70%" height={22} radius={6} style={{ marginTop: 14 }} />
            <Skeleton width="40%" height={12} style={{ marginTop: 12 }} />
        </Card>
    );
}

function MoverTile({ label, icon, row, detail, index, onOpen, testId }) {
    if (!row) return null;
    const Icon = icon;
    return (
        <Card
            as="button"
            type="button"
            interactive
            className="scr-tile scr-tile--mover fade-up"
            style={{ '--i': index }}
            onClick={() => onOpen(row.symbol)}
            data-testid={testId}
            aria-label={`${label}: ${row.symbol}, ${formatPercent(row.changePercent)} today. Open research report`}
        >
            <span className="scr-tile-label">
                <Icon size={14} aria-hidden="true" />
                {label}
            </span>
            <span className="scr-tile-mover">
                <SymbolAvatar symbol={row.symbol} size={32} />
                <span className="scr-tile-mover-text">
                    <span className="mono scr-tile-symbol">{row.symbol}</span>
                    <span className="truncate scr-tile-name">{row.name}</span>
                </span>
            </span>
            <span className="scr-tile-foot">{detail}</span>
        </Card>
    );
}

/** Market breadth + top gainer / loser / most traded, computed from the loaded rows. */
export function ScreenerSummary({ rows, loading, noun, onOpen }) {
    if (loading) {
        return (
            <section className="scr-summary" aria-label="Market summary loading" aria-busy="true">
                {[0, 1, 2, 3].map((i) => <TileSkeleton key={i} index={i} />)}
            </section>
        );
    }
    if (!rows.length) return null;

    const up = rows.filter((r) => r.changePercent > 0).length;
    const down = rows.filter((r) => r.changePercent < 0).length;
    const flat = rows.length - up - down;
    const moves = rows.map((r) => r.changePercent).filter((v) => v !== null);
    const average = moves.length ? moves.reduce((a, b) => a + b, 0) / moves.length : null;
    const gainer = pick(rows, (r) => r.changePercent);
    const loser = pick(rows, (r) => (r.changePercent === null ? null : -r.changePercent));
    const active = pick(rows, (r) => r.traded);
    const upPct = rows.length ? (up / rows.length) * 100 : 0;
    const downPct = rows.length ? (down / rows.length) * 100 : 0;

    return (
        <section className="scr-summary" aria-label="Market summary" data-testid="scr-summary">
            <Card className="scr-tile scr-tile--breadth fade-up" style={{ '--i': 0 }}>
                <span className="scr-tile-label">
                    <Activity size={14} aria-hidden="true" />
                    Market breadth
                </span>
                <span className="scr-breadth-value num">
                    <span className="gain"><AnimatedNumber value={up} /></span>
                    <span className="scr-breadth-sep" aria-hidden="true">/</span>
                    <span className="loss"><AnimatedNumber value={down} /></span>
                    <span className="sr-only">{`${up} ${noun} up, ${down} down${flat ? `, ${flat} flat` : ''}`}</span>
                </span>
                <span className="scr-breadth-bar" aria-hidden="true">
                    <span className="scr-breadth-up" style={{ width: `${upPct}%` }} />
                    <span className="scr-breadth-down" style={{ width: `${downPct}%` }} />
                </span>
                <span className="scr-tile-foot">
                    <span>Avg move</span>
                    <ChangePill value={average} size="sm" />
                </span>
            </Card>
            <MoverTile
                label="Top gainer"
                icon={ArrowUpRight}
                row={gainer}
                index={1}
                onOpen={onOpen}
                testId="scr-top-gainer"
                detail={gainer && (
                    <>
                        <span className="num">{formatCurrency(gainer.price, gainer.currency)}</span>
                        <ChangePill value={gainer.changePercent} size="sm" />
                    </>
                )}
            />
            <MoverTile
                label="Top loser"
                icon={ArrowDownRight}
                row={loser}
                index={2}
                onOpen={onOpen}
                testId="scr-top-loser"
                detail={loser && (
                    <>
                        <span className="num">{formatCurrency(loser.price, loser.currency)}</span>
                        <ChangePill value={loser.changePercent} size="sm" />
                    </>
                )}
            />
            <MoverTile
                label="Most traded"
                icon={Flame}
                row={active}
                index={3}
                onOpen={onOpen}
                testId="scr-most-traded"
                detail={active && (
                    <span className="num">
                        {formatCurrency(active.traded, active.currency, { compact: true })}
                        <span className="muted"> traded today · {formatPercent(active.changePercent)}</span>
                    </span>
                )}
            />
        </section>
    );
}

export default ScreenerSummary;
