import assert from "node:assert";
import { test } from "node:test";

import { lazy, createElement, type ComponentType } from "react";

import {
  type ReadonlyDate,
  readOnly,
  requestLocal,
  unsafeSingleton,
  unsafeGlobalEffect,
  runInRequestScope,
} from "./lifetimes.ts";

test("readOnly", async (t) => {
  t.test("const types", () => {
    type Union = "a" | "b";
    const a = readOnly("a");
    a satisfies Union;
  });

  await t.test("objects", () => {
    type Obj = {
      foo: boolean;
      bar: { nested: boolean };
      method(foo: string): void;
    };
    const obj = readOnly(() => ({
      foo: true,
      bar: { nested: true },
      method(_foo: string) {},
    })) satisfies Obj;
    assert(obj.foo, "can be read");
    assert(obj.bar.nested, "nested properties can be read");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      obj.baz = false;
    }, "cannot have new properties added");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      obj.foo = false;
    }, "cannot have properties redefined");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      obj.bar.nested = false;
    }, "cannot have nested properties redefined");
  });

  await t.test("RegExps", () => {
    const a = readOnly(() => /foo/);
    assert(a.test("foo"), "can utilize stateless regexps");
    assert.throws(() => {
      readOnly(() => /foo/g);
    }, "throws when given a stateful regexp");
  });

  await t.test("inline readOnly", () => {
    type Obj = {
      foo: boolean;
      bar: { nested: boolean };
      method(foo: string): void;
    };
    const obj = readOnly({
      foo: true,
      regex: /foo/,
      bar: { nested: true },
      method(_foo: string) {},
    }) satisfies Obj;
    assert(obj.foo, "can be read");
    assert(obj.regex.test("foo"), "can utilize stateless regexps");
    assert(obj.bar.nested, "nested properties can be read");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      obj.baz = false;
    }, "cannot have new properties added");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      obj.foo = false;
    }, "cannot have properties redefined");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      obj.bar.nested = false;
    }, "cannot have nested properties redefined");

    assert.throws(() => {
      // @ts-expect-error: Promises are invalid input.
      readOnly(Promise.resolve());
    }, "cannot accept Promises");

    const arr = readOnly([1, 2, 3, 4, 5, [6, 7]]);
    assert(arr[0], "can be read");
    assert(arr[5][0], "can read nested values");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      arr.push(8);
    }, "cannot have new values added");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      arr[0] = -1;
    }, "cannot have values redefined");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      arr[5].push(9);
    }, "cannot have new values added to nested values");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      arr[5][0] = -2;
    }, "cannot have nested values redefined");

    const map = readOnly(new Map([["foo", "bar"]]));
    assert(map.get("foo"), "can be read");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      map.set("bar", "foo");
    }, "cannot have new properties added");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      map.set("foo", "foo");
    }, "cannot have properties redefined");

    const set = readOnly(new Set(["hello", "world"]));
    assert(set.has("hello"), "can be read");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      set.add("foo");
    }, "cannot have new values added");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      set.delete("world");
    }, "cannot have values removed");

    const date = readOnly(new Date());
    assert(date.getTime(), "can be read");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      date.setMonth(0);
    }, "cannot be modified");
  });

  await t.test("ignores lazy react components", () => {
    function LazyComponent() {
      return createElement("span");
    }

    const lazyRenderable = readOnly(() =>
      lazy(() => Promise.resolve({ default: LazyComponent })),
    );

    // Prototype is the only TS-writable property defined on this type.
    assert(
      (lazyRenderable.prototype = Function),
      "lazy components can be written",
    );

    // This is a typescript assertion.
    createElement(lazyRenderable);
  });

  await t.test("ignores react elements", () => {
    const elm = readOnly(createElement("div"));
    // @ts-expect-error: React internally mutates this property. We need to assert that we haven't prevented it from doing so.
    assert((elm._store.foo = "bar"), "react elements can be written");

    function Component() {
      return "hello world";
    }

    // These are typescript assertions.
    createElement(readOnly(() => Component));

    // @ts-expect-error: Components, as callables, need to be passed to `readOnly` with a closure wrapper.
    readOnly<typeof Component>(Component);
  });

  await t.test("ignores react ComponentTypes", () => {
    // Purely a typescript assertion.
    function Component() {
      return "hello world";
    }
    readOnly<ComponentType<unknown>>(
      () => Component,
    ) satisfies ComponentType<unknown>;
  });

  await t.test("arrays", () => {
    const arr = readOnly(() => [1, 2, 3, 4, 5, [6, 7]] as const);
    assert(arr[0], "can be read");
    assert(arr[5][0], "can read nested values");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      arr.push(8);
    }, "cannot have new values added");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      arr[0] = -1;
    }, "cannot have values redefined");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      arr[5].push(9);
    }, "cannot have new values added to nested values");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      arr[5][0] = -2;
    }, "cannot have nested values redefined");
    assert(arr.length === 6, "can read length");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-empty
    for (const _item of arr) {
    }
  });

  await t.test("maps", () => {
    const map = readOnly(() => new Map([["foo", "bar"]]));
    assert(map.get("foo"), "can be read");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      map.set("bar", "foo");
    }, "cannot have new properties added");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      map.set("foo", "foo");
    }, "cannot have properties redefined");
    assert(map.size === 1, "can read size");
    // Validate that this iteration works.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-empty
    for (const _item of map.entries()) {
    }
  });

  await t.test("sets", () => {
    const set = readOnly(() => new Set(["hello", "world"]));
    assert(set.has("hello"), "can be read");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      set.add("foo");
    }, "cannot have new values added");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      set.delete("world");
    }, "cannot have values removed");
    assert(set.size === 2, "can read size");
    // Validate that this iteration works.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-empty
    for (const _item of set.values()) {
    }
  });

  await t.test("dates", () => {
    const date = readOnly(() => new Date());
    assert(date.getTime(), "can be read");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      date.setMonth(0);
    }, "cannot be modified");

    readOnly(() => date) satisfies ReadonlyDate;
  });

  await t.test("promises", () => {
    assert.throws(() => {
      // @ts-expect-error: Promises are invalid input.
      readOnly(() => Promise.resolve());
    }, "cannot be made readOnly");
  });
});

test("requestLocal", () => {
  const counter = requestLocal(() => ({ current: 0 }));

  assert.throws(() => counter.get(), "cannot be accessed outside of a request");

  runInRequestScope(() => {
    assert(counter.get().current === 0, "initialized via provided constructor");
    counter.get().current++;
    assert(counter.get().current === 1, "can be modified");
  });

  runInRequestScope(() => {
    assert(
      counter.get().current === 0,
      "is reinitialized for each request scope",
    );
    counter.get().current++;
    assert(counter.get().current === 1, "is modified per request scope");
  });
});

test("runInRequestScope", () => {
  assert.throws(() => {
    runInRequestScope(() => {
      runInRequestScope(() => {
        // noop.
      });
    });
  }, "cannot nest request scopes");
});

test("unsafeSingleton", () => {
  const counter = unsafeSingleton(() => ({ current: 0 }));
  assert(counter.current === 0, "initialized via provided constructor");
  counter.current++;
  assert(counter.current === 1, "can be modified");

  runInRequestScope(() => {
    assert(counter.current === 1, "is not affected by request scopes");
  });
});

test("unsafeGlobalEffect", () => {
  let counter = 0;
  assert(
    unsafeGlobalEffect(() => {
      counter++;
    }) === undefined,
    "there is no return value",
  );
  assert(counter === 1, "has been modified");

  runInRequestScope(() => {
    assert(counter === 1, "is not affected by request scopes");
  });
});
