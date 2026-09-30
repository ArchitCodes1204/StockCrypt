import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { IconButton } from '../ui/Button';

/** Sun/Moon button; the icon spins in on every switch. */
export function ThemeToggle({ className }) {
    const { theme, toggleTheme } = useTheme();
    const dark = theme === 'dark';
    const Icon = dark ? Sun : Moon;
    return (
        <IconButton
            label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={toggleTheme}
            className={className}
            data-testid="theme-toggle"
            data-theme-state={theme}
        >
            <Icon key={theme} size={18} className="shell-theme-icon" aria-hidden="true" />
        </IconButton>
    );
}

export default ThemeToggle;
