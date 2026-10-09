/** A typed, single-assignment connection for mutually collaborating UI controllers.
 * Construct all ports, connect each implementation, then install event handlers.
 */
export interface ModulePort<T extends object> {
  readonly api: T;
  connect(implementation: T): void;
}
export function createModulePort<T extends object>(): ModulePort<T> {
  let implementation: Readonly<T> | undefined;
  const api = new Proxy({} as T, {
    get(_target, property) {
      if (!implementation) throw new Error('Module port is not connected.');
      return Reflect.get(implementation, property);
    },
    set() { throw new Error('Module APIs are immutable.'); },
    defineProperty() { throw new Error('Module APIs are immutable.'); },
    deleteProperty() { throw new Error('Module APIs are immutable.'); },
  });
  return {
    api,
    connect(value) {
      if (implementation) throw new Error('Module port is already connected.');
      implementation = Object.freeze(value);
    },
  };
}
