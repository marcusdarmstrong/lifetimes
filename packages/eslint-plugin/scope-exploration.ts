import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

/**
 * Given a node, try to identify an Identifier that can be correlated to a
 * Variable in the parent scope(s). Specifically, this has the behavior of
 * looking beneath one layer of dispatch, such that we identify "Date" for a
 * `Date.now` MemberExpression.
 */
function findScopeIdentifier(node: TSESTree.Node) {
  if (node.type === "MemberExpression" && node.object.type === "Identifier") {
    return node.object;
  }
  if (node.type === "CallExpression" && node.callee.type === "Identifier") {
    return node.callee;
  }
  if (node.type === "Identifier") {
    return node;
  }
  return null;
}

/**
 * Computes a best-effort name for a provided callable node.
 */
function getName(node: TSESTree.Node) {
  if (node.type === "MemberExpression") {
    if (node.computed) {
      return `property of ${printRef(node.object)}`;
    }
    return printRef(node);
  }
  if (node.type === "CallExpression") {
    return `result of ${printRef(node.callee)}`;
  }
  if (node.type === "Identifier") {
    return node.name;
  }
  if (node.type === "NewExpression") {
    return `new of ${printRef(node.callee)}`;
  }
  return "unknown";
}

/**
 * Given an property access chain, strips out TS Casts/type assertions and
 * normalizes the property accesses into a standard format suitable for
 * deduplication of references to symbols in global scope, and presentation to
 * users in messaging.
 */
function printRef(node: TSESTree.Node, prefix = ""): string {
  let realPrefix = prefix === "window." ? "" : prefix;
  realPrefix = realPrefix === "global." ? "" : realPrefix;
  realPrefix = realPrefix === "globalThis." ? "" : realPrefix;

  if (node.type === "MemberExpression") {
    const newPrefix = printRef(node.object, realPrefix);
    return printRef(node.property, newPrefix ? `${newPrefix}.` : "");
  }
  if (node.type === "TSTypeAssertion" || node.type === "TSAsExpression") {
    return printRef(node.expression, prefix);
  }
  if (node.type === "Identifier") {
    return realPrefix + node.name;
  }
  return prefix;
}

/**
 * For a provided ESLint Scope with type = "module", and a provided callable
 * node, compute and find:
 *  1. a user-friendly name for that callable node
 *  2. the `Variable` in that scope or global scope that the node corresponds to
 *  3. If such a variable exists, the `Definition` of that variable
 *
 * In doing so, we can identify imported symbols based on their Definition, and
 * global variables, whether defined in ESLint config (i.e. they have a
 * `Variable` but not a `Definition`), or not known at all by ESLint (No
 * `Variable`, nor `Definition`).
 */
export function findModuleScopeSymbolDefinition(
  scope: TSESLint.Scope.Scope,
  node: TSESTree.CallExpression | TSESTree.NewExpression,
) {
  const scopeIdentifier = findScopeIdentifier(node.callee);
  const callableName = getName(node.callee);
  const scopeVariable =
    // Initial scope is module scope.
    scope.variables.find(({ references }) =>
      references.some(({ identifier }) => identifier === scopeIdentifier),
    ) ??
    // Second check is to find configured globals.
    scope.upper?.variables?.find(({ references }) =>
      references.some(({ identifier }) => identifier === scopeIdentifier),
    );
  return {
    callableName,
    scopeVariable,
    definition: scopeVariable?.defs?.[0],
  };
}
