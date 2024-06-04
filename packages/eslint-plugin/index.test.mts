import { RuleTester } from "@typescript-eslint/rule-tester";
import moduleScopeAllowlist from "./module-scope-allowlist.mts";
import moduleScopeRequired from "./module-scope-required.mts";
import { after, describe, it } from "node:test";

RuleTester.afterAll = after;
RuleTester.describe = describe;
RuleTester.it = it;

const parserOptions = {
  ecmaVersion: 2022 as const,
  sourceType: "module" as const,
};

new RuleTester({ parser: "@typescript-eslint/parser" }).run(
  "module-scope-allowlist",
  moduleScopeAllowlist,
  {
    valid: [
      {
        code: "const a = 1;",
        parserOptions,
      },
      {
        code: "const a = true;",
        parserOptions,
      },
      {
        code: "const a = /foo/;",
        parserOptions,
      },
      {
        code: "const a = null;",
        parserOptions,
      },
      {
        code: "const a = undefined;",
        parserOptions,
      },
      {
        code: "const a = 'hello world';",
        parserOptions,
      },
      {
        code: "export default function () { foo(); }",
        parserOptions,
      },
      {
        code: "import { readOnly } from 'lifetimes'; readOnly(() => foo());",
        parserOptions,
        options: [{ allowedWrappers: { lifetimes: ["readOnly"] } }],
      },
      {
        code: "import { readOnly as ro } from 'lifetimes'; ro(() => foo());",
        parserOptions,
        options: [{ allowedWrappers: { lifetimes: ["readOnly"] } }],
      },
      {
        code: "import ro from 'lifetimes'; ro(() => foo());",
        parserOptions,
        options: [{ allowedWrappers: { lifetimes: ["default"] } }],
      },
      {
        code: "import ro from 'lifetimes'; ro({ foo: { bar: [1, 2, 3] }});",
        parserOptions,
        options: [{ allowedWrappers: { lifetimes: ["default"] } }],
      },
      {
        code: "import ro from 'lifetimes'; ro({ foo: 1234 } as const);",
        parserOptions,
        options: [{ allowedWrappers: { lifetimes: ["default"] } }],
      },
    ],
    invalid: [
      {
        code: "const a = {};",
        parserOptions,
        errors: [
          {
            messageId: "mayNotCreateObject",
          },
        ],
      },
      {
        code: "const a = [];",
        parserOptions,
        errors: [
          {
            messageId: "mayNotCreateArray",
          },
        ],
      },
      {
        code: "var a = true;",
        parserOptions,
        errors: [
          {
            messageId: "mayNotCreateMutableVariable",
          },
        ],
      },
      {
        code: "let a = true;",
        parserOptions,
        errors: [
          {
            messageId: "mayNotCreateMutableVariable",
          },
        ],
      },
      {
        code: "import { readOnly } from 'lifetimes'; readOnly(() => foo());",
        parserOptions,
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
        parserOptions,
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
        parserOptions,
        env: {
          browser: true,
          node: true,
          es6: true,
          es2022: true,
        },
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
  },
);

new RuleTester().run("module-scope-required", moduleScopeRequired, {
  valid: [
    {
      code: "import { readOnly } from 'lifetimes'; readOnly(() => foo());",
      parserOptions,
      options: [{ requiredModuleScopeCallables: { lifetimes: ["readOnly"] } }],
    },
  ],
  invalid: [
    {
      code: "import { readOnly } from 'lifetimes'; foo(() => readOnly());",
      parserOptions,
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
