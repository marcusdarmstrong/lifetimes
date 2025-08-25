import { RuleTester } from "@typescript-eslint/rule-tester";
import moduleScopeAllowlist from "./module-scope-allowlist.mts";
import moduleScopeRequired from "./module-scope-required.mts";
import { after, describe, it } from "node:test";

RuleTester.afterAll = after;
RuleTester.describe = describe;
RuleTester.it = it;

new RuleTester().run("module-scope-allowlist", moduleScopeAllowlist, {
  valid: [
    {
      code: "const a = 1;",
    },
    {
      code: "const a = true;",
    },
    {
      code: "const a = /foo/;",
    },
    {
      code: "const a = null;",
    },
    {
      code: "const a = undefined;",
    },
    {
      code: "const a = 'hello world';",
    },
    {
      code: "export default function () { foo(); }",
    },
    {
      code: "import { readOnly } from 'lifetimes'; readOnly(() => foo());",
      options: [{ allowedWrappers: { lifetimes: ["readOnly"] } }],
    },
    {
      code: "import { readOnly as ro } from 'lifetimes'; ro(() => foo());",
      options: [{ allowedWrappers: { lifetimes: ["readOnly"] } }],
    },
    {
      code: "import ro from 'lifetimes'; ro(() => foo());",
      options: [{ allowedWrappers: { lifetimes: ["default"] } }],
    },
    {
      code: "import ro from 'lifetimes'; ro({ foo: { bar: [1, 2, 3] }});",
      options: [{ allowedWrappers: { lifetimes: ["default"] } }],
    },
    {
      code: "import ro from 'lifetimes'; ro({ foo: 1234 } as const);",
      options: [{ allowedWrappers: { lifetimes: ["default"] } }],
    },
  ],
  invalid: [
    {
      code: "const a = {};",
      errors: [
        {
          messageId: "mayNotCreateObject",
        },
      ],
    },
    {
      code: "const a = [];",
      errors: [
        {
          messageId: "mayNotCreateArray",
        },
      ],
    },
    {
      code: "const a = /foo/g;",
      errors: [
        {
          messageId: "mayNotCreateStatefulRegexp",
        },
      ],
    },
    {
      code: "var a = true;",
      errors: [
        {
          messageId: "mayNotCreateMutableVariable",
        },
      ],
    },
    {
      code: "let a = true;",
      errors: [
        {
          messageId: "mayNotCreateMutableVariable",
        },
      ],
    },
    {
      code: "import { readOnly } from 'lifetimes'; readOnly(() => foo());",
      errors: [
        {
          messageId: "mayNotCall",
          data: {
            callableName: "readOnly",
          },
        },
      ],
    },
    {
      code: "foo()",
      errors: [
        {
          messageId: "mayNotCallUnknown",
          data: {
            callableName: "foo",
          },
        },
      ],
    },
    {
      code: "new Set()",
      errors: [
        {
          messageId: "mayNotConstructGlobal",
          data: {
            callableName: "Set",
          },
        },
      ],
    },
  ],
});

new RuleTester().run("module-scope-required", moduleScopeRequired, {
  valid: [
    {
      code: "import { readOnly } from 'lifetimes'; readOnly(() => foo());",
      options: [{ requiredModuleScopeCallables: { lifetimes: ["readOnly"] } }],
    },
  ],
  invalid: [
    {
      code: "import { readOnly } from 'lifetimes'; foo(() => readOnly());",
      options: [{ requiredModuleScopeCallables: { lifetimes: ["readOnly"] } }],
      errors: [
        {
          messageId: "mustBeCalledInModuleScope",
          data: {
            callableName: "readOnly",
          },
        },
      ],
    },
  ],
});
