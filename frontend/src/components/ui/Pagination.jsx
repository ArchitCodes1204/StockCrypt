import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from './cx';

function pageItems(page, pages) {
    const wanted = new Set([1, pages, page - 1, page, page + 1]);
    if (page <= 3) [2, 3, 4].forEach((p) => wanted.add(p));
    if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((p) => wanted.add(p));
    const list = [...wanted].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
    const items = [];
    let previous = 0;
    for (const p of list) {
        if (p - previous === 2) items.push(previous + 1);
        else if (p - previous > 2) items.push(`gap-${p}`);
        items.push(p);
        previous = p;
    }
    return items;
}

/**
 * Prev / numbered pages / Next (collapses to "Page x of y" on phones). Renders nothing for <= 1 page.
 * data-testid: `${testId}`, `${testId}-prev`, `${testId}-next`, `${testId}-page-N`.
 */
export function Pagination({ page, pages, onChange, testId, className, 'aria-label': ariaLabel = 'Pagination' }) {
    const total = Math.max(0, Math.floor(Number(pages) || 0));
    if (total <= 1) return null;
    const current = Math.min(Math.max(1, Math.floor(Number(page) || 1)), total);
    const go = (p) => {
        if (p >= 1 && p <= total && p !== current) onChange?.(p);
    };
    const tid = (suffix) => (testId ? `${testId}-${suffix}` : undefined);

    return (
        <nav className={cx('ui-pagination', className)} aria-label={ariaLabel} data-testid={testId}>
            <button
                type="button"
                className="ui-page-btn"
                onClick={() => go(current - 1)}
                disabled={current <= 1}
                aria-label="Previous page"
                data-testid={tid('prev')}
            >
                <ChevronLeft size={16} aria-hidden="true" />
                <span>Prev</span>
            </button>
            <ul className="ui-page-list">
                {pageItems(current, total).map((item) => (typeof item === 'number' ? (
                    <li key={item}>
                        <button
                            type="button"
                            className={cx('ui-page-btn', item === current && 'is-current')}
                            aria-current={item === current ? 'page' : undefined}
                            aria-label={`Page ${item}`}
                            onClick={() => go(item)}
                            data-testid={tid(`page-${item}`)}
                        >
                            {item}
                        </button>
                    </li>
                ) : (
                    <li key={item} className="ui-page-gap" aria-hidden="true">…</li>
                )))}
            </ul>
            <span className="ui-page-summary" aria-live="polite">Page {current} of {total}</span>
            <button
                type="button"
                className="ui-page-btn"
                onClick={() => go(current + 1)}
                disabled={current >= total}
                aria-label="Next page"
                data-testid={tid('next')}
            >
                <span>Next</span>
                <ChevronRight size={16} aria-hidden="true" />
            </button>
        </nav>
    );
}

export default Pagination;
