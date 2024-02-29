type Scope = Map<symbol, unknown>;

export function createScope() {
  let scope: Scope | undefined;
  return {
    run<T>(
      providedScope: Scope,
      callback: (...a: unknown[]) => T,
      ...args: unknown[]
    ) {
      scope = providedScope;
      return callback(...args);
    },
    getStore(): Scope | undefined {
      return scope;
    },
  };
}
