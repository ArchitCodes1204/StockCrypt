import { cx } from './cx';

/** Consistent page title block: eyebrow, h1, subtitle, and right-aligned actions. */
export function PageHeader({ eyebrow, title, subtitle, actions, className, children }) {
    return (
        <header className={cx('ui-page-header', className)}>
            <div className="ui-page-heading">
                {eyebrow && <p className="ui-page-eyebrow">{eyebrow}</p>}
                <h1 className="ui-page-title">{title}</h1>
                {subtitle && <p className="ui-page-subtitle">{subtitle}</p>}
                {children}
            </div>
            {actions && <div className="ui-page-actions">{actions}</div>}
        </header>
    );
}

export default PageHeader;
