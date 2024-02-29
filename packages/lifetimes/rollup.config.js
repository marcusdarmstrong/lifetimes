import { nodeResolve } from '@rollup/plugin-node-resolve';
import eslint from '@rollup/plugin-eslint';
import { swc } from '@rollup/plugin-swc';

function output(suffix) {
  return {
    file: `dist/lifetimes.${suffix}.js`,
    sourcemap: true,
  };
}

function plugins(exportCondition) {
  return [
    nodeResolve({
      extensions: ['.ts'],
      exportConditions: [exportCondition],
    }),
    eslint({
      fix: true,
      throwOnError: true,
      throwOnWarning: true,
      include: '*.ts',
    }),
    swc({
      swc: {
        jsc: {
          parser: { syntax: 'typescript' },
        }
      }
    }),
  ];
}

export default [{
  input: "lifetimes.ts",
  output: output("browser"),
  plugins: plugins("browser"),
}, {
  input: "lifetimes.ts",
  output: output("node"),
  plugins: plugins("node"),
}, {
  input: "lifetimes.test.ts",
  output: output("test"),
  plugins: plugins("node"),
  // plugin-node-resolve uses an out-of-date builtins list.
  external: ["node:test"],
}];
