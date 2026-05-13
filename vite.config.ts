import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const LIST_LAMBDA =
  'https://yb2kwwkcmqgi5silinakvvmp4y0xgggn.lambda-url.us-east-2.on.aws'
const RSVP_LAMBDA =
  'https://gwcex3cb5gzdsdltu6wn4bljeq0arotj.lambda-url.us-east-2.on.aws'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Dev-only: browser talks to same origin, Vite forwards to Lambda (no CORS preflight pain).
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
})
