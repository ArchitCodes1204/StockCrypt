import { cx } from './cx';

/**
 * Surface container. `interactive` adds hover lift + pointer; render it as a
 * real control for keyboard users: <Card as={Link} to="/x" interactive> or as="button".
 */
export function Card({ as = 'div', padded = true, interactive = false, className, style, children, ...rest }) {
    const Tag = as;
    return (
        <Tag
            className={cx('ui-card', padded && 'ui-card--padded', interactive && 'ui-card--interactive', className)}
            style={style}
            {...rest}
        >
            {children}
        </Tag>
    );
}

/** Title row for a Card: optional icon tile, title, subtitle and a right-aligned action. */
export function CardHeader({ title, subtitle, icon: Icon, action, className, titleAs = 'h3' }) {
    const TitleTag = titleAs;
    return (
        <div className={cx('ui-card-header', className)}>
            {Icon && (
                <span className="ui-card-icon" aria-hidden="true">
                    <Icon size={16} />
                </span>
            )}
            <div className="ui-card-heading">
                {title && <TitleTag className="ui-card-title">{title}</TitleTag>}
                {subtitle && <p className="ui-card-subtitle">{subtitle}</p>}
            </div>
            {action && <div className="ui-card-action">{action}</div>}
        </div>
    );
}

export default Card;
