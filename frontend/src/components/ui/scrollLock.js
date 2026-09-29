// Reference-counted page scroll lock shared by Modal and the mobile drawer.
// `scrollbar-gutter: stable` on <html> keeps the layout from shifting.
let locks = 0;
let previous = '';

export function lockScroll() {
    if (typeof document === 'undefined') return () => {};
    const root = document.documentElement;
    if (locks === 0) {
        previous = root.style.overflow;
        root.style.overflow = 'hidden';
    }
    locks += 1;
    let released = false;
    return () => {
        if (released) return;
        released = true;
        locks = Math.max(0, locks - 1);
        if (locks === 0) root.style.overflow = previous;
    };
}
