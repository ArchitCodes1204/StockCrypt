import { useCallback, useSyncExternalStore } from 'react';

/**
 * Live boolean for a CSS media query, e.g. useMediaQuery('(max-width: 767px)').
 * Returns false where matchMedia is unavailable.
 */
export function useMediaQuery(query) {
    const subscribe = useCallback((onChange) => {
        if (typeof window === 'undefined' || !window.matchMedia) return () => {};
        const mql = window.matchMedia(query);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [query]);

    const getSnapshot = () => (typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia(query).matches
        : false);

    return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export default useMediaQuery;
