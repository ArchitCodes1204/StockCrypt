import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { IconButton } from '../components/ui/Button';
import { cx } from '../components/ui/cx';
import { ToastContext } from './contexts';

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const DEFAULT_DURATION = { success: 3500, info: 3500, error: 5000 };
const EXIT_MS = 200;
const MAX_VISIBLE = 4;

/**
 * Toast stack (bottom-right; bottom-center on phones). Use through useToast():
 * toast.success(message, { title, duration }) / toast.error(...) / toast.info(...)
 * duration 0 keeps the toast until it is closed. Identical visible messages are not repeated.
 */
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timers = useRef(new Map());
    const nextId = useRef(0);
    const listRef = useRef([]);

    useEffect(() => {
        listRef.current = toasts;
    }, [toasts]);

    useEffect(() => {
        const pending = timers.current;
        return () => {
            pending.forEach((timer) => clearTimeout(timer));
            pending.clear();
        };
    }, []);

    const clearTimer = useCallback((id) => {
        const timer = timers.current.get(id);
        if (timer) clearTimeout(timer);
        timers.current.delete(id);
    }, []);

    const remove = useCallback((id) => {
        clearTimer(id);
        setToasts((list) => list.filter((t) => t.id !== id));
    }, [clearTimer]);

    const dismiss = useCallback((id) => {
        clearTimer(id);
        setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
        timers.current.set(id, setTimeout(() => remove(id), EXIT_MS));
    }, [clearTimer, remove]);

    const schedule = useCallback((id, ms) => {
        clearTimer(id);
        if (ms > 0) timers.current.set(id, setTimeout(() => dismiss(id), ms));
    }, [clearTimer, dismiss]);

    const push = useCallback((tone, message, options = {}) => {
        const text = typeof message === 'string' ? message : String(message ?? '');
        if (!text && !options.title) return null;
        const duplicate = listRef.current.find((t) => !t.leaving && t.tone === tone && t.message === text && t.title === options.title);
        if (duplicate) {
            schedule(duplicate.id, duplicate.duration);
            return duplicate.id;
        }
        nextId.current += 1;
        const id = nextId.current;
        const duration = options.duration ?? DEFAULT_DURATION[tone];
        const toast = { id, tone, message: text, title: options.title, duration };
        setToasts((list) => {
            const next = [...list, toast];
            const visible = next.filter((t) => !t.leaving);
            if (visible.length > MAX_VISIBLE) {
                const drop = new Set(visible.slice(0, visible.length - MAX_VISIBLE).map((t) => t.id));
                return next.filter((t) => !drop.has(t.id));
            }
            return next;
        });
        schedule(id, duration);
        return id;
    }, [schedule]);

    const api = useMemo(() => ({
        success: (message, options) => push('success', message, options),
        error: (message, options) => push('error', message, options),
        info: (message, options) => push('info', message, options),
        dismiss
    }), [push, dismiss]);

    const viewport = (
        <div className="ui-toast-viewport" aria-live="polite" aria-relevant="additions" data-testid="toast-viewport">
            {toasts.map((t) => {
                const Icon = ICONS[t.tone] || Info;
                return (
                    <div
                        key={t.id}
                        className={cx('ui-toast', `ui-toast--${t.tone}`, t.leaving && 'is-leaving')}
                        role={t.tone === 'error' ? 'alert' : 'status'}
                        data-testid={`toast-${t.tone}`}
                        onMouseEnter={() => clearTimer(t.id)}
                        onMouseLeave={() => !t.leaving && schedule(t.id, 1800)}
                    >
                        <Icon className="ui-toast-icon" size={18} aria-hidden="true" />
                        <div className="ui-toast-body">
                            {t.title && <div className="ui-toast-title">{t.title}</div>}
                            {t.message && <div className="ui-toast-message">{t.message}</div>}
                        </div>
                        <IconButton icon={X} label="Dismiss notification" size="sm" className="ui-toast-close" onClick={() => dismiss(t.id)} />
                    </div>
                );
            })}
        </div>
    );

    return (
        <ToastContext.Provider value={api}>
            {children}
            {typeof document !== 'undefined' && createPortal(viewport, document.body)}
        </ToastContext.Provider>
    );
}

export default ToastProvider;
