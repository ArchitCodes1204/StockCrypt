import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ConfirmContext } from './contexts';

const DEFAULTS = {
    title: 'Are you sure?',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    tone: 'danger'
};

/**
 * Promise-based confirmation dialog. Use through useConfirm():
 * const ok = await confirm({ title, message, confirmLabel: 'Delete', cancelLabel: 'Cancel', tone: 'danger' | 'primary' });
 * data-testid: confirm-dialog, confirm-ok, confirm-cancel.
 */
export function ConfirmProvider({ children }) {
    const [request, setRequest] = useState(null);
    const [open, setOpen] = useState(false);
    const resolver = useRef(null);
    const cancelRef = useRef(null);
    const okRef = useRef(null);

    const settle = useCallback((result) => {
        const resolve = resolver.current;
        resolver.current = null;
        setOpen(false);
        resolve?.(result);
    }, []);

    const confirm = useCallback((options = {}) => new Promise((resolve) => {
        resolver.current?.(false); // a newer request replaces an unanswered one
        resolver.current = resolve;
        setRequest({ ...DEFAULTS, ...options });
        setOpen(true);
    }), []);

    useEffect(() => () => resolver.current?.(false), []);

    const current = request || DEFAULTS;
    const danger = current.tone !== 'primary';

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <Modal
                open={open}
                onClose={() => settle(false)}
                title={current.title}
                size="sm"
                testId="confirm-dialog"
                initialFocusRef={danger ? cancelRef : okRef}
                footer={(
                    <>
                        <Button ref={cancelRef} variant="secondary" onClick={() => settle(false)} data-testid="confirm-cancel">
                            {current.cancelLabel}
                        </Button>
                        <Button ref={okRef} variant={danger ? 'danger' : 'primary'} onClick={() => settle(true)} data-testid="confirm-ok">
                            {current.confirmLabel}
                        </Button>
                    </>
                )}
            >
                {current.message && <p className="ui-confirm-message">{current.message}</p>}
            </Modal>
        </ConfirmContext.Provider>
    );
}

export default ConfirmProvider;
