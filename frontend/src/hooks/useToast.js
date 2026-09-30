import { useContext } from 'react';
import { ToastContext } from '../context/contexts';

const noop = () => null;
const FALLBACK = { success: noop, error: noop, info: noop, dismiss: noop };

/**
 * const toast = useToast();
 * toast.success('Added to watchlist'); toast.error(err.message); toast.info('Prices refreshed');
 * Optional second argument: { title, duration } (duration 0 keeps it until closed).
 */
export function useToast() {
    return useContext(ToastContext) || FALLBACK;
}

export default useToast;
