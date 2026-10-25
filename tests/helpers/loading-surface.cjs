/** A content surface for presenter tests that do not mount a browser DOM. */
exports.loadingSurface = () => {
  const attributes = new Map(), classes = new Set();
  return {
    getAttribute: key => attributes.get(key) ?? null,
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key),
    classList: { add: key => classes.add(key), remove: key => classes.delete(key) },
    querySelector: () => ({}),
    querySelectorAll: () => [],
  };
};
