import { LayoutDashboard, LineChart, ListFilter, Scale, Star, Wallet } from 'lucide-react';

// Sidebar navigation. `testId` values are relied on by the E2E checks.
export const NAV_SECTIONS = [
    {
        label: 'Overview',
        items: [
            { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, testId: 'nav-dashboard' },
            { to: '/portfolio', label: 'Portfolio', icon: Wallet, testId: 'nav-portfolio' }
        ]
    },
    {
        label: 'Markets',
        items: [
            { to: '/research', label: 'Research', icon: LineChart, testId: 'nav-research' },
            { to: '/watchlist', label: 'Watchlist', icon: Star, testId: 'nav-watchlist' },
            { to: '/screener', label: 'Screener', icon: ListFilter, testId: 'nav-screener' },
            { to: '/insights', label: 'Compare', icon: Scale, testId: 'nav-compare' }
        ]
    }
];

const TITLES = {
    '/dashboard': 'Dashboard',
    '/portfolio': 'Portfolio',
    '/research': 'Research',
    '/watchlist': 'Watchlist',
    '/screener': 'Screener',
    '/insights': 'Compare',
    '/dev/ui': 'UI kit'
};

export function titleForPath(pathname) {
    const match = Object.keys(TITLES).find((path) => pathname === path || pathname.startsWith(`${path}/`));
    return match ? TITLES[match] : 'StockCrypt';
}
