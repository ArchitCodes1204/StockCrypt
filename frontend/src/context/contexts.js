import { createContext } from 'react';

// Context objects live in a plain .js module so the provider files export
// components only (keeps React Fast Refresh working). Read them through the
// hooks in src/hooks: useTheme(), useToast(), useConfirm().
export const ThemeContext = createContext(null);
export const ToastContext = createContext(null);
export const ConfirmContext = createContext(null);
