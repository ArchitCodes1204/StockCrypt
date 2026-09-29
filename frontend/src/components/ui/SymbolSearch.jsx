import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { CornerDownLeft, Search, X } from 'lucide-react';
import stockApi from '../../services/stockApi';
import { cx, safeId } from './cx';
import { Spinner } from './Spinner';
import { SymbolAvatar } from './SymbolAvatar';

const DEBOUNCE_MS = 250;
const MAX_RESULTS = 8;
const cache = new Map(); // lower-cased query -> results (per page load)

const TYPE_LABELS = { cryptocurrency: 'Crypto', equity: 'Stock', etf: 'ETF', index: 'Index', mutualfund: 'Fund', currency: 'FX', future: 'Future' };

function typeLabel(type) {
    if (!type) return '';
    return TYPE_LABELS[String(type).toLowerCase().replace(/\s+/g, '')] || type;
}

/** 'AAPL', 'BRK.B', 'BTC-USD', 'RELIANCE.NS', '^GSPC' look like tickers; 'microsoft' does not. */
function isPlausibleSymbol(text) {
    const s = String(text || '').trim().toUpperCase();
    if (!s || s.length > 15) return false;
    if (!/^\^?[A-Z0-9]{1,10}(?:[.\-=][A-Z0-9]{1,5})?$/.test(s)) return false;
    const [main, suffix] = s.replace(/^\^/, '').split(/[.\-=]/);
    return Boolean(suffix) || !/^[A-Z]+$/.test(main) || main.length <= 5;
}

/**
 * Ticker/company search with debounced suggestions (stockApi.searchSymbols).
 * - Enter selects the highlighted option; with none highlighted it selects the
 *   typed text upper-cased. Arrow keys move, Escape closes (then calls onCancel).
 * - `ref` points at the <input> (use it to focus programmatically).
 * - data-testid: `${testId}` on the input, `${testId}-list` on the listbox,
 *   `${testId}-option-${SYMBOL}` on each option.
 *
 * <SymbolSearch onSelect={(symbol, item) => navigate(`/research?symbol=${symbol}`)} clearOnSelect />
 */
export function SymbolSearch({
    ref,
    value,
    onChange,
    onSelect,
    onCancel,
    placeholder = 'Search stocks, ETFs or crypto',
    size = 'md',
    autoFocus = false,
    clearOnSelect = false,
    blurOnSelect = false,
    shortcutHint,
    disabled = false,
    testId,
    name,
    id,
    className,
    'aria-label': ariaLabel
}) {
    const controlled = value !== undefined;
    const [innerText, setInnerText] = useState('');
    const text = controlled ? String(value ?? '') : innerText;

    const [open, setOpen] = useState(false);
    const [results, setResults] = useState([]);
    const [status, setStatus] = useState('idle'); // idle | loading | done | error
    const [active, setActive] = useState(null); // null = automatic (exact match, else first option)

    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const timerRef = useRef(0);
    const requestRef = useRef(0);
    const baseId = safeId(useId());
    const listId = `${baseId}-list`;

    useImperativeHandle(ref, () => inputRef.current, []);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    // Close on outside press.
    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    const query = text.trim();
    const upper = query.toUpperCase();
    const exactMatch = results.some((r) => String(r.symbol || '').toUpperCase() === upper);
    const showTyped = isPlausibleSymbol(query) && !exactMatch;

    const options = [
        ...(showTyped ? [{ kind: 'typed', symbol: upper, item: null }] : []),
        ...results.map((item) => ({ kind: 'result', symbol: String(item.symbol || '').toUpperCase(), item }))
    ];
    const exactIndex = options.findIndex((o) => o.kind === 'result' && o.symbol === upper);
    const autoIndex = exactIndex >= 0 ? exactIndex : 0;
    const activeIndex = options.length ? Math.min(Math.max(active ?? autoIndex, 0), options.length - 1) : -1;
    const listVisible = open && query.length > 0 && (options.length > 0 || status !== 'idle');

    const runSearch = (q) => {
        const key = q.toLowerCase();
        if (cache.has(key)) {
            setResults(cache.get(key));
            setStatus('done');
            return;
        }
        const requestId = ++requestRef.current;
        setStatus('loading');
        Promise.resolve()
            .then(() => stockApi.searchSymbols(q))
            .then((list) => {
                const items = (Array.isArray(list) ? list : []).filter((r) => r && r.symbol).slice(0, MAX_RESULTS);
                cache.set(key, items);
                if (requestRef.current !== requestId) return;
                setResults(items);
                setStatus('done');
            })
            .catch(() => {
                if (requestRef.current !== requestId) return;
                setResults([]);
                setStatus('error');
            });
    };

    const setText = (next) => {
        if (!controlled) setInnerText(next);
        onChange?.(next);
    };

    const handleChange = (event) => {
        const next = event.target.value;
        setText(next);
        setOpen(true);
        setActive(null);
        clearTimeout(timerRef.current);
        const q = next.trim();
        if (!q) {
            requestRef.current += 1;
            setResults([]);
            setStatus('idle');
            return;
        }
        timerRef.current = setTimeout(() => runSearch(q), DEBOUNCE_MS);
    };

    const commit = (symbol, item = null) => {
        const s = String(symbol || '').trim().toUpperCase();
        if (!s) return;
        clearTimeout(timerRef.current);
        setOpen(false);
        setText(clearOnSelect ? '' : s);
        if (clearOnSelect) {
            setResults([]);
            setStatus('idle');
        }
        onSelect?.(s, item);
        if (blurOnSelect) inputRef.current?.blur();
    };

    const clear = () => {
        clearTimeout(timerRef.current);
        requestRef.current += 1;
        setText('');
        setResults([]);
        setStatus('idle');
        setOpen(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (event) => {
        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowUp': {
                event.preventDefault();
                if (!open) {
                    setOpen(true);
                    return;
                }
                if (!options.length) return;
                const step = event.key === 'ArrowDown' ? 1 : -1;
                setActive((activeIndex + step + options.length) % options.length);
                return;
            }
            case 'Enter': {
                if (event.nativeEvent.isComposing) return;
                event.preventDefault();
                const option = listVisible && activeIndex >= 0 ? options[activeIndex] : null;
                if (option) commit(option.symbol, option.item);
                else if (query) commit(query);
                return;
            }
            case 'Escape':
                if (listVisible) {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(false);
                } else {
                    onCancel?.();
                }
                return;
            case 'Tab':
                setOpen(false);
                return;
            default:
        }
    };

    const optionId = (index) => `${baseId}-opt-${index}`;
    const iconSize = size === 'lg' ? 18 : 16;

    return (
        <div ref={rootRef} className={cx('ui-search', `ui-search--${size}`, listVisible && 'is-open', className)}>
            <Search className="ui-search-icon" size={iconSize} aria-hidden="true" />
            <input
                ref={inputRef}
                id={id}
                name={name}
                type="search"
                className="ui-search-input"
                value={text}
                placeholder={placeholder}
                autoFocus={autoFocus}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="search"
                disabled={disabled}
                role="combobox"
                aria-label={ariaLabel || placeholder}
                aria-expanded={listVisible}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={listVisible && activeIndex >= 0 ? optionId(activeIndex) : undefined}
                data-testid={testId}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => query && setOpen(true)}
            />
            <div className="ui-search-trail">
                {status === 'loading' && <Spinner size={14} />}
                {text ? (
                    <button type="button" className="ui-search-clear" aria-label="Clear search" onClick={clear} tabIndex={-1}>
                        <X size={14} aria-hidden="true" />
                    </button>
                ) : (
                    shortcutHint && <kbd className="ui-kbd" aria-hidden="true">{shortcutHint}</kbd>
                )}
            </div>
            {listVisible && (
                <ul
                    id={listId}
                    role="listbox"
                    aria-label="Symbol suggestions"
                    className="ui-search-list"
                    data-testid={testId ? `${testId}-list` : undefined}
                >
                    {options.map((option, index) => {
                        const isActive = index === activeIndex;
                        const common = {
                            id: optionId(index),
                            role: 'option',
                            'aria-selected': isActive,
                            'data-testid': testId ? `${testId}-option-${option.symbol}` : undefined,
                            onMouseEnter: () => setActive(index),
                            onMouseDown: (e) => e.preventDefault(),
                            onClick: () => commit(option.symbol, option.item)
                        };
                        if (option.kind === 'typed') {
                            return (
                                <li key="__typed" {...common} className={cx('ui-search-option', 'is-typed', isActive && 'is-active')}>
                                    <span className="ui-search-typed-icon" aria-hidden="true">
                                        <CornerDownLeft size={14} />
                                    </span>
                                    <span className="ui-search-typed-text">
                                        Press Enter to search <span className="mono">{option.symbol}</span>
                                    </span>
                                </li>
                            );
                        }
                        const { item } = option;
                        const meta = [item.exchange, typeLabel(item.type)].filter(Boolean).join(' · ');
                        return (
                            <li key={option.symbol + index} {...common} className={cx('ui-search-option', isActive && 'is-active')}>
                                <SymbolAvatar symbol={option.symbol} size={30} />
                                <span className="ui-search-option-main">
                                    <span className="ui-search-option-symbol">{option.symbol}</span>
                                    {item.name && <span className="ui-search-option-name">{item.name}</span>}
                                </span>
                                {meta && <span className="ui-search-option-meta">{meta}</span>}
                            </li>
                        );
                    })}
                    {status === 'loading' && results.length === 0 && (
                        <li className="ui-search-note" role="presentation">Searching…</li>
                    )}
                    {status === 'done' && results.length === 0 && (
                        <li className="ui-search-note" role="presentation">No matches for “{query}”</li>
                    )}
                    {status === 'error' && (
                        <li className="ui-search-note" role="presentation">Suggestions are unavailable right now</li>
                    )}
                </ul>
            )}
        </div>
    );
}

export default SymbolSearch;
