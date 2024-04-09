import type { AsyncLocalStorage } from "node:async_hooks";
import { createScope } from "#scope";

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
  "setDate",
  "setFullYear",
  "setHours",
  "setMilliseconds",
  "setMinutes",
  "setMonth",
  "setSeconds",
  "setTime",
  "setUTCDate",
  "setUTCFullYear",
  "setUTCHours",
  "setYear",
]);

function immutable<T>(value: T): T {
  if (
    (typeof value !== "object" && typeof value !== "function") ||
    value === null ||
    value === undefined
  ) {
    // Primitive values are implicitly immutable.
    return value;
  }

  if (value instanceof Promise) {
    throw new Error(
      "Invalid operation: Promises cannot be made to be readonly",
    );
  }

  // This effectively prevents mutation of arrays and objects.
  Object.preventExtensions(value);
  Reflect.ownKeys(value).forEach((property) => {
    Object.defineProperty(value, property, {
      writable: false,
    });
  });

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
      return immutable(
        typeof returnValue === "function"
          ? returnValue.bind(target)
          : returnValue,
      );
    },
  });
}

export type ReadonlyDate = Readonly<
  Omit<
    Date,
    | "setTime"
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

type Immutable<T> = T extends (...args: infer Ks) => infer V
  ? (...args: Ks) => V
  : {
      readonly [K in keyof T]: Immutable<T[K]>;
    };

export function readOnly(initializer: () => Date): ReadonlyDate;
export function readOnly<T>(initializer: () => Set<T>): ReadonlySet<T>;
export function readOnly<K, V>(initializer: () => Map<K, V>): ReadonlyMap<K, V>;
export function readOnly<T>(
  initializer: () => T extends Promise<unknown> ? never : T,
): Readonly<Immutable<T>>;

/**
 * Mark the lifetime of a provided block of code as "forever" with safety
 * provided by enforcement that the resultant value is read only.
 *
 * @param initializer - A callback to construct a value to be made readOnly.
 * @return The provided callback's return value, frozen, and wrapped in a
 *  readOnly-enforcing Proxy.
 */
export function readOnly<T>(initializer: () => T): Readonly<T> {
  return immutable(initializer());
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

// Statically declared helpers to ensure that our proxy has the correct `typeof`
const EMPTY_OBJECT = {};
// eslint-disable-next-line @typescript-eslint/no-empty-function
function NOOP_FUNCTION() {}

/**
 * A helper to enable a drop-in replacement for objects that assume module state
 * is isomorphic with a particular request. By proxying all interaction to the
 * requestLocal-constructed object, we ensure safety with minimal code changes.
 *
 * @param initializer - A Proxy
 * @return A Proxy fronting the request-local value produced by the provided
 *  initializer function, delegating to the current request-local instance
 *  whenever any Proxy hooks are fired.
 */
export function requestLocalProxy<
  T extends Record<string, unknown> | ((...a: unknown[]) => unknown),
>(initializer: () => T): T {
  const initial = initializer();
  if (typeof initial !== "object" && typeof initial !== "function") {
    throw new Error("Invalid operation: primitive values cannot be proxied");
  }

  const local = requestLocal(initializer);

  return new Proxy(typeof initial === "object" ? EMPTY_OBJECT : NOOP_FUNCTION, {
    apply(_target, thisValue, args) {
      // @ts-expect-error: I have no guarantees this is a callable object.
      return Reflect.apply(local.get(), thisValue, args);
    },
    construct(_target, args) {
      // @ts-expect-error: I have no guarantees this is a newable object.
      return Reflect.construct(local.get(), args);
    },
    defineProperty(_target, property, descriptor) {
      return Reflect.defineProperty(local.get(), property, descriptor);
    },
    deleteProperty(_target, property) {
      return Reflect.deleteProperty(local.get(), property);
    },
    get(_target, property, receiver) {
      return Reflect.get(local.get(), property, receiver);
    },
    getOwnPropertyDescriptor(_target, property) {
      return Reflect.getOwnPropertyDescriptor(local.get(), property);
    },
    getPrototypeOf(_target) {
      return Reflect.getPrototypeOf(local.get());
    },
    has(_target, property) {
      return Reflect.has(local.get(), property);
    },
    isExtensible(_target) {
      return Reflect.isExtensible(local.get());
    },
    ownKeys(_target) {
      return Reflect.ownKeys(local.get());
    },
    preventExtensions(_target) {
      return Reflect.preventExtensions(local.get());
    },
    set(_target, property, value, receiver) {
      return Reflect.set(local.get(), property, value, receiver);
    },
    setPrototypeOf(_target, prototype) {
      return Reflect.setPrototypeOf(local.get(), prototype);
    },
  }) as T;
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
