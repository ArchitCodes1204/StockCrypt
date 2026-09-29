import { useContext } from 'react';
import { ThemeContext } from '../context/contexts';

const FALLBACK = { theme: 'dark', setTheme: () => {}, toggleTheme: () => {} };

/** { theme: 'dark' | 'light', toggleTheme(), setTheme(theme) } */
export function useTheme() {
    return useContext(ThemeContext) || FALLBACK;
}

export default useTheme;
