import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    api: false,
    environment: 'node',
  },
});

