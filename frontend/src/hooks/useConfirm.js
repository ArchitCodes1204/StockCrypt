import { useContext } from 'react';
import { ConfirmContext } from '../context/contexts';

const FALLBACK = async ({ message, title } = {}) => window.confirm(message || title || 'Are you sure?');

/**
 * const confirm = useConfirm();
 * if (await confirm({ title: 'Delete transaction?', message: '...', confirmLabel: 'Delete' })) { ... }
 * Resolves true (confirmed) or false (cancelled, Escape, overlay click).
 */
export function useConfirm() {
    return useContext(ConfirmContext) || FALLBACK;
}

export default useConfirm;
