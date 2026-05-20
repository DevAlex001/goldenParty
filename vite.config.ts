import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const LIST_LAMBDA =
  'https://yb2kwwkcmqgi5silinakvvmp4y0xgggn.lambda-url.us-east-2.on.aws'
const RSVP_LAMBDA =
  'https://gwcex3cb5gzdsdltu6wn4bljeq0arotj.lambda-url.us-east-2.on.aws'
const COMMENTS_POST_LAMBDA =
  'https://okzpybliflo6h2rxpakctwvtuy0gwazh.lambda-url.us-east-2.on.aws'
const COMMENTS_LIST_LAMBDA =
  'https://ykc62g4w4cqsb3uwntucodncym0ejhbt.lambda-url.us-east-2.on.aws'
const SPOTIFY_TOKEN_LAMBDA =
  'https://bbgyax7gc7d4tt7yhjtszjsjui0gsjgw.lambda-url.us-east-2.on.aws'

/** Parse KEY=value lines from a dotenv file (no quotes expansion). */
function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

/** .env wins over .env.example (so secrets belong in .env, not .example). */
function loadMergedEnv(mode: string, root: string) {
  return {
    ...parseEnvFile(join(root, '.env.example')),
    ...parseEnvFile(join(root, '.env.local')),
    ...parseEnvFile(join(root, '.env')),
    ...loadEnv(mode, root, ''),
  }
}

function spotifyTokenPlugin(getEnv: () => Record<string, string>) {
  return {
    name: 'spotify-token-dev',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/spotify/token', async (_req, res) => {
        const env = getEnv()
        const id = env.SPOTIFY_CLIENT_ID
        const secret = env.SPOTIFY_CLIENT_SECRET
        if (!id || !secret || id.includes('your_client')) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error:
                'Faltan SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET. Crea un archivo .env (copia .env.example).',
            }),
          )
          return
        }
        try {
          const body = new URLSearchParams({ grant_type: 'client_credentials' })
          const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
            },
            body: body.toString(),
          })
          const text = await tokenRes.text()
          res.statusCode = tokenRes.status
          res.setHeader('Content-Type', 'application/json')
          res.end(text)
        } catch {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Spotify token request failed' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const root = process.cwd()
  const env = loadMergedEnv(mode, root)

  return {
    plugins: [react(), spotifyTokenPlugin(() => loadMergedEnv(mode, root))],
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
        '/api/comments/list': {
          target: COMMENTS_LIST_LAMBDA,
          changeOrigin: true,
          rewrite: () => '/',
          secure: true,
        },
        '/api/comments': {
          target: COMMENTS_POST_LAMBDA,
          changeOrigin: true,
          rewrite: () => '/',
          secure: true,
        },
      },
    },
    define: {
      'process.env.VITE_INVITES_URL': JSON.stringify(LIST_LAMBDA),
      'process.env.VITE_RSVP_URL': JSON.stringify(RSVP_LAMBDA),
      'import.meta.env.VITE_SPOTIFY_PLAYLIST_ID': JSON.stringify(
        env.VITE_SPOTIFY_PLAYLIST_ID ?? '',
      ),
      'import.meta.env.VITE_SPOTIFY_TOKEN_URL': JSON.stringify(
        env.VITE_SPOTIFY_TOKEN_URL ?? SPOTIFY_TOKEN_LAMBDA,
      ),
    },
  }
})
