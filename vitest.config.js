import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Sin entorno browser: las funciones puras no necesitan DOM
    environment: 'node',
    // Reporte legible en CI
    reporter: ['verbose'],
    // Cobertura básica (opcional, se activa con --coverage)
    coverage: {
      provider: 'v8',
      include: ['src/utils.js', 'src/store.js'],
      reporter: ['text', 'lcov'],
    },
  },
});
