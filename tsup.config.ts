import { defineConfig } from 'tsup';

export default defineConfig({
  // seed is compiled too, so production images can seed without tsx
  entry: { server: 'src/server.ts', seed: 'prisma/seed.ts' },
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  publicDir: false,
});
