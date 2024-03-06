import { name, version } from "./package.json";
import moduleScopeAllowlist from "./module-scope-allowlist.mts";
import moduleScopeRequired from "./module-scope-required.mts";

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

module.exports = {
  meta: {
    name,
    version,
  },
  configs: {
    recommended: {
      plugins: ["@lifetimes"],
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
      plugins: ["@lifetimes"],
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
  rules: {
    "module-scope-allowlist": moduleScopeAllowlist,
    "module-scope-required": moduleScopeRequired,
  },
};
