import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { cx, safeId } from './cx';
import { lockScroll } from './scrollLock';

const EXIT_MS = 190;
const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

// Only the top-most open modal reacts to Escape / Tab.
const stack = [];

function focusables(container) {
    if (!container) return [];
    return [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function firstFocusTarget(panel) {
    if (!panel) return null;
    const inBody = focusables(panel.querySelector('.ui-modal-body'));
    if (inBody.length) return inBody[0];
    const inFooter = focusables(panel.querySelector('.ui-modal-footer'));
    if (inFooter.length) return inFooter[0];
    return focusables(panel)[0] || panel;
}

/**
 * Accessible dialog rendered in a portal.
 * <Modal open={open} onClose={() => setOpen(false)} title="Add transaction" footer={<Button>Save</Button>}>...</Modal>
 * Escape and overlay click call onClose; focus moves inside and returns to the trigger on close;
 * page scroll is locked; tall content scrolls inside the body (the header never leaves the screen).
 * size: sm (420) | md (520) | lg (720) | xl (960). data-testid={testId} is on the dialog panel.
 */
export function Modal({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    size = 'md',
    testId,
    className,
    closeOnOverlay = true,
    hideCloseButton = false,
    initialFocusRef
}) {
    const [present, setPresent] = useState(open);
    const [prevOpen, setPrevOpen] = useState(open);
    if (open !== prevOpen) {
        setPrevOpen(open);
        if (open) setPresent(true);
    }
    const closing = present && !open;

    const panelRef = useRef(null);
    const pressedOverlay = useRef(false);
    const onCloseRef = useRef(onClose);
    const uid = safeId(useId());
    const titleId = `${uid}-title`;
    const descId = `${uid}-desc`;

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // Unmount after the exit animation.
    useEffect(() => {
        if (!closing) return undefined;
        const timer = setTimeout(() => setPresent(false), EXIT_MS);
        return () => clearTimeout(timer);
    }, [closing]);

    // Lock page scroll while mounted.
    useEffect(() => {
        if (!present) return undefined;
        return lockScroll();
    }, [present]);

    // Focus in on open, back to the trigger on close; Escape + focus trap.
    useEffect(() => {
        if (!open) return undefined;
        const token = {};
        stack.push(token);
        const previouslyFocused = document.activeElement;
        const frame = requestAnimationFrame(() => {
            const target = initialFocusRef?.current || firstFocusTarget(panelRef.current);
            target?.focus?.({ preventScroll: true });
        });

        const onKeyDown = (event) => {
            if (stack[stack.length - 1] !== token) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                onCloseRef.current?.();
                return;
            }
            if (event.key !== 'Tab') return;
            const items = focusables(panelRef.current);
            if (!items.length) {
                event.preventDefault();
                panelRef.current?.focus();
                return;
            }
            const first = items[0];
            const last = items[items.length - 1];
            const inside = panelRef.current?.contains(document.activeElement);
            if (event.shiftKey && (document.activeElement === first || !inside)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);

        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener('keydown', onKeyDown);
            const index = stack.indexOf(token);
            if (index !== -1) stack.splice(index, 1);
            if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
                previouslyFocused.focus({ preventScroll: true });
            }
        };
    }, [open, initialFocusRef]);

    if (!present || typeof document === 'undefined') return null;

    const showHeader = Boolean(title || description) || !hideCloseButton;

    return createPortal(
        <div className={cx('ui-modal-root', closing && 'is-closing')}>
            <div
                className="ui-modal-overlay"
                onMouseDown={(event) => {
                    pressedOverlay.current = event.target === event.currentTarget;
                }}
                onClick={(event) => {
                    if (closeOnOverlay && pressedOverlay.current && event.target === event.currentTarget) onClose?.();
                    pressedOverlay.current = false;
                }}
            >
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={title ? titleId : undefined}
                    aria-describedby={description ? descId : undefined}
                    tabIndex={-1}
                    className={cx('ui-modal', `ui-modal--${size}`, className)}
                    data-testid={testId}
                >
                    {showHeader && (
                        <div className="ui-modal-header">
                            <div className="ui-modal-heading">
                                {title && <h2 id={titleId} className="ui-modal-title">{title}</h2>}
                                {description && <p id={descId} className="ui-modal-desc">{description}</p>}
                            </div>
                            {!hideCloseButton && (
                                <IconButton
                                    icon={X}
                                    label="Close"
                                    size="sm"
                                    className="ui-modal-close"
                                    onClick={onClose}
                                    data-testid={testId ? `${testId}-close` : undefined}
                                />
                            )}
                        </div>
                    )}
                    {children !== null && children !== undefined && children !== false && children !== '' && (
                        <div className="ui-modal-body">{children}</div>
                    )}
                    {footer && <div className="ui-modal-footer">{footer}</div>}
                </div>
            </div>
        </div>,
        document.body
    );
}

export default Modal;
