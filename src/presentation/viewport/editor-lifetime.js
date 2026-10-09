/** Own browser resources for one mounted editor. All callbacks stop at disposal. */
export function createEditorLifetime({ requestFrame = fn => requestAnimationFrame(fn), cancelFrame = id => cancelAnimationFrame(id), setTimer = (fn, delay) => setTimeout(fn, delay), clearTimer = id => clearTimeout(id) } = {}) {
    const frames = new Set(), timers = new Set(), cleanups = [];
    let disposed = false;
    const api = {
        get disposed() {
            return disposed;
        },
        listen(target, event, handler, options) {
            if (disposed) {
                return;
            }
            target.addEventListener(event, handler, options);
            cleanups.push(() => target.removeEventListener(event, handler, options));
        },
        observe(observer, target, options) {
            if (disposed) {
                return;
            }
            observer.observe(target, options);
            cleanups.push(() => observer.disconnect());
            return observer;
        },
        cleanup(fn) {
            if (disposed) {
                fn();
            }
            else {
                cleanups.push(fn);
            }
        },
        frame(fn) {
            if (disposed) {
                return 0;
            }
            let id;
            id = requestFrame(time => {
                frames.delete(id);
                if (!disposed) {
                    fn(time);
                }
            });
            frames.add(id);
            return id;
        },
        timeout(fn, delay) {
            if (disposed) {
                return 0;
            }
            let id;
            id = setTimer(() => {
                timers.delete(id);
                if (!disposed) {
                    fn();
                }
            }, delay);
            timers.add(id);
            return id;
        },
        cancelFrame(id) {
            frames.delete(id);
            cancelFrame(id);
        },
        cancelTimeout(id) {
            timers.delete(id);
            clearTimer(id);
        },
        dispose() {
            if (disposed) {
                return;
            }
            disposed = true;
            frames.forEach(cancelFrame);
            timers.forEach(clearTimer);
            frames.clear();
            timers.clear();
            for (const cleanup of cleanups.reverse()) {
                cleanup();
            }
            cleanups.length = 0;
        },
    };
    return api;
}
