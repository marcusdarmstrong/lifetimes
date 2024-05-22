import type { AsyncLocalStorage } from "node:async_hooks";
import { createScope } from "#scope";

import type { ReactElement } from "react";

const MUTABLE_SET_METHODS = new Set<string | symbol>([
  "add",
  "delete",
  "clear",
]);
const MUTABLE_MAP_METHODS = new Set<string | symbol>([
  "set",
  "delete",
  "clear",
]);
const MUTABLE_DATE_METHODS = new Set<string | symbol>([
  "setTime",
  "setYear",
  "setMilliseconds",
  "setUTCMilliseconds",
  "setSeconds",
  "setUTCSeconds",
  "setMinutes",
  "setUTCMinutes",
  "setHours",
  "setUTCHours",
  "setDate",
  "setUTCDate",
  "setMonth",
  "setUTCMonth",
  "setFullYear",
  "setUTCFullYear",
]);

function isReactObject(value: unknown): boolean {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "$$typeof" in value
  );
}

function immutableProxy<T>(value: T): Immutable<T> {
  if (
    isReactObject(value) ||
    (typeof value !== "object" && typeof value !== "function") ||
    value === null
  ) {
    // Primitive values are implicitly immutable.
    return value as Immutable<T>;
  }

  if (value instanceof Promise) {
    throw new Error(
      "Invalid operation: Promises cannot be made to be readonly",
    );
  }

  Object.preventExtensions(value);

  return new Proxy(value, {
    get(target, property, receiver) {
      // This doesn't prevent actually mutating Sets and Maps, as one could apply
      // the prototype on the underlying value, but it should prevent accidental
      // immutability violations fairly well.
      if (
        (target instanceof Set && MUTABLE_SET_METHODS.has(property)) ||
        (target instanceof Map && MUTABLE_MAP_METHODS.has(property)) ||
        (target instanceof Date && MUTABLE_DATE_METHODS.has(property))
      ) {
        throw new Error("Invalid operation: this object is readonly");
      }

      const returnValue = Reflect.get(target, property, receiver);
      return makeImmutable(
        typeof returnValue === "function"
          ? returnValue.bind(target)
          : returnValue,
      );
    },
  }) as Immutable<T>;
}

function makeImmutable<T>(value: T): Immutable<T> {
  if (
    value instanceof Promise ||
    value instanceof Set ||
    value instanceof Map ||
    value instanceof Date ||
    isReactObject(value)
  ) {
    return immutableProxy(value);
  }

  if (typeof value === "object" && value !== null) {
    Reflect.ownKeys(value).forEach((property) => {
      makeImmutable(value[property as keyof typeof value]);
    });
    Object.freeze(value);
  }

  return value as Immutable<T>;
}

export type ReadonlyDate = Readonly<
  Omit<
    Date,
    | "setTime"
    | "setYear"
    | "setMilliseconds"
    | "setUTCMilliseconds"
    | "setSeconds"
    | "setUTCSeconds"
    | "setMinutes"
    | "setUTCMinutes"
    | "setHours"
    | "setUTCHours"
    | "setDate"
    | "setUTCDate"
    | "setMonth"
    | "setUTCMonth"
    | "setFullYear"
    | "setUTCFullYear"
  >
>;

export type Immutable<T> = T extends (...args: infer Ks) => infer V
  ? (...args: Ks) => V
  : T extends Date
    ? ReadonlyDate
    : T extends ReadonlyDate
      ? ReadonlyDate
      : T extends Set<infer S>
        ? ReadonlySet<Immutable<S>>
        : T extends Map<infer K, infer V>
          ? ReadonlyMap<Immutable<K>, Immutable<V>>
          : T extends ReactElement<unknown>
            ? T
            : {
                readonly [K in keyof T]: Immutable<T[K]>;
              };

function isCallable<T>(
  value: ReadOnlyInitializer<T>,
): value is ClosureInitializer<T> {
  return typeof value === "function";
}

type ClosureInitializer<T> = () => T extends Promise<unknown> ? never : T;
type InlineInitializer<T> = T extends (...args: unknown[]) => unknown
  ? never
  : T extends Promise<unknown>
    ? never
    : T;

type ReadOnlyInitializer<T> = ClosureInitializer<T> | InlineInitializer<T>;

/**
 * Mark the lifetime of a provided block of code as "forever" with safety
 * provided by enforcement that the resultant value is read only.
 *
 * @param initializer - A callback to construct a value to be made readOnly.
 * @return The provided callback's return value, frozen, and wrapped in a
 *  readOnly-enforcing Proxy.
 */
export function readOnly<T>(initializer: ReadOnlyInitializer<T>): Immutable<T> {
  if (isCallable(initializer)) {
    return makeImmutable(initializer());
  }
  return makeImmutable(initializer);
}

type Scope = Map<symbol, unknown>;
function assertScope(scopeStorage: AsyncLocalStorage<Scope>): Scope {
  const thisScope = scopeStorage.getStore();
  if (thisScope === undefined) {
    throw new Error(
      "Invalid state: value is request scoped, but its usage is outside of a request",
    );
  }
  return thisScope;
}

const REQUEST_SCOPE = createScope();

/**
 * A wrapper type that provides access to an instance of T that varies across
 * requests.
 */
export type RequestLocal<T> = {
  get(): T;
};

/**
 * Create a value that will be recreated on demand per-request with the provided
 * initializer function.
 *
 * @param initializer - A callback factory that produces valid new instances of
 *  the value intended to be isolated to a single request.
 * @return A RequestLocal wrapper around the object type constructed by the
 *  provided initializer
 */
export function requestLocal<T>(initializer: () => T): RequestLocal<T> {
  const identity = Symbol();
  return {
    get() {
      const scope = assertScope(REQUEST_SCOPE);
      if (!scope.has(identity)) {
        scope.set(identity, initializer());
      }
      return scope.get(identity) as T;
    },
  };
}

/**
 * The central hook that ensures that our request locals correspond to the
 * lifetime of a request. It's critical that this be called at the highest
 * possible level of a request handling stack to ensure request local objects
 * are reconstructed and managed correctly.
 *
 * @param callback - The request handler for your application stack
 * @return The return value of the provided callback.
 */
export function runInRequestScope<T>(callback: () => T): T {
  if (REQUEST_SCOPE.getStore() !== undefined) {
    throw new Error(
      "Invalid state: cannot create a request scope while within a request scope",
    );
  }
  return REQUEST_SCOPE.run(new Map(), callback);
}

// These following helpers exist to make lint rules/the patternized use of this
// library more general by allowing for explicit exceptions from the rules.

/**
 * To create a value specifically declared as a mutable singleton whose lifetime
 * will correspond exclusively to that of the module containing it, this
 * function exists.
 *
 * @param initializer - A callback function to execute immediately, charged with
 *  creating an initial state for the singleton.
 * @return The initialized singleton value.
 */
export function unsafeSingleton<T>(initializer: () => T): T {
  return initializer();
}

/**
 * This function exists to allow developers to specifically declare that a block
 * of code in module scope is performing some mutation to the system or global
 * javascript environment, imperatively, rather than producing some value to be
 * reused throughout the rest of the application by explicit reference.
 *
 * @param callback - A callback function to execute immediately, modifying the
 *  global state of the system in some way, and yielding no result.
 */
export function unsafeGlobalEffect(callback: () => void) {
  callback();
}
