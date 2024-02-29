import { createServer } from "node:http";
import {
  readOnly,
  requestLocal,
  runInRequestScope,
  unsafeSingleton,
  unsafeGlobalEffect,
} from "lifetimes";

// We use a React "ref"-style `current` object wrapper here to enable us to use
// a `const` variable declaration while manipulating a number.
const requestCount = unsafeSingleton(() => ({ current: 0 }));

// For each request, we'll lazily execute this callback to generate a new,
// random request id. That'll then be held consistently across all async work
// that's a part of that request lifecycle.
const id = requestLocal(() => Math.random());

// For static data that we've hoisted out to module scope, we can use the
// `readOnly` lifetime to enforce that these objects are being used as expected.
const PATHS = readOnly(() => new Set(["/foo", "/bar"]));
const ROUTES = readOnly(() => ({
  "/foo": "Hello foo",
  "/bar": "Hello bar",
}));
const RETRY_TIMEOUTS = readOnly(() => [1, 2, 3, 5, 8, 13, 21]);

// Functions themselves are inherently stateless, and require no lifetime.
function logWithId(marker: string) {
  console.log(requestCount.current, id.get(), marker);
}

// Connecting our http server to a port is an operation with global side effects
// so we'll document as much with the `unsafeGlobalEffect` lifetime.
unsafeGlobalEffect(() => {
  createServer((req, res) => {
    requestCount.current++;

    // To ensure `requestLocal`s work as expected, we need to designate the root
    // of our request handling with the `runInRequestScope` helper.
    runInRequestScope(() => {
      logWithId("start");

      res.statusCode = 200;
      try {
        // `readOnly` has runtime and typecheck time enforcement for Sets & Maps
        // @ts-expect-error: This is readonly, of course.
        PATHS.add("/helloworld");
      } catch (e) {
        console.log(e);
      }
      try {
        // `readOnly` also has runtime and typecheck time enforcement for standard
        // object maps.
        // @ts-expect-error: This is readonly, of course.
        ROUTES["/foo"] = "Hello home";
      } catch (e) {
        console.log(e);
      }

      try {
        // `readOnly` also has runtime and typecheck time enforcement for arrays and
        // @ts-expect-error: This is readonly, of course.
        RETRY_TIMEOUTS.sort();
      } catch (e) {
        console.log(e);
      }

      // readOnly and other lifetimes are only callable directly in module scope
      // eslint-disable-next-line @lifetimes/module-scope-required
      readOnly(() => 123);

      if (req.url && PATHS.has(req.url)) {
        res.write(ROUTES[req.url as keyof typeof ROUTES]);
      } else {
        res.write("Goodbye world");
      }

      setImmediate(() => {
        // Notably, even though this callback runs in another tick, the
        // requestLocal `id` retains its value appropriately.
        logWithId("finish");
        res.end();
      });
    });
  }).listen(8780);
});
