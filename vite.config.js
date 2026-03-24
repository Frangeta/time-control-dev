import { defineConfig } from 'vite'

export default defineConfig({
  // base: './' permite que GitHub Pages sirva los assets correctamente
  // independientemente del nombre del repositorio
  base: './',
  build: {
    outDir: 'dist',
  },
})
