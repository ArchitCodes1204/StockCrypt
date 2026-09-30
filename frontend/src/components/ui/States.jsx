import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { cx } from './cx';

/** Friendly "nothing here yet" block with an optional call to action. */
export function EmptyState({ icon = Inbox, title, description, action, compact = false, className, ...rest }) {
    const Icon = icon || Inbox;
    return (
        <div className={cx('ui-empty', compact && 'ui-empty--compact', className)} {...rest}>
            <span className="ui-empty-icon" aria-hidden="true">
                <Icon size={22} />
            </span>
            {title && <h3 className="ui-empty-title">{title}</h3>}
            {description && <p className="ui-empty-desc">{description}</p>}
            {action && <div className="ui-empty-action">{action}</div>}
        </div>
    );
}

/** Error block with an optional retry button. Announced to screen readers. */
export function ErrorState({
    title = 'Something went wrong',
    message,
    onRetry,
    retryLabel = 'Try again',
    compact = false,
    className,
    ...rest
}) {
    return (
        <div className={cx('ui-empty', 'ui-empty--error', compact && 'ui-empty--compact', className)} role="alert" {...rest}>
            <span className="ui-empty-icon" aria-hidden="true">
                <AlertCircle size={22} />
            </span>
            <h3 className="ui-empty-title">{title}</h3>
            {message && <p className="ui-empty-desc">{message}</p>}
            {onRetry && (
                <div className="ui-empty-action">
                    <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
                        {retryLabel}
                    </Button>
                </div>
            )}
        </div>
    );
}

export default EmptyState;
