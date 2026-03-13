import { defineConfig } from 'tsup'

export default defineConfig({
  sourcemap: false,
  minify: true,
  dts: true,
  format: ['esm', 'cjs'],
  splitting: false,
  loader: {
    '.js': 'jsx',
  },
})
