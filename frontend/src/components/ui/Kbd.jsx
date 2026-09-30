import { cx } from './cx';

/** Keyboard key hint: <Kbd>/</Kbd> */
export function Kbd({ children, className }) {
    return <kbd className={cx('ui-kbd', className)}>{children}</kbd>;
}

export default Kbd;
