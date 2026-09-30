import { useMediaQuery } from './useMediaQuery';

/** true when the user asked the OS to reduce motion. */
export function usePrefersReducedMotion() {
    return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export default usePrefersReducedMotion;
