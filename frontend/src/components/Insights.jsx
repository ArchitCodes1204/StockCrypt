import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, BarChart3, LineChart, Scale, SearchX, Table2 } from 'lucide-react';
import stockApi from '../services/stockApi';
import { Button, Card, EmptyState, ErrorState, Field, IconButton, PageHeader, SymbolAvatar, SymbolSearch, cx } from './ui';
import { POPULAR_PAIRS, SIDE_COLORS, cleanSymbol, orient, pairKey, suggestionsFor, symbolFromError } from './CompareModel';
import { CompareChart } from './CompareChart';
import { CompareHero, CompareMetrics, CompareReturns, CompareSkeleton, CompareTrend, CompareVerdicts } from './CompareParts';
import './Insights.css';

const FEATURES = [
    { icon: LineChart, title: 'Relative performance', text: 'Both price histories rebased to 100 on one calendar, even for a stock against a coin.' },
    { icon: Table2, title: 'Side-by-side metrics', text: 'Returns, volatility, drawdown, valuation and risk with the better value marked.' },
    { icon: Scale, title: 'A rule-based verdict', text: 'Which one did better, which carries less risk and which has the stronger rating.' }
];

const Insights = () => {
    const [params, setParams] = useSearchParams();
    const s1 = cleanSymbol(params.get('s1'));
    const s2 = cleanSymbol(params.get('s2'));
    const urlKey = `${s1}|${s2}`;

    const [inputA, setInputA] = useState(s1);
    const [inputB, setInputB] = useState(s2);
    const [errors, setErrors] = useState({});
    const [syncedKey, setSyncedKey] = useState(urlKey);
    const [nonce, setNonce] = useState(0);
    const [spin, setSpin] = useState(0);
    const [result, setResult] = useState({ key: null, data: null, error: null });
    const refA = useRef(null);
    const refB = useRef(null);

    // Back/forward or a new deep link: the URL wins over whatever was typed.
    if (syncedKey !== urlKey) {
        setSyncedKey(urlKey);
        setInputA(s1);
        setInputB(s2);
        setErrors({});
    }

    const valid = Boolean(s1 && s2 && s1 !== s2);
    const requestKey = valid ? `${pairKey(s1, s2)}#${nonce}` : null;

    useEffect(() => {
        if (!requestKey || result.key === requestKey) return undefined;
        let cancelled = false;
        stockApi.compareStocks(s1, s2)
            .then((data) => {
                if (!cancelled) setResult({ key: requestKey, data, error: null });
            })
            .catch((err) => {
                if (!cancelled) setResult({ key: requestKey, data: null, error: err.message || 'Comparison failed' });
            });
        return () => {
            cancelled = true;
        };
    }, [requestKey, result.key, s1, s2]);

    // Deep link with only ?s1=: put the cursor in the second box.
    useEffect(() => {
        if (s1 && !s2) refB.current?.focus();
    }, [s1, s2]);

    const status = !valid ? 'idle' : result.key !== requestKey ? 'loading' : result.error ? 'error' : 'ready';
    const data = status === 'ready' ? orient(result.data, s1) : null;
    const badSymbol = status === 'error' ? symbolFromError(result.error) : null;
    const notFound = Boolean(badSymbol && (badSymbol === s1 || badSymbol === s2));

    const errorA = errors.a || (notFound && badSymbol === s1 && cleanSymbol(inputA) === s1 ? 'No data found for this symbol' : null);
    const errorB = errors.b || (notFound && badSymbol === s2 && cleanSymbol(inputB) === s2 ? 'No data found for this symbol' : null);

    const run = (a, b) => {
        const A = cleanSymbol(a);
        const B = cleanSymbol(b);
        const next = {};
        if (!A) next.a = 'Enter a symbol';
        if (!B) next.b = 'Enter a second symbol';
        if (A && B && A === B) next.b = 'Pick a different symbol to compare against';
        setErrors(next);
        if (next.a) {
            refA.current?.focus();
            return;
        }
        if (next.b) {
            refB.current?.focus();
            return;
        }
        setInputA(A);
        setInputB(B);
        if (A === s1 && B === s2) {
            if (status === 'error') setNonce((n) => n + 1);
            return;
        }
        setParams({ s1: A, s2: B });
    };

    const submit = (event) => {
        event.preventDefault();
        run(inputA, inputB);
    };

    const swap = () => {
        setSpin((n) => n + 1);
        setErrors({});
        const A = cleanSymbol(inputA);
        const B = cleanSymbol(inputB);
        setInputA(inputB);
        setInputB(inputA);
        // Showing this pair already: flip the page too (no refetch, the data is order-insensitive).
        if (valid && A === s1 && B === s2) setParams({ s1: B, s2: A }, { replace: true });
    };

    const pickA = (symbol) => {
        setInputA(symbol);
        setErrors((e) => ({ ...e, a: undefined }));
        const B = cleanSymbol(inputB);
        if (B && B !== symbol) run(symbol, B);
        else requestAnimationFrame(() => refB.current?.focus());
    };

    const pickB = (symbol) => {
        setInputB(symbol);
        setErrors((e) => ({ ...e, b: undefined }));
        const A = cleanSymbol(inputA);
        if (A && A !== symbol) run(A, symbol);
        else if (!A) requestAnimationFrame(() => refA.current?.focus());
    };

    const editBad = () => {
        const ref = badSymbol === s1 ? refA : refB;
        ref.current?.focus();
        ref.current?.select?.();
    };

    const pairActive = (a, b) => valid && ((a === s1 && b === s2) || (a === s2 && b === s1));

    return (
        <div className="cmp-page">
            <PageHeader
                title="Compare"
                subtitle="Put two stocks, ETFs or cryptocurrencies side by side: performance on one chart, the key numbers, and a rule-based verdict."
            />

            <Card className="cmp-form-card fade-up">
                <form className="cmp-form" onSubmit={submit} noValidate aria-label="Choose two symbols">
                    <Field
                        className="cmp-field"
                        htmlFor="cmp-s1-input"
                        error={errorA}
                        label={(
                            <span className="cmp-field-label">
                                <span className="cmp-swatch" style={{ '--cmp-color': SIDE_COLORS[0] }} aria-hidden="true" />
                                First symbol
                            </span>
                        )}
                    >
                        <SymbolSearch
                            ref={refA}
                            id="cmp-s1-input"
                            value={inputA}
                            onChange={(v) => {
                                setInputA(v);
                                if (errors.a) setErrors((e) => ({ ...e, a: undefined }));
                            }}
                            onSelect={pickA}
                            placeholder="e.g. AAPL"
                            testId="cmp-s1"
                            blurOnSelect
                            aria-label="First symbol"
                            className={cx('cmp-search', errorA && 'is-invalid')}
                        />
                    </Field>

                    <IconButton
                        icon={ArrowLeftRight}
                        label="Swap symbols"
                        variant="secondary"
                        className="cmp-swap"
                        onClick={swap}
                        data-testid="cmp-swap"
                        style={{ '--spin': spin }}
                        disabled={!inputA && !inputB}
                    />

                    <Field
                        className="cmp-field"
                        htmlFor="cmp-s2-input"
                        error={errorB}
                        label={(
                            <span className="cmp-field-label">
                                <span className="cmp-swatch" style={{ '--cmp-color': SIDE_COLORS[1] }} aria-hidden="true" />
                                Second symbol
                            </span>
                        )}
                    >
                        <SymbolSearch
                            ref={refB}
                            id="cmp-s2-input"
                            value={inputB}
                            onChange={(v) => {
                                setInputB(v);
                                if (errors.b) setErrors((e) => ({ ...e, b: undefined }));
                            }}
                            onSelect={pickB}
                            placeholder="e.g. MSFT or BTC-USD"
                            testId="cmp-s2"
                            blurOnSelect
                            aria-label="Second symbol"
                            className={cx('cmp-search', errorB && 'is-invalid')}
                        />
                    </Field>

                    <Button
                        type="submit"
                        icon={Scale}
                        loading={status === 'loading'}
                        className="cmp-submit"
                        data-testid="compare-submit"
                    >
                        {status === 'loading' ? 'Comparing' : 'Compare'}
                    </Button>
                </form>

                <div className="cmp-pairs" data-testid="cmp-pairs">
                    <span className="cmp-pairs-label">Popular</span>
                    <div className="cmp-pairs-list">
                        {POPULAR_PAIRS.map(([a, b]) => (
                            <button
                                key={`${a}-${b}`}
                                type="button"
                                className={cx('cmp-pair', pairActive(a, b) && 'is-active')}
                                onClick={() => run(a, b)}
                                aria-pressed={pairActive(a, b)}
                                data-testid={`cmp-pair-${a}-${b}`}
                            >
                                <span className="cmp-pair-avatars" aria-hidden="true">
                                    <SymbolAvatar symbol={a} size={20} />
                                    <SymbolAvatar symbol={b} size={20} />
                                </span>
                                <span className="mono">{a}</span>
                                <span className="cmp-pair-vs">vs</span>
                                <span className="mono">{b}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </Card>

            {status === 'idle' && (
                <Card className="cmp-empty-card fade-up" style={{ '--i': 1 }} data-testid="cmp-empty">
                    {s1 && !s2 ? (
                        <div className="cmp-start">
                            <div className="cmp-start-head">
                                <SymbolAvatar symbol={s1} size={40} />
                                <div>
                                    <h2 className="cmp-start-title">Compare <span className="mono">{s1}</span> with…</h2>
                                    <p className="cmp-start-text">Type a second symbol above, or start with one of these.</p>
                                </div>
                            </div>
                            <div className="cmp-suggest">
                                {suggestionsFor(s1).map((item, i) => (
                                    <button
                                        key={item.symbol}
                                        type="button"
                                        className="cmp-suggest-item hover-lift fade-up"
                                        style={{ '--i': i + 2 }}
                                        onClick={() => run(s1, item.symbol)}
                                        data-testid={`cmp-suggest-${item.symbol}`}
                                    >
                                        <SymbolAvatar symbol={item.symbol} size={32} />
                                        <span className="cmp-suggest-text">
                                            <span className="mono cmp-suggest-symbol">{item.symbol}</span>
                                            <span className="cmp-suggest-note">{item.note}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="cmp-intro">
                            <EmptyState
                                icon={Scale}
                                title="Pick two symbols to compare"
                                description="Stocks, ETFs and crypto all work, including mixed pairs such as AAPL against BTC-USD."
                                action={(
                                    <Button variant="secondary" icon={BarChart3} onClick={() => run('AAPL', 'MSFT')}>
                                        Try AAPL vs MSFT
                                    </Button>
                                )}
                            />
                            <ul className="cmp-features">
                                {FEATURES.map((f, i) => {
                                    const Icon = f.icon;
                                    return (
                                        <li key={f.title} className="cmp-feature fade-up" style={{ '--i': i + 2 }}>
                                            <span className="cmp-feature-icon" aria-hidden="true"><Icon size={16} /></span>
                                            <span className="cmp-feature-title">{f.title}</span>
                                            <span className="cmp-feature-text">{f.text}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </Card>
            )}

            {status === 'loading' && <CompareSkeleton symbols={[s1, s2]} />}

            {status === 'error' && (
                <Card className="cmp-error-card fade-up" data-testid="cmp-error">
                    {notFound ? (
                        <EmptyState
                            icon={SearchX}
                            role="alert"
                            className="ui-empty--error"
                            title={<>No data for <span className="mono">{badSymbol}</span></>}
                            description="Yahoo Finance has no prices for this symbol. Check the ticker (for example BRK-B, BTC-USD or RELIANCE.NS) and try again."
                            action={(
                                <Button variant="secondary" size="sm" onClick={editBad}>
                                    Edit {badSymbol}
                                </Button>
                            )}
                        />
                    ) : (
                        <ErrorState
                            title="Could not compare these symbols"
                            message={result.error}
                            onRetry={() => setNonce((n) => n + 1)}
                        />
                    )}
                </Card>
            )}

            {status === 'ready' && data && (
                <section className="cmp-results" data-testid="compare-results" aria-label={`${data.stock1.symbol} compared with ${data.stock2.symbol}`}>
                    <div className="cmp-heroes">
                        <CompareHero stock={data.stock1} side={0} className="fade-up" style={{ '--i': 0 }} />
                        <span className="cmp-vs fade-up" style={{ '--i': 1 }} aria-hidden="true">vs</span>
                        <CompareHero stock={data.stock2} side={1} className="fade-up" style={{ '--i': 1 }} />
                    </div>

                    <CompareChart
                        stockA={data.stock1}
                        stockB={data.stock2}
                        className="fade-up"
                        style={{ '--i': 2 }}
                    />

                    <div className="cmp-grid">
                        <CompareMetrics
                            stockA={data.stock1}
                            stockB={data.stock2}
                            metrics={data.comparison?.metrics}
                            className="fade-up"
                            style={{ '--i': 3 }}
                        />
                        <div className="cmp-side">
                            <CompareReturns stockA={data.stock1} stockB={data.stock2} className="fade-up" style={{ '--i': 4 }} />
                            <CompareTrend stockA={data.stock1} stockB={data.stock2} className="fade-up" style={{ '--i': 5 }} />
                        </div>
                    </div>

                    <div className="cmp-summary">
                        <h2 className="cmp-summary-title fade-up" style={{ '--i': 5 }}>Verdict</h2>
                        <CompareVerdicts stockA={data.stock1} stockB={data.stock2} comparison={data.comparison} startIndex={6} />
                        <p className="cmp-disclaimer">
                            Rule-based technical analysis of Yahoo Finance data (moving averages, momentum, volatility and drawdowns). Not financial advice.
                        </p>
                    </div>
                </section>
            )}
        </div>
    );
};

export default Insights;
