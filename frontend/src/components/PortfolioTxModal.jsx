import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Lock } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import portfolioApi from '../services/portfolioApi';
import stockApi from '../services/stockApi';
import { formatCurrency, formatDate, toNumber } from '../utils/format';
import {
    Button,
    ChangePill,
    Field,
    Modal,
    SegmentedControl,
    Skeleton,
    SymbolAvatar,
    SymbolSearch,
    cx
} from './ui';
import { safeId } from './ui/cx';
import { SYMBOL_PATTERN, formatQty, formatSignedCurrency, toneOf, txDateKey, txTotal, unitLabel } from './PortfolioUtils';

const TYPE_OPTIONS = [
    { label: 'Buy', value: 'BUY' },
    { label: 'Sell', value: 'SELL' }
];

const NOTES_MAX = 500;
const FIELD_ORDER = ['symbol', 'quantity', 'price', 'date'];

const cleanSymbol = (s) => String(s || '').trim().toUpperCase();
const numericText = (value) => (value === null || value === undefined ? '' : String(value));

function initialForm(mode, initial, today) {
    if (mode === 'edit' && initial) {
        return {
            symbol: cleanSymbol(initial.symbol),
            type: initial.type === 'SELL' ? 'SELL' : 'BUY',
            quantity: numericText(initial.quantity),
            price: numericText(initial.pricePerShare),
            date: txDateKey(initial.transactionDate) || today,
            notes: initial.notes || '',
            priceTouched: true
        };
    }
    return {
        symbol: cleanSymbol(initial?.symbol),
        type: initial?.type === 'SELL' ? 'SELL' : 'BUY',
        quantity: '',
        price: '',
        date: today,
        notes: '',
        priceTouched: false
    };
}

function validate(form, { editing, holding, quote, today }) {
    const errors = {};
    const symbol = cleanSymbol(form.symbol);
    if (!editing) {
        if (!symbol) errors.symbol = 'Choose a symbol';
        else if (!SYMBOL_PATTERN.test(symbol)) errors.symbol = 'Enter a ticker such as AAPL or BTC-USD';
        else if (quote.status === 'notfound' && quote.symbol === symbol) errors.symbol = `No market data found for ${symbol}. Check the ticker.`;
        else if (form.type === 'SELL' && !holding) errors.symbol = `You don't hold any ${symbol} to sell`;
    }

    const qty = toNumber(form.quantity);
    if (!String(form.quantity).trim()) errors.quantity = 'Enter a quantity';
    else if (qty === null || qty <= 0) errors.quantity = 'Quantity must be more than 0';
    else if (!editing && form.type === 'SELL' && holding && qty > holding.totalShares + 1e-9) {
        errors.quantity = `You only hold ${formatQty(holding.totalShares)} ${unitLabel(symbol, holding.totalShares)}`;
    }

    const price = toNumber(form.price);
    if (!String(form.price).trim()) errors.price = 'Enter a price';
    else if (price === null || price <= 0) errors.price = 'Price must be more than 0';

    if (!form.date) errors.date = 'Pick a date';
    else if (form.date > today) errors.date = "The date can't be in the future";
    else if (form.date < '1970-01-01') errors.date = 'Pick a later date';

    return errors;
}

/** Order-ticket style panel: market quote, live total and the effect on the position. */
function TicketPanel({ editing, initial, form, quote, holding, currency, onUseMarket }) {
    const symbol = cleanSymbol(form.symbol);
    const qty = toNumber(form.quantity);
    const price = toNumber(form.price);
    const total = qty > 0 && price > 0 ? qty * price : null;
    const buying = form.type === 'BUY';
    const q = quote.status === 'ready' && quote.symbol === symbol ? quote.data : null;
    const marketDiffers = q && toNumber(q.price) !== null && toNumber(q.price) !== price;

    let impact = null;
    if (editing && initial) {
        const before = txTotal(initial);
        impact = (
            <dl className="pf-ticket-lines">
                <div>
                    <dt>Recorded total</dt>
                    <dd className="num">{formatCurrency(before, currency)}</dd>
                </div>
                {total !== null && before !== null && Math.abs(total - before) >= 0.005 && (
                    <div>
                        <dt>Difference</dt>
                        <dd className="num">{formatSignedCurrency(total - before, currency)}</dd>
                    </div>
                )}
            </dl>
        );
    } else if (symbol && total !== null) {
        if (buying && holding) {
            const shares = holding.totalShares + qty;
            const avg = (holding.totalInvested + total) / shares;
            impact = (
                <dl className="pf-ticket-lines">
                    <div>
                        <dt>Position after</dt>
                        <dd className="num">{formatQty(shares)} {unitLabel(symbol, shares)}</dd>
                    </div>
                    <div>
                        <dt>Average cost</dt>
                        <dd className="num pf-ticket-change">
                            <span className="muted">{formatCurrency(holding.averageBuyPrice, currency)}</span>
                            <ArrowRight size={12} aria-label="becomes" />
                            <span>{formatCurrency(avg, currency)}</span>
                        </dd>
                    </div>
                </dl>
            );
        } else if (buying) {
            impact = (
                <dl className="pf-ticket-lines">
                    <div>
                        <dt>Position after</dt>
                        <dd className="num">{formatQty(qty)} {unitLabel(symbol, qty)}</dd>
                    </div>
                    <div>
                        <dt>Average cost</dt>
                        <dd className="num">{formatCurrency(price, currency)}</dd>
                    </div>
                </dl>
            );
        } else if (holding && qty <= holding.totalShares + 1e-9) {
            const realized = (price - holding.averageBuyPrice) * qty;
            const left = Math.max(0, holding.totalShares - qty);
            impact = (
                <dl className="pf-ticket-lines">
                    <div>
                        <dt>Realized P/L</dt>
                        <dd className={cx('num', toneOf(realized))}>{formatSignedCurrency(realized, currency)}</dd>
                    </div>
                    <div>
                        <dt>Position after</dt>
                        <dd className="num">{left > 0 ? `${formatQty(left)} ${unitLabel(symbol, left)}` : 'Closed'}</dd>
                    </div>
                </dl>
            );
        }
    }

    return (
        <aside className="pf-ticket" aria-label="Order summary">
            <div className="pf-ticket-quote">
                {editing ? (
                    <div className="pf-ticket-asset">
                        <SymbolAvatar symbol={symbol} size={36} />
                        <span className="pf-ticket-asset-text">
                            <span className="mono pf-strong">{symbol}</span>
                            <span className="pf-small muted">
                                {buying ? 'Buy' : 'Sell'} recorded {formatDate(txDateKey(initial?.transactionDate), 'medium')}
                            </span>
                        </span>
                    </div>
                ) : !symbol || quote.status === 'idle' ? (
                    <p className="pf-ticket-hint">Pick a symbol to see its latest market price.</p>
                ) : quote.status === 'loading' && quote.symbol === symbol ? (
                    <div className="pf-ticket-asset" aria-busy="true">
                        <Skeleton width={36} height={36} radius={11} />
                        <span className="pf-ticket-asset-text">
                            <Skeleton width={64} height={13} />
                            <Skeleton width={120} height={11} />
                        </span>
                    </div>
                ) : q ? (
                    <>
                        <div className="pf-ticket-asset">
                            <SymbolAvatar symbol={symbol} size={36} />
                            <span className="pf-ticket-asset-text">
                                <span className="mono pf-strong">{symbol}</span>
                                {q.name && <span className="pf-small muted truncate">{q.name}</span>}
                            </span>
                        </div>
                        <div className="pf-ticket-price">
                            <span className="num pf-strong">{formatCurrency(q.price, q.currency || currency)}</span>
                            <ChangePill value={q.changePercent} size="sm" />
                        </div>
                        {marketDiffers && (
                            <Button variant="secondary" size="sm" fullWidth onClick={onUseMarket} data-testid="tx-use-market">
                                Use market price
                            </Button>
                        )}
                    </>
                ) : quote.status === 'error' && quote.symbol === symbol ? (
                    <p className="pf-ticket-hint">Live price unavailable right now. Enter the price you paid.</p>
                ) : (
                    <p className="pf-ticket-hint">Pick a symbol to see its latest market price.</p>
                )}
            </div>

            <div className="pf-ticket-total">
                <span className="pf-ticket-label">{buying ? 'Total cost' : 'Total proceeds'}</span>
                <span className="pf-ticket-amount num" data-testid="tx-total">{formatCurrency(total ?? 0, currency)}</span>
                <span className="pf-small muted num">
                    {qty > 0 ? formatQty(qty) : '0'} × {price > 0 ? formatCurrency(price, currency) : formatCurrency(0, currency)}
                </span>
            </div>
            {impact}
        </aside>
    );
}

/**
 * Add / edit transaction dialog. Mount it with a fresh `key` per opening so the form resets.
 * mode 'add': initial = { symbol?, type? }. mode 'edit': initial = the transaction document.
 */
export function PortfolioTxModal({ open, mode = 'add', initial, holdingsBySymbol, token, onClose, onSaved }) {
    const toast = useToast();
    const editing = mode === 'edit';
    const uid = safeId(useId());
    const formId = `${uid}-form`;
    const [today] = useState(() => new Date());
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const [form, setForm] = useState(() => initialForm(mode, initial, todayStr));
    const initialSymbol = cleanSymbol(initial?.symbol);
    const [quote, setQuote] = useState(() => (!editing && SYMBOL_PATTERN.test(initialSymbol)
        ? { status: 'loading', symbol: initialSymbol, data: null }
        : { status: 'idle', symbol: '', data: null }));
    const [touched, setTouched] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState('');

    const symbolRef = useRef(null);
    const qtyRef = useRef(null);
    const priceRef = useRef(null);
    const dateRef = useRef(null);
    const focusRef = editing || initialSymbol ? qtyRef : symbolRef;

    const symbol = cleanSymbol(form.symbol);
    const holding = holdingsBySymbol?.[symbol] || null;
    const q = quote.status === 'ready' && quote.symbol === symbol ? quote.data : null;
    const currency = q?.currency || 'USD';
    const errors = validate(form, { editing, holding, quote, today: todayStr });
    const show = (field) => (submitted || touched[field]) && errors[field];

    const fetchQuote = (sym) => stockApi.getQuote(sym).then(
        (data) => {
            setQuote((current) => (current.symbol === sym ? { status: 'ready', symbol: sym, data } : current));
            const price = toNumber(data?.price);
            if (price !== null && price > 0) {
                setForm((f) => (f.priceTouched || cleanSymbol(f.symbol) !== sym ? f : { ...f, price: String(price) }));
            }
        },
        (err) => {
            const notFound = /no data found|not found/i.test(err?.message || '');
            setQuote((current) => (current.symbol === sym ? { status: notFound ? 'notfound' : 'error', symbol: sym, data: null } : current));
        }
    );

    const loadInitialQuote = useEffectEvent(() => {
        if (!editing && SYMBOL_PATTERN.test(initialSymbol)) fetchQuote(initialSymbol);
    });
    useEffect(() => {
        loadInitialQuote();
    }, []);

    const lookup = (raw) => {
        const sym = cleanSymbol(raw);
        if (!sym || !SYMBOL_PATTERN.test(sym)) return;
        if (quote.symbol === sym && quote.status !== 'error') return;
        setQuote({ status: 'loading', symbol: sym, data: null });
        fetchQuote(sym);
    };

    const update = (patch) => {
        setServerError('');
        setForm((f) => ({ ...f, ...patch }));
    };

    const onSymbolChange = (text) => {
        const sym = cleanSymbol(text);
        setServerError('');
        setForm((f) => ({
            ...f,
            symbol: text,
            price: !f.priceTouched && sym !== quote.symbol ? '' : f.price
        }));
        if (sym !== quote.symbol && quote.status !== 'idle') setQuote({ status: 'idle', symbol: '', data: null });
    };

    const onSymbolSelect = (sym) => {
        setForm((f) => ({ ...f, symbol: sym }));
        setTouched((t) => ({ ...t, symbol: true }));
        lookup(sym);
        requestAnimationFrame(() => qtyRef.current?.focus());
    };

    const useMarketPrice = () => {
        if (!q) return;
        update({ price: String(q.price), priceTouched: false });
        priceRef.current?.focus();
    };

    const focusField = (field) => {
        const target = { symbol: symbolRef, quantity: qtyRef, price: priceRef, date: dateRef }[field];
        target?.current?.focus();
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (saving) return;
        setSubmitted(true);
        const firstInvalid = FIELD_ORDER.find((f) => errors[f]);
        if (firstInvalid) {
            focusField(firstInvalid);
            return;
        }
        const quantity = toNumber(form.quantity);
        const pricePerShare = toNumber(form.price);
        const notes = form.notes.trim();
        setSaving(true);
        setServerError('');
        try {
            if (editing) {
                await portfolioApi.updateTransaction(initial._id, {
                    quantity,
                    pricePerShare,
                    notes,
                    transactionDate: form.date
                }, token);
                toast.success(`${form.type === 'BUY' ? 'Buy' : 'Sell'} of ${symbol} on ${formatDate(form.date, 'medium')} saved.`, { title: 'Transaction updated' });
            } else {
                await portfolioApi.createTransaction({
                    symbol,
                    type: form.type,
                    quantity,
                    pricePerShare,
                    transactionDate: form.date,
                    notes
                }, token);
                const verb = form.type === 'BUY' ? 'Bought' : 'Sold';
                toast.success(`${verb} ${formatQty(quantity)} ${symbol} at ${formatCurrency(pricePerShare, currency)}.`, { title: 'Transaction added' });
            }
            onSaved?.();
        } catch (err) {
            setServerError(err?.message || 'Something went wrong. Please try again.');
            setSaving(false);
        }
    };

    const close = () => {
        if (!saving) onClose?.();
    };

    const sellAll = holding && !editing && form.type === 'SELL' ? (
        <button
            type="button"
            className="pf-link-btn"
            onClick={() => update({ quantity: String(holding.totalShares) })}
            data-testid="tx-sell-all"
        >
            Sell all
        </button>
    ) : null;
    const qtyError = show('quantity');
    const qtyErrorNode = qtyError && sellAll && /only hold/.test(qtyError)
        ? <span className="pf-hint-row"><span>{qtyError}</span>{sellAll}</span>
        : qtyError;

    const heldHint = holding
        ? (
            <span className="pf-hint-row">
                <span>You hold {formatQty(holding.totalShares)} {unitLabel(symbol, holding.totalShares)}</span>
                {sellAll}
            </span>
        )
        : 'Fractional amounts are fine';

    return (
        <Modal
            open={open}
            onClose={close}
            size="lg"
            testId="tx-form"
            className="pf-modal"
            initialFocusRef={focusRef}
            title={editing ? 'Edit transaction' : 'Add transaction'}
            description={editing
                ? 'Change the quantity, price, date or notes. Your holding is recalculated from all its transactions.'
                : 'Record a buy or sell. The price is prefilled from the latest market quote.'}
            footer={(
                <>
                    <Button variant="secondary" onClick={close} disabled={saving} data-testid="tx-cancel">Cancel</Button>
                    <Button type="submit" form={formId} loading={saving} data-testid="tx-submit">
                        {editing ? 'Save changes' : form.type === 'BUY' ? 'Record buy' : 'Record sell'}
                    </Button>
                </>
            )}
        >
            <form id={formId} className="pf-form" onSubmit={handleSubmit} noValidate>
                {serverError && (
                    <div className="pf-form-alert" role="alert" data-testid="tx-error">
                        <AlertCircle size={16} aria-hidden="true" />
                        <span>{serverError}</span>
                    </div>
                )}
                <div className="pf-form-grid">
                    <div className="pf-form-fields">
                        <div className="ui-field">
                            <span className="ui-field-label" id={`${uid}-type`}>
                                Type
                                {editing && <Lock size={12} className="pf-lock" aria-label="Locked" />}
                            </span>
                            <SegmentedControl
                                fullWidth
                                options={TYPE_OPTIONS.map((o) => ({ ...o, disabled: editing && o.value !== form.type }))}
                                value={form.type}
                                onChange={(type) => update({ type })}
                                testId="tx-type"
                                aria-label="Transaction type"
                                className={cx('pf-type-seg', form.type === 'SELL' && 'is-sell')}
                            />
                        </div>

                        <Field
                            label="Symbol"
                            htmlFor={`${uid}-symbol`}
                            required={!editing}
                            error={editing ? undefined : show('symbol')}
                            hint={editing ? "Symbol and type can't be changed. Delete the transaction and add a new one instead." : undefined}
                        >
                            {editing ? (
                                <div className="ui-input-group">
                                    <Lock size={14} className="ui-input-icon" aria-hidden="true" />
                                    <input
                                        id={`${uid}-symbol`}
                                        className="ui-input mono pf-symbol-locked"
                                        value={symbol}
                                        readOnly
                                        disabled
                                        data-testid="tx-symbol"
                                    />
                                </div>
                            ) : (
                                <div
                                    className="pf-symbol-wrap"
                                    onBlur={(e) => {
                                        if (e.currentTarget.contains(e.relatedTarget)) return;
                                        setTouched((t) => ({ ...t, symbol: true }));
                                        lookup(form.symbol);
                                    }}
                                >
                                    <SymbolSearch
                                        ref={symbolRef}
                                        id={`${uid}-symbol`}
                                        value={form.symbol}
                                        onChange={onSymbolChange}
                                        onSelect={onSymbolSelect}
                                        placeholder="Search AAPL, Tesla, BTC-USD…"
                                        testId="tx-symbol"
                                        aria-label="Symbol"
                                    />
                                </div>
                            )}
                        </Field>

                        <div className="pf-form-pair">
                            <Field label="Quantity" htmlFor={`${uid}-qty`} required error={qtyErrorNode} hint={heldHint}>
                                <input
                                    ref={qtyRef}
                                    id={`${uid}-qty`}
                                    className="ui-input num"
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="any"
                                    placeholder="10"
                                    value={form.quantity}
                                    onChange={(e) => update({ quantity: e.target.value })}
                                    onBlur={() => setTouched((t) => ({ ...t, quantity: true }))}
                                    aria-invalid={Boolean(qtyError) || undefined}
                                    data-testid="tx-quantity"
                                />
                            </Field>
                            <Field
                                label={unitLabel(symbol, 2) === 'shares' ? 'Price per share' : 'Price per coin'}
                                htmlFor={`${uid}-price`}
                                required
                                error={show('price')}
                                hint={q && !editing ? `Market: ${formatCurrency(q.price, currency)}` : undefined}
                            >
                                <div className="ui-input-group">
                                    <input
                                        ref={priceRef}
                                        id={`${uid}-price`}
                                        className="ui-input num"
                                        type="number"
                                        inputMode="decimal"
                                        min="0"
                                        step="any"
                                        placeholder="0.00"
                                        value={form.price}
                                        onChange={(e) => update({ price: e.target.value, priceTouched: true })}
                                        onBlur={() => setTouched((t) => ({ ...t, price: true }))}
                                        aria-invalid={Boolean(show('price')) || undefined}
                                        data-testid="tx-price"
                                    />
                                    <span className="ui-input-suffix">{currency}</span>
                                </div>
                            </Field>
                        </div>

                        <Field label="Date" htmlFor={`${uid}-date`} required error={show('date')}>
                            <input
                                ref={dateRef}
                                id={`${uid}-date`}
                                className="ui-input num"
                                type="date"
                                max={todayStr}
                                value={form.date}
                                onChange={(e) => update({ date: e.target.value })}
                                onBlur={() => setTouched((t) => ({ ...t, date: true }))}
                                aria-invalid={Boolean(show('date')) || undefined}
                                data-testid="tx-date"
                            />
                        </Field>
                    </div>

                    <TicketPanel
                        editing={editing}
                        initial={initial}
                        form={form}
                        quote={quote}
                        holding={holding}
                        currency={currency}
                        onUseMarket={useMarketPrice}
                    />

                    <Field
                        className="pf-form-notes"
                        label="Notes"
                        optional
                        hint={form.notes.length > NOTES_MAX - 100 ? `${form.notes.length}/${NOTES_MAX}` : undefined}
                    >
                        <textarea
                            className="ui-textarea pf-notes"
                            rows={2}
                            maxLength={NOTES_MAX}
                            placeholder="Why did you make this trade?"
                            value={form.notes}
                            onChange={(e) => update({ notes: e.target.value })}
                            data-testid="tx-notes"
                        />
                    </Field>
                </div>
            </form>
        </Modal>
    );
}

export default PortfolioTxModal;
