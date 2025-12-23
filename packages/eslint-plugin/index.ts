import pkg from "./package.json" with { type: "json" };
import moduleScopeAllowlist from "./module-scope-allowlist.ts";
import moduleScopeRequired from "./module-scope-required.ts";

const lifetimesModuleScopeExports = [
  "readOnly",
  "requestLocal",
  "requestLocalProxy",
  "unsafeSingleton",
  "unsafeGlobalEffect",
];
const reactModuleScopeExports = [
  "lazy",
  "memo",
  "cache",
  "createContext",
  "forwardRef",
];

const plugin = {
  meta: {
    name: pkg.name,
    version: pkg.version,
  },
  rules: {
    "module-scope-allowlist": moduleScopeAllowlist,
    "module-scope-required": moduleScopeRequired,
  },
};

export default {
  plugin,
  configs: {
    recommended: {
      plugins: {
        "@lifetimes": plugin,
      },
      rules: {
        "@lifetimes/module-scope-allowlist": [
          2,
          {
            allowMutableDeclarations: false,
            allowedWrappers: {
              lifetimes: lifetimesModuleScopeExports,
            },
          },
        ],
        "@lifetimes/module-scope-required": [
          2,
          {
            requiredModuleScopeCallables: {
              lifetimes: lifetimesModuleScopeExports,
            },
          },
        ],
      },
    },
    react: {
      plugins: {
        "@lifetimes": plugin,
      },
      rules: {
        "@lifetimes/module-scope-allowlist": [
          2,
          {
            allowedWrappers: {
              lifetimes: lifetimesModuleScopeExports,
              react: reactModuleScopeExports,
            },
          },
        ],
        "@lifetimes/module-scope-required": [
          2,
          {
            requiredModuleScopeCallables: {
              lifetimes: lifetimesModuleScopeExports,
              react: reactModuleScopeExports,
            },
          },
        ],
      },
    },
  },
};
