/** Adapt preserved page styles to a container-owned editor. */
export function scopeEditorStyles(stylesheet: string, controlIds: Iterable<string>): string {
    let styles = stylesheet;
    for (const id of controlIds)
        styles = styles.replace(new RegExp('#' + id + '(?![\\w-])', 'g'), '[data-editor-id="' + id + '"]');
    styles = styles.replace(/:root:not\(\[data-theme="light"\]\)/g, ':host(:not([data-theme="light"]))')
        .replace(/:root\[data-theme="dark"\]/g, ':host([data-theme="dark"])')
        // Match the page's body element without matching .wizard-body or #left-body.
        .replace(/:root|html,body|(?<![\w.#-])body(?=\{)/g, ':host')
        .replace(/position:\s*fixed/g, 'position:absolute')
        .replace(/@media\s*(\((?:min|max)-width:[^)]+\))/g, '@container $1')
        .replace(/(\d+(?:\.\d+)?)d?vh\b/g, '$1cqh').replace(/(\d+(?:\.\d+)?)vw\b/g, '$1cqw');
    return styles;
}
