import { AsyncLocalStorage } from "node:async_hooks";

export function createScope() {
  return new AsyncLocalStorage<Map<symbol, unknown>>();
}
