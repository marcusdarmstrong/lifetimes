Modern javascript-backed web applications are often built with the intent of sharing code between their client and server implementations. But while stateless _logic_ can be leveraged for sharing in this way, there remains a fundamental gap between the lifetimes of modules themselves in the client and server environments: modules on the client live for the life of the HTML document, but modules on the server typically live for the uptime of that server. This gap can then show up as applications on the server render out-of-date information or, worse, share data across requests. `lifetimes` provides an opinionated approach to managing this problem space by combining a minimal library to annotate the intended lifetime of module scoped variables and a set of ESLint rules to enforce the use of this library.

# Targets

This library may be of use to your application if:

1. You're running a javascript-backed HTTP service

The APIs contained within this package are specifically designed to be fluent in the context of an HTTP service—other javascript applications (CLI applications, etc) would probably desire rather different semantics.

2. Your application's workload is entirely per-request (or "stateless")

That is, there's minimal (or no) work or state that lives outside of the HTTP request lifecycle—and you want to keep it that way. 

3. Your application's runtime supports AsyncLocalStorage

At the end of the day the implementation `lifetimes` relies upon for per-request logic is that of node's [AsyncLocalStorage](https://nodejs.org/api/async_context.html), which has been carried over into other runtimes (notably Cloudflare workers/workerd, and bun). In the future, the [TC39 proposal for AsyncContext](https://github.com/tc39/proposal-async-context) could likely extend support more broadly.

4. To a lesser degree, your application does not make heavy use of "Higher order component"-style approaches to creating functions at runtime.

Unfortunately the static analysis approach in use here makes it challenging to disambiguate dynamically assembled code that is "safe" to call in module scope and code that isn't—So the accompanying ESLint rules may prove tiresome or useless if you're heavily invested in the HOC pattern.

# Philosophy

`lifetimes` seeks to _aid_ in the software development and code review proccesses. The goal isn't to guarantee correctness, but rather to *assist* developers in thinking about how long values they create in module scope should live and enable code reviewers to more easily identify and evaluate authors' intent. 

## Opinions

This is undoubtedly an opinionated library, so it's important to be explicit about those opinions:
- Mutable module state is bad
- Caching is better handled in non-javascript layers
- Lazy-loaded server-side stores are bad

## Conclusions

1. Variables declared in module scope should be read-only.
2. Failing that, they should be scoped to be only accessible within the lifetime of a request.
3. Failing that, we should make it obvious that we're in dangerous territory.

# Approach

The `lifetimes` static analysis approach takes a pessimistic assumption that the creation of any variable in module scope that _could_ be mutated needs to be explicitly annotated with a lifetime.

To that end, there are two basic lint rules:
1. No `lets` are allowed in module scope
2. There can be no object declarations, array declarations, function calls, or constructor invocations directly in module scope

The second rule is where the complexity comes in: obviously there need to be exceptions, and a specific allowlist of functions designated as "safe" to be called within module scope can be configured as a part of the rule. By default, `@lifetimes/eslint-plugin` provides a config that allowlists the `lifetimes` public APIs as well as a config that further includes the `react` APIs intended for consumption in module scope (`lazy`, `memo`, `createContext`, etc).

## API

`readOnly`: Enforce readonly semantics at runtime and typecheck time, with specific support for Maps, Sets, Arrays, plain-Objects, and Dates.

```
import { readOnly } from 'lifetimes';

const RETRY_TIMEOUTS = readOnly(() => [50, 100, 250, 500, 1000]);
```

`requestLocal`: Call .get() to access the current instance of the value

```
import { requestLocal } from 'lifetimes';

const perRequestId = requestLocal(() => uuid());
...
perRequestId.get();
```

`requestLocalProxy`: By wrapping a `RequestLocal` in a Proxy we can provide an easier migration path for code that's already written.

```
import { requestLocalProxy } from 'lifetimes';

const perRequestId = requestLocalProxy(() => ({ current: uuid() });
...
perRequestId.current; 
```

`unsafeSingleton`: A simple passthrough that exists to specifically declare that singleton behavior is desired.

```
import { unsafeSingleton } from 'lifetimes';

const mutableId = unsafeSingleton(() => ({ current: uuid() });
...
mutableId.current = uuid(); 
```

`unsafeGlobalEffect`: Similarly, a simple passthrough that allows declaration of side effecting code intended to modify global scope.

```
import { unsafeGlobalEffect } from 'lifetimes';

unsafeGlobalEffect(() => {
  createServer(() => ...).listen(80);
});
```

`runInRequestScope`: The key hook that the application needs to call per-request to enable the request-local behavior.

```
import { unsafeGlobalEffect, runInRequestScope } from 'lifetimes';

unsafeGlobalEffect(() => {
  createServer((req, res) => {
    runInRequestScope(() => {
      // Handle your request
    });
  }).listen(80);
});

```

# How to

1. Add the relevant `runInRequestScope` hook (see above example).
2. Enable the ESLint rules via the `@lifetimes` eslint plugin:

```
    "extends": [
      "plugin:@lifetimes/recommended"
    ],
```

3. Annotate your application's module scope variables (see above examples).

# Build
`nvm use`
`npm install`
