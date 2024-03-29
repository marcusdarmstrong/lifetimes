import assert from "node:assert";
import { test } from "node:test";

import {
  readOnly,
  requestLocal,
  requestLocalProxy,
  unsafeSingleton,
  unsafeGlobalEffect,
  runInRequestScope,
} from "./lifetimes.ts";

test("readOnly", async (t) => {
  await t.test("objects", () => {
    const obj = readOnly(() => ({ foo: true }));
    assert(obj.foo, "can be read");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      obj.bar = false;
    }, "cannot have new properties added");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      obj.foo = false;
    }, "cannot have properties redefined");
  });

  await t.test("arrays", () => {
    const arr = readOnly(() => [1, 2, 3, 4, 5]);
    assert(arr[0], "can be read");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      arr.push(6);
    }, "cannot have new values added");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      arr[0] = -1;
    }, "cannot have values redefined");
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
  });

  await t.test("dates", () => {
    const date = readOnly(() => new Date());
    assert(date.getTime(), "can be read");
    assert.throws(() => {
      // @ts-expect-error: This is readonly, of course.
      date.setMonth(0);
    }, "cannot be modified");
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

test("requestLocalProxy", () => {
  assert.throws(() => {
    // @ts-expect-error: does not accept primitives.
    requestLocalProxy(() => 0);
  }, "cannot wrap a primitive");

  assert(
    typeof requestLocalProxy(
      () =>
        function () {
          return 0;
        },
    ) === "function",
    "can proxy functions",
  );

  const counter = requestLocalProxy(() => ({ current: 0 }));

  assert.throws(
    () => counter.current,
    "cannot be accessed outside of a request",
  );

  runInRequestScope(() => {
    assert(counter.current === 0, "initialized via provided constructor");
    counter.current++;
    assert(counter.current === 1, "can be modified");
  });

  runInRequestScope(() => {
    assert(counter.current === 0, "is reinitialized for each request scope");
    counter.current++;
    assert(counter.current === 1, "is modified per request scope");
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
