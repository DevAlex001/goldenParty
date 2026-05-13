import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const LIST_LAMBDA =
  'https://yb2kwwkcmqgi5silinakvvmp4y0xgggn.lambda-url.us-east-2.on.aws'
const RSVP_LAMBDA =
  'https://gwcex3cb5gzdsdltu6wn4bljeq0arotj.lambda-url.us-east-2.on.aws'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 1. Añadimos la base para GitHub Pages
  base: '/goldenParty/', 
  server: {
    proxy: {
      '/api/invites': {
        target: LIST_LAMBDA,
        changeOrigin: true,
        rewrite: () => '/',
        secure: true,
      },
      '/api/rsvp': {
        target: RSVP_LAMBDA,
        changeOrigin: true,
        rewrite: () => '/',
        secure: true,
      },
    },
  },
  // 2. Definimos variables globales para usar en el código
  define: {
    'process.env.VITE_INVITES_URL': JSON.stringify(LIST_LAMBDA),
    'process.env.VITE_RSVP_URL': JSON.stringify(RSVP_LAMBDA),
  }
})