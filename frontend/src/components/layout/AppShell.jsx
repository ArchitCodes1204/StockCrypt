import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { cx } from '../ui/cx';
import { lockScroll } from '../ui/scrollLock';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { titleForPath } from './nav';
import './layout.css';

/**
 * Authenticated layout: sidebar + sticky topbar + animated page outlet.
 * Pages render inside `.shell-content` (max 1360px, responsive padding): no
 * page backgrounds, no back buttons.
 */
export function AppShell() {
    const location = useLocation();
    const isPhone = useMediaQuery('(max-width: 767px)');
    const menuButtonRef = useRef(null);
    // The drawer belongs to the location it was opened on, so any navigation closes it.
    const [drawerKey, setDrawerKey] = useState(null);
    const drawerOpen = drawerKey !== null && drawerKey === location.key;

    const closeDrawer = () => {
        setDrawerKey(null);
        menuButtonRef.current?.focus();
    };

    useEffect(() => {
        if (!drawerOpen || !isPhone) return undefined;
        return lockScroll();
    }, [drawerOpen, isPhone]);

    useEffect(() => {
        if (!drawerOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setDrawerKey(null);
                menuButtonRef.current?.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [drawerOpen]);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        const title = titleForPath(location.pathname);
        document.title = title === 'StockCrypt' ? 'StockCrypt' : `${title} · StockCrypt`;
    }, [location.pathname]);

    return (
        <div className={cx('shell', drawerOpen && 'has-drawer')}>
            <a href="#main" className="shell-skip">Skip to content</a>
            <Sidebar open={drawerOpen} onClose={closeDrawer} />
            <div className={cx('shell-scrim', drawerOpen && 'is-open')} onClick={closeDrawer} aria-hidden="true" data-testid="menu-scrim" />
            <div className="shell-main-col">
                <Topbar onMenu={() => setDrawerKey(location.key)} menuButtonRef={menuButtonRef} drawerOpen={drawerOpen} />
                <main id="main" className="shell-main" tabIndex={-1}>
                    <div className="shell-content">
                        <div key={location.pathname} className="shell-page">
                            <Outlet />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default AppShell;
