/** Join class names, skipping falsy values: cx('a', cond && 'b') */
export function cx(...parts) {
    return parts.filter(Boolean).join(' ');
}

/** React ids (e.g. "_r_1_" / ":r1:") made safe for SVG url(#id) and CSS selectors. */
export function safeId(id) {
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '');
}
