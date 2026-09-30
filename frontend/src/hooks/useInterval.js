import { useEffect, useRef } from 'react';

/**
 * Calls `callback` every `delay` ms; pass delay = null to pause.
 * Always calls the latest callback without restarting the timer.
 */
export function useInterval(callback, delay) {
    const saved = useRef(callback);

    useEffect(() => {
        saved.current = callback;
    }, [callback]);

    useEffect(() => {
        if (delay === null || delay === undefined) return undefined;
        const id = setInterval(() => saved.current(), delay);
        return () => clearInterval(id);
    }, [delay]);
}

export default useInterval;
