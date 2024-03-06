import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";
import { findModuleScopeSymbolDefinition } from "./scope-exploration.mts";

const MESSAGES = {
  mustBeCalledInModuleScope:
    "{{ callableName }} must be called in module scope",
} as const;

type MessageIds = keyof typeof MESSAGES;

type Options = readonly [
  {
    requiredModuleScopeCallables?: Record<string, string[]>;
  },
];

export default ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    messages: MESSAGES,
    type: "problem",
    schema: [
      {
        type: "object",
        properties: {
          requiredModuleScopeCallables: {
            type: "object",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ requiredModuleScopeCallables: {} }],
  create(context: TSESLint.RuleContext<MessageIds, Options>, options: Options) {
    const { requiredModuleScopeCallables = {} } = options[0];
    return {
      CallExpression: (node: TSESTree.CallExpression) => {
        if (context.getScope().type !== "module") {
          let moduleScope = context.getScope();
          while (moduleScope.type !== "module" && moduleScope.upper !== null) {
            moduleScope = moduleScope.upper;
          }

          const { callableName, definition } = findModuleScopeSymbolDefinition(
            moduleScope,
            node,
          );

          if (
            definition &&
            definition.type === "ImportBinding" &&
            definition.parent.type === "ImportDeclaration" &&
            requiredModuleScopeCallables[
              definition.parent.source.value
            ]?.includes(
              definition.node.type === "ImportSpecifier"
                ? definition.node.imported.name ?? callableName
                : callableName,
            )
          ) {
            context.report({
              node,
              messageId: "mustBeCalledInModuleScope",
              data: {
                callableName,
              },
            });
          }
        }
      },
    };
  },
});
