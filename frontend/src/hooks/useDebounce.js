import { useEffect, useState } from 'react';

/** Returns `value` once it has stopped changing for `delay` ms. */
export function useDebounce(value, delay = 250) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

export default useDebounce;
