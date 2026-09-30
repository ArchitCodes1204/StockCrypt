import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, X } from 'lucide-react';
import { IconButton } from '../ui/Button';
import { cx } from '../ui/cx';
import { SymbolSearch } from '../ui/SymbolSearch';
import { MarketStatus } from './MarketStatus';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { titleForPath } from './nav';

const isTypingTarget = (el) => el instanceof HTMLElement
    && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/**
 * Sticky top bar: menu button (phones), page title, symbol search
 * ("/" focuses it; selecting goes to /research?symbol=X), market status,
 * theme toggle and the user menu.
 */
export function Topbar({ onMenu, menuButtonRef, drawerOpen = false }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const searchRef = useRef(null);
    const [searchOpen, setSearchOpen] = useState(false); // phones: search expands over the bar

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
            if (isTypingTarget(event.target) || document.querySelector('.ui-modal-root')) return;
            event.preventDefault();
            setSearchOpen(true);
            requestAnimationFrame(() => searchRef.current?.focus());
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    const openSearch = () => {
        setSearchOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
    };

    const closeSearch = () => {
        setSearchOpen(false);
        searchRef.current?.blur();
    };

    const goToSymbol = (symbol) => {
        setSearchOpen(false);
        // `state` keeps the pre-redesign Research page working as well.
        navigate(`/research?symbol=${encodeURIComponent(symbol)}`, { state: { symbol } });
    };

    return (
        <header className={cx('shell-topbar', searchOpen && 'is-searching')}>
            <IconButton
                ref={menuButtonRef}
                icon={Menu}
                label="Open menu"
                className="shell-menu-btn"
                onClick={onMenu}
                aria-expanded={drawerOpen}
                aria-controls="shell-sidebar"
                data-testid="menu-toggle"
            />
            <div className="shell-topbar-title" aria-live="polite">{titleForPath(pathname)}</div>

            <div
                className="shell-topbar-search"
                onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
                }}
            >
                <SymbolSearch
                    ref={searchRef}
                    testId="topbar-search"
                    placeholder="Search symbols or companies"
                    aria-label="Search for a stock, ETF or crypto symbol"
                    shortcutHint="/"
                    clearOnSelect
                    blurOnSelect
                    onSelect={goToSymbol}
                    onCancel={closeSearch}
                />
                <IconButton icon={X} label="Close search" className="shell-search-cancel" onClick={closeSearch} />
            </div>

            <div className="shell-topbar-actions">
                <IconButton icon={Search} label="Search" className="shell-search-btn" onClick={openSearch} data-testid="topbar-search-toggle" />
                <MarketStatus />
                <ThemeToggle />
                <UserMenu />
            </div>
        </header>
    );
}

export default Topbar;
