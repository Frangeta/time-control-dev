import { defineConfig } from 'vite'

export default defineConfig({
  // Para GitHub Pages con repo en subdirectorio /time-control-dev/
  // base debe coincidir con el nombre del repo
  base: '/time-control-dev/',
  build: {
    outDir: 'dist',
  },
})
