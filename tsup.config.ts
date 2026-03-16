import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.tsx',
    providers: 'src/providers/index.ts',
    'providers/anthropic': 'src/providers/anthropic.ts',
    'providers/openai': 'src/providers/openai.ts',
    'providers/google': 'src/providers/google.ts',
  },
  sourcemap: false,
  minify: true,
  dts: true,
  format: ['esm', 'cjs'],
  splitting: false,
  loader: { '.js': 'jsx' },
  external: ['react', 'react-dom'],
})
