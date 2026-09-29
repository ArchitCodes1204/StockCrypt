import { useEffect, useLayoutEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Clock, LogOut, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { IconButton } from '../ui/Button';
import { cx } from '../ui/cx';
import { Logo } from '../ui/Logo';
import { NAV_SECTIONS } from './nav';

/**
 * App navigation. >= 1200px: full sidebar; 768-1199px: icon rail with tooltips;
 * < 768px: slide-in drawer controlled by `open` / `onClose`.
 */
export function Sidebar({ open = false, onClose }) {
    const { logout } = useAuth();
    const { pathname } = useLocation();
    const navRef = useRef(null);
    const indicatorRef = useRef(null);

    // Slide the active indicator to the current link.
    useLayoutEffect(() => {
        const nav = navRef.current;
        const indicator = indicatorRef.current;
        if (!nav || !indicator) return undefined;
        const place = () => {
            const link = nav.querySelector('.shell-nav-link.is-active');
            if (!link) {
                indicator.style.opacity = '0';
                return;
            }
            const top = link.offsetTop + (link.offsetHeight - indicator.offsetHeight) / 2;
            indicator.style.opacity = '1';
            indicator.style.transform = `translateY(${Math.round(top)}px)`;
        };
        place();
        const frame = requestAnimationFrame(() => {
            indicator.dataset.ready = 'true';
        });
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
        observer?.observe(nav);
        return () => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
        };
    }, [pathname]);

    // Drawer: move focus inside when it opens.
    useEffect(() => {
        if (!open) return undefined;
        const frame = requestAnimationFrame(() => {
            const target = navRef.current?.querySelector('.shell-nav-link.is-active') || navRef.current?.querySelector('a');
            target?.focus({ preventScroll: true });
        });
        return () => cancelAnimationFrame(frame);
    }, [open]);

    return (
        <aside id="shell-sidebar" className={cx('shell-sidebar', open && 'is-open')} aria-label="Sidebar">
            <div className="shell-sidebar-inner">
                <div className="shell-brand">
                    <NavLink to="/dashboard" className="shell-brand-link" aria-label="StockCrypt home">
                        <Logo size={28} />
                    </NavLink>
                    <IconButton icon={X} label="Close menu" size="sm" className="shell-drawer-close" onClick={onClose} data-testid="menu-close" />
                </div>

                <nav className="shell-nav" ref={navRef} aria-label="Main">
                    <span className="shell-nav-indicator" ref={indicatorRef} aria-hidden="true" />
                    {NAV_SECTIONS.map((section) => (
                        <div className="shell-nav-section" key={section.label}>
                            <p className="shell-nav-label">{section.label}</p>
                            {section.items.map(({ to, label, icon, testId }) => {
                                const Icon = icon;
                                return (
                                    <NavLink
                                        key={to}
                                        to={to}
                                        data-testid={testId}
                                        className={({ isActive }) => cx('shell-nav-link', isActive && 'is-active')}
                                    >
                                        <Icon size={18} aria-hidden="true" className="shell-nav-icon" />
                                        <span className="shell-nav-text">{label}</span>
                                        <span className="shell-tip" aria-hidden="true">{label}</span>
                                    </NavLink>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div className="shell-sidebar-foot">
                    <p className="shell-data-note">
                        <Clock size={14} aria-hidden="true" />
                        <span>Market data: Yahoo Finance (delayed)</span>
                    </p>
                    <button type="button" className="shell-nav-link shell-logout" onClick={logout} data-testid="logout">
                        <LogOut size={18} aria-hidden="true" className="shell-nav-icon" />
                        <span className="shell-nav-text">Log out</span>
                        <span className="shell-tip" aria-hidden="true">Log out</span>
                    </button>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;
