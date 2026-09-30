import { cloneElement, isValidElement, useId } from 'react';
import { AlertCircle } from 'lucide-react';
import { cx, safeId } from './cx';

const NATIVE_CONTROLS = ['input', 'select', 'textarea'];

/**
 * Label + control + hint/error. A native <input>/<select>/<textarea> child is
 * wired automatically (id, aria-describedby, aria-invalid, .is-invalid).
 * For composite children (an input group) pass htmlFor and put that id on the input.
 *
 * <Field label="Quantity" hint="Fractional shares are fine" error={errors.qty}>
 *   <input className="ui-input" type="number" value={qty} onChange={...} />
 * </Field>
 */
export function Field({ label, hint, error, htmlFor, required = false, optional = false, className, children }) {
    const uid = safeId(useId());
    const hintId = hint ? `${uid}-hint` : undefined;
    const errorId = error ? `${uid}-error` : undefined;
    const describedBy = [errorId, !error ? hintId : undefined].filter(Boolean).join(' ') || undefined;

    let control = children;
    let controlId = htmlFor;
    if (isValidElement(children) && NATIVE_CONTROLS.includes(children.type)) {
        controlId = children.props.id || htmlFor || `${uid}-control`;
        control = cloneElement(children, {
            id: controlId,
            'aria-invalid': error ? true : children.props['aria-invalid'],
            'aria-describedby': [children.props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
            'aria-required': required || children.props['aria-required'] || undefined,
            className: cx(children.props.className, error && 'is-invalid')
        });
    }

    return (
        <div className={cx('ui-field', error && 'has-error', className)}>
            {label && (
                <label className="ui-field-label" htmlFor={controlId}>
                    {label}
                    {required && <span className="ui-field-req" aria-hidden="true">*</span>}
                    {optional && <span className="ui-field-opt">Optional</span>}
                </label>
            )}
            {control}
            {error ? (
                <p id={errorId} className="ui-field-error" role="alert">
                    <AlertCircle size={13} aria-hidden="true" />
                    {error}
                </p>
            ) : hint ? (
                <p id={hintId} className="ui-field-hint">{hint}</p>
            ) : null}
        </div>
    );
}

export default Field;
