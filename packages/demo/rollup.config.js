import { nodeResolve } from '@rollup/plugin-node-resolve';
import eslint from '@rollup/plugin-eslint';
import { swc } from '@rollup/plugin-swc';

export default {
  input: "demo.ts",
  output: {
    file: "dist/demo.js",
    sourcemap: true,
  },
  plugins: [
    nodeResolve({
      extensions: ['.ts'],
      exportConditions: ["node"],
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
  ],
};
