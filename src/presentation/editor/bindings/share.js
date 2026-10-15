/** Share: a link that opens this design, sent with the phone's share sheet or copied on a computer.
 * Event bindings only: the link itself comes from the page that mounts the editor. */
/** @param {import('./share.ports').BindShareMenuPorts} ports */
export function bindShareMenu({ dom, shell, model, lifetime, shareLink }) {
    const { $, navigator, history } = dom;
    const item = $('#share-menu');
    item.hidden = !shareLink;
    if (!shareLink) return;
    const copied = url => {
        // Where copying is not allowed, the link goes in the address bar to copy from there.
        const inBar = () => { history.replaceState(null, '', url); shell.toast('The link to this design is in the address bar. Copy it from there.', undefined, 8000); };
        if (!navigator.clipboard?.writeText) return inBar();
        navigator.clipboard.writeText(url).then(() => shell.toast('Link copied. Whoever opens it sees this design.', undefined, 6000), inBar);
    };
    lifetime.listen(item, 'click', async () => {
        shell.closeDD();
        let url;
        // Publishing happens only on Share, never merely by opening the menu.
        try { url = await shareLink(model.scene); } catch { return shell.toast('This design could not be put in a link.'); }
        const phone = dom.matchMedia('(pointer: coarse)').matches;
        if (phone && navigator.share) {
            navigator.share({ title: 'Wardrobe design', url }).catch(error => { if (error?.name !== 'AbortError') copied(url); });
        } else copied(url);
    });
}
