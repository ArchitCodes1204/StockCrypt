import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { ThemeContext } from './contexts';

const STORAGE_KEY = 'sc-theme';
const THEME_COLORS = { dark: '#0A0D12', light: '#F6F5F0' };

const normalize = (theme) => (theme === 'light' ? 'light' : 'dark');

function readInitialTheme() {
    if (typeof document !== 'undefined') {
        const attr = document.documentElement.dataset.theme;
        if (attr === 'light' || attr === 'dark') return attr;
    }
    try {
        return normalize(localStorage.getItem(STORAGE_KEY));
    } catch {
        return 'dark';
    }
}

function applyTheme(theme) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
}

function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Dark (default) / light theme. Persists to localStorage 'sc-theme', sets
 * <html data-theme> and the theme-color meta. index.html applies the saved
 * theme before first paint. Use it through useTheme() from src/hooks.
 */
export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(readInitialTheme);

    useEffect(() => {
        applyTheme(theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            /* storage unavailable: theme still applies for this session */
        }
    }, [theme]);

    // Keep several open tabs in sync.
    useEffect(() => {
        const onStorage = (event) => {
            if (event.key === STORAGE_KEY && event.newValue) setThemeState(normalize(event.newValue));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const setTheme = useCallback((next) => {
        const value = normalize(next);
        if (document.documentElement.dataset.theme === value) {
            setThemeState(value);
            return;
        }
        const commit = () => {
            applyTheme(value);
            flushSync(() => setThemeState(value));
        };
        if (typeof document.startViewTransition === 'function' && !prefersReducedMotion()) {
            document.startViewTransition(commit);
        } else {
            commit();
        }
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    }, [setTheme]);

    const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default ThemeProvider;
