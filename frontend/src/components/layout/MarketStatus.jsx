import { useState } from 'react';
import { useInterval } from '../../hooks/useInterval';
import { marketStatus } from '../../utils/format';
import { StatusDot } from '../ui/Badge';

const TONES = { open: 'gain', pre: 'warn', after: 'warn', closed: 'neutral' };

/** US market session pill (New York time), refreshed every 30 seconds. */
export function MarketStatus({ className }) {
    const [status, setStatus] = useState(() => marketStatus(new Date()));
    useInterval(() => setStatus(marketStatus(new Date())), 30000);
    return (
        <div className={['shell-market', `is-${status.state}`, className].filter(Boolean).join(' ')} title={status.detail} data-testid="market-status">
            <StatusDot tone={TONES[status.state]} pulse={status.state !== 'closed'} />
            <span>{status.label}</span>
        </div>
    );
}

export default MarketStatus;
