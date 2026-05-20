/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_PLAYLIST_ID?: string
  /** Lambda URL that returns Spotify token (production). */
  readonly VITE_SPOTIFY_TOKEN_URL?: string
  /** Set only in CI build; token expires ~1h — prefer VITE_SPOTIFY_TOKEN_URL. */
  readonly VITE_SPOTIFY_ACCESS_TOKEN?: string
  readonly VITE_INVITES_URL?: string
  readonly VITE_RSVP_URL?: string
  readonly VITE_COMMENTS_POST_URL?: string
  readonly VITE_COMMENTS_LIST_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
