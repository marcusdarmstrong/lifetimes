import { nodeResolve } from '@rollup/plugin-node-resolve';
import eslint from '@rollup/plugin-eslint';
import json from '@rollup/plugin-json';
import { swc } from '@rollup/plugin-swc';

function plugins() {
  return [
    swc({
      include: ["*.mts"],
      swc: {
        jsc: {
          parser: { syntax: 'typescript' },
        }
      }
    }),
    nodeResolve({
      extensions: ['.mts', '.json'],
      exportConditions: ["node"],
    }),
    json({ preferConst: true }),
    eslint({
      fix: true,
      throwOnError: true,
      throwOnWarning: true,
      include: '*.mts',
    }),
  ];
}

export default [{
  input: "index.mts",
  output: {
    format: "commonjs",
    file: `dist/index.js`,
    sourcemap: true,
  },
  plugins: plugins(),
  external: ["@typescript-eslint/utils"],
}, {
  input: "index.test.mts",
  output: {
    file: `dist/index.test.mjs`,
    sourcemap: true,
  },
  plugins: plugins(),
  // plugin-node-resolve uses an out-of-date builtins list, so we need to specify node:test manually.
  external: ["@typescript-eslint/utils", "@typescript-eslint/rule-tester", "node:test"],
}];
