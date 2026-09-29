import { cx } from './cx';
import { Spinner } from './Spinner';

const ICON_SIZE = { sm: 14, md: 16, lg: 18 };
const ICON_BUTTON_SIZE = { sm: 15, md: 18, lg: 20 };

/**
 * <Button variant="primary|secondary|ghost|danger" size="sm|md|lg" icon={Plus} loading>Add</Button>
 * Any other prop (onClick, type, disabled, data-testid, form...) goes to the <button>.
 */
export function Button({
    ref,
    variant = 'primary',
    size = 'md',
    loading = false,
    icon: Icon,
    iconRight: IconRight,
    fullWidth = false,
    type = 'button',
    disabled,
    className,
    children,
    ...rest
}) {
    const iconSize = ICON_SIZE[size] || 16;
    const hasLabel = children !== undefined && children !== null && children !== false && children !== '';
    const overlaySpinner = loading && !Icon;

    return (
        <button
            ref={ref}
            type={type}
            className={cx(
                'ui-btn',
                `ui-btn--${variant}`,
                `ui-btn--${size}`,
                fullWidth && 'ui-btn--full',
                !hasLabel && 'ui-btn--icon',
                loading && 'is-loading',
                overlaySpinner && 'ui-btn--spin-overlay',
                className
            )}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            {...rest}
        >
            {Icon && (loading ? <Spinner size={iconSize} /> : <Icon size={iconSize} aria-hidden="true" />)}
            {hasLabel && <span className="ui-btn-label">{children}</span>}
            {IconRight && <IconRight size={iconSize} aria-hidden="true" className="ui-btn-icon-right" />}
            {overlaySpinner && (
                <span className="ui-btn-spinner" aria-hidden="true">
                    <Spinner size={iconSize} />
                </span>
            )}
        </button>
    );
}

/**
 * Square icon-only button. `label` becomes aria-label and the hover title.
 * <IconButton icon={RefreshCw} label="Refresh prices" onClick={...} />
 */
export function IconButton({
    ref,
    icon: Icon,
    label,
    variant = 'ghost',
    size = 'md',
    type = 'button',
    className,
    children,
    ...rest
}) {
    const iconSize = ICON_BUTTON_SIZE[size] || 18;
    return (
        <button
            ref={ref}
            type={type}
            aria-label={label}
            title={label}
            className={cx('ui-btn', 'ui-btn--icon', `ui-btn--${variant}`, `ui-btn--${size}`, className)}
            {...rest}
        >
            {children ?? (Icon ? <Icon size={iconSize} aria-hidden="true" /> : null)}
        </button>
    );
}

export default Button;
