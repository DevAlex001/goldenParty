/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_PLAYLIST_ID?: string
  /** Lambda URL that returns a fresh Spotify access_token (required in production). */
  readonly VITE_SPOTIFY_TOKEN_URL?: string
  readonly VITE_INVITES_URL?: string
  readonly VITE_RSVP_URL?: string
  readonly VITE_COMMENTS_POST_URL?: string
  readonly VITE_COMMENTS_LIST_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
