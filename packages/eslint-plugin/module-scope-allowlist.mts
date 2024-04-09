import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";
import { findModuleScopeSymbolDefinition } from "./scope-exploration.mts";

const RECOMMENDATION =
  "Expressions should be wrapped with a `lifetimes` designation such as `readOnly` or another allowed wrapper.";
const MESSAGES = {
  mayNotCallGlobal: `May not call global {{ callableName }} in module scope. ${RECOMMENDATION}`,
  mayNotCall: `May not call {{ callableName }} in module scope. ${RECOMMENDATION}`,
  mayNotCallUnknown: `May not call unknown function {{ callableName }} in module scope. ${RECOMMENDATION}`,
  mayNotConstructGlobal: `May not construct global {{ callableName }} in module scope. ${RECOMMENDATION}`,
  mayNotConstruct: `May not construct {{ callableName }} in module scope. ${RECOMMENDATION}`,
  mayNotConstructUnknown: `May not construct unknown value {{ callableName }} in module scope. ${RECOMMENDATION}`,
  mayNotCreateObject: `May not create mutable object in module scope. ${RECOMMENDATION}`,
  mayNotCreateArray: `May not create mutable array in module scope. ${RECOMMENDATION}`,
  mayNotCreateMutableVariable: `May not create mutable variable in module scope. ${RECOMMENDATION}`,
} as const;

type MessageIds = keyof typeof MESSAGES;

type Options = readonly [
  {
    allowedWrappers?: Record<string, string[]>;
    allowMutableDeclarations?: boolean;
  },
];

function getExportName(
  node:
    | TSESTree.ImportSpecifier
    | TSESTree.ImportDefaultSpecifier
    | TSESTree.ImportNamespaceSpecifier
    | TSESTree.TSImportEqualsDeclaration
    | TSESTree.VariableDeclarator,
) {
  if (node.type === "ImportSpecifier") {
    return node.imported.name;
  }
  if (node.type === "ImportDefaultSpecifier") {
    return "default";
  }
  return undefined;
}

function callableHook(
  context: TSESLint.RuleContext<MessageIds, Options>,
  allowedWrappers: Record<string, string[]>,
  allowedGlobals: Set<string>,
  node: TSESTree.NewExpression | TSESTree.CallExpression,
  unknownMessageId: MessageIds,
  globalMessageId: MessageIds,
  generalMessageId: MessageIds,
) {
  if (context.getScope().type === "module") {
    const { callableName, scopeVariable, definition } =
      findModuleScopeSymbolDefinition(context.getScope(), node);

    if (!scopeVariable) {
      // We'll pretend unknown variables are globals for the sake of allowlisting.
      if (allowedGlobals.has(callableName)) {
        return;
      }
      context.report({
        node,
        messageId: unknownMessageId,
        data: {
          callableName,
        },
      });
    } else if (!definition || !definition.parent) {
      // It's a known global
      if (allowedGlobals.has(callableName)) {
        return;
      }
      context.report({
        node,
        messageId: globalMessageId,
        data: {
          callableName,
        },
      });
    } else {
      if (
        definition.parent.type === "ImportDeclaration" &&
        allowedWrappers[definition.parent.source.value]?.includes(
          getExportName(definition.node) ?? callableName,
        )
      ) {
        return;
      }
      context.report({
        node,
        messageId: generalMessageId,
        data: {
          callableName,
        },
      });
    }
  }
}

// We specifically exempt objects and arrays that are declared inline as parameters of a function
// call in module scope. This allows more ergonomic usages of things like react's `createContext` in
// cases where a provided object literal, while technically mutable and in module scope, never has a
// reference in module scope, and thus, can't practically be mutated in an unsafe way.
function isInlineArgument(node: TSESTree.Node) {
  if (
    node.parent &&
    (node.parent.type === "CallExpression" ||
      node.parent.type === "NewExpression") &&
    node.parent.callee !== node
  ) {
    return true;
  }
  if (
    node.parent &&
    (node.parent.type === "ObjectExpression" ||
      node.parent.type === "ArrayExpression" ||
      (node.parent.type === "Property" && node.parent.value === node))
  ) {
    return isInlineArgument(node.parent);
  }
  return false;
}

export default ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    messages: MESSAGES,
    type: "problem",
    schema: [
      {
        type: "object",
        properties: {
          allowedWrappers: {
            type: "object",
          },
          allowMutableDeclarations: {
            type: "boolean",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ allowedWrappers: {}, allowMutableDeclarations: false }],
  create(context: TSESLint.RuleContext<MessageIds, Options>, options) {
    const { allowedWrappers = {}, allowMutableDeclarations = false } =
      options[0];
    const allowedGlobals = new Set(allowedWrappers["globalThis"] ?? []);
    return {
      CallExpression: (node: TSESTree.CallExpression) => {
        callableHook(
          context,
          allowedWrappers,
          allowedGlobals,
          node,
          "mayNotCallUnknown",
          "mayNotCallGlobal",
          "mayNotCall",
        );
      },

      NewExpression: (node: TSESTree.NewExpression) => {
        callableHook(
          context,
          allowedWrappers,
          allowedGlobals,
          node,
          "mayNotConstructUnknown",
          "mayNotConstructGlobal",
          "mayNotConstruct",
        );
      },
      ObjectExpression(node: TSESTree.ObjectExpression) {
        if (
          !allowMutableDeclarations &&
          context.getScope().type === "module" &&
          !isInlineArgument(node)
        ) {
          context.report({
            node,
            messageId: "mayNotCreateObject",
          });
        }
      },
      ArrayExpression(node: TSESTree.ArrayExpression) {
        if (
          !allowMutableDeclarations &&
          context.getScope().type === "module" &&
          !isInlineArgument(node)
        ) {
          context.report({
            node,
            messageId: "mayNotCreateArray",
          });
        }
      },
      VariableDeclaration(node: TSESTree.VariableDeclaration) {
        if (
          !allowMutableDeclarations &&
          node.kind != "const" &&
          context.getScope().type === "module"
        ) {
          context.report({
            node,
            messageId: "mayNotCreateMutableVariable",
          });
        }
      },
    };
  },
});
