import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { safeId } from '../ui/cx';

function initialsOf(name) {
    const parts = String(name || '').trim().split(/[\s._-]+/).filter(Boolean);
    if (!parts.length) return '?';
    const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 1);
    return letters.toUpperCase();
}

/** Avatar button with a small dropdown (account details + log out). */
export function UserMenu() {
    const { user, logout } = useAuth();
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    const menuId = `${safeId(useId())}-menu`;
    const name = user?.username || 'Account';

    useEffect(() => {
        if (!open) return undefined;
        const frame = requestAnimationFrame(() => {
            menuRef.current?.querySelector('[role="menuitem"]')?.focus();
        });
        const onPointerDown = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setOpen(false);
                buttonRef.current?.focus();
            }
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <div className="shell-user" ref={rootRef}>
            <button
                ref={buttonRef}
                type="button"
                className="shell-user-btn"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                aria-label={`Account menu for ${name}`}
                onClick={() => setOpen((v) => !v)}
                data-testid="user-menu"
            >
                <span className="shell-avatar" aria-hidden="true">{initialsOf(user?.username)}</span>
                <span className="shell-user-name">{name}</span>
                <ChevronDown size={15} className="shell-user-chevron" aria-hidden="true" />
            </button>
            {open && (
                <div className="shell-user-menu" id={menuId} role="menu" ref={menuRef} aria-label="Account">
                    <div className="shell-user-head">
                        <span className="shell-avatar shell-avatar--lg" aria-hidden="true">{initialsOf(user?.username)}</span>
                        <span className="shell-user-meta">
                            <span className="shell-user-meta-name truncate">{name}</span>
                            {user?.email && <span className="shell-user-meta-email truncate">{user.email}</span>}
                        </span>
                    </div>
                    <div className="shell-menu-sep" role="separator" />
                    <button
                        type="button"
                        role="menuitem"
                        className="shell-menu-item shell-menu-item--danger"
                        onClick={() => {
                            setOpen(false);
                            logout();
                        }}
                        data-testid="user-menu-logout"
                    >
                        <LogOut size={16} aria-hidden="true" />
                        Log out
                    </button>
                </div>
            )}
        </div>
    );
}

export default UserMenu;
