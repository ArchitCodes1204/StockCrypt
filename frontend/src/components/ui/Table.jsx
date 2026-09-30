import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cx } from './cx';

/**
 * Sortable column header (renders the <th>). Use inside <table className="ui-table">.
 * <SortHeader label="Value" active={sort.key === 'value'} direction={sort.dir} onClick={() => toggle('value')} align="right" />
 */
export function SortHeader({ label, active = false, direction = 'asc', onClick, align = 'left', className, testId, ...rest }) {
    const Icon = !active ? ChevronsUpDown : direction === 'asc' ? ChevronUp : ChevronDown;
    const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none';
    return (
        <th
            scope="col"
            aria-sort={ariaSort}
            className={cx('is-sortable', active && 'is-active', align === 'right' && 'num', align === 'center' && 'is-center', className)}
            {...rest}
        >
            <button type="button" className="ui-sort-btn" onClick={onClick} data-testid={testId}>
                <span>{label}</span>
                <Icon size={13} className="ui-sort-icon" aria-hidden="true" />
            </button>
        </th>
    );
}

export default SortHeader;
