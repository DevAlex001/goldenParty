export type SpotifyTrack = {
  id: string
  name: string
  artist: string
  albumArtUrl: string
  previewUrl: string | null
  spotifyUrl: string | null
}

type SpotifyTokenResponse = {
  access_token: string
  expires_in: number
}

type SpotifyPlaylistItem = {
  track: {
    id: string
    name: string
    preview_url: string | null
    external_urls?: { spotify?: string }
    artists: { name: string }[]
    album: {
      images: { url: string; width: number; height: number }[]
    }
  } | null
}

type SpotifyPlaylistResponse = {
  items: SpotifyPlaylistItem[]
  next: string | null
}

function tokenEndpoint() {
  const custom = import.meta.env.VITE_SPOTIFY_TOKEN_URL
  if (typeof custom === 'string' && custom.trim().length > 0) {
    return custom.trim()
  }
  if (import.meta.env.DEV) {
    return '/api/spotify/token'
  }
  return null
}

export function parsePlaylistId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const urlMatch = trimmed.match(/playlist\/([a-zA-Z0-9]+)/)
  if (urlMatch) return urlMatch[1]
  if (/^[a-zA-Z0-9]+$/.test(trimmed)) return trimmed
  return null
}

async function getAccessToken(): Promise<string> {
  const url = tokenEndpoint()
  if (!url) {
    throw new Error(
      'Spotify token no configurado. Usa npm run dev con .env o define VITE_SPOTIFY_TOKEN_URL.',
    )
  }
  const res = await fetch(url, { method: 'POST' })
  const text = await res.text()
  let data: Partial<SpotifyTokenResponse> & {
    error?: string
    error_description?: string
  } = {}
  if (text) {
    try {
      data = JSON.parse(text) as SpotifyTokenResponse & {
        error?: string
        error_description?: string
      }
    } catch {
      data = {}
    }
  }
  if (!res.ok) {
    const msg =
      data.error_description ||
      data.error ||
      text ||
      'No se pudo obtener el token de Spotify. ¿Tienes un archivo .env con Client ID y Secret?'
    throw new Error(msg)
  }
  if (!data.access_token) throw new Error('Respuesta de token inválida.')
  return data.access_token
}

function mapItem(item: SpotifyPlaylistItem): SpotifyTrack | null {
  const t = item.track
  if (!t?.id) return null
  const img = t.album?.images?.[0]?.url
  if (!img) return null
  return {
    id: t.id,
    name: t.name,
    artist: t.artists.map((a) => a.name).join(', '),
    albumArtUrl: img,
    previewUrl: t.preview_url,
    spotifyUrl: t.external_urls?.spotify ?? null,
  }
}

export async function fetchPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const token = await getAccessToken()
  const tracks: SpotifyTrack[] = []
  let url: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&market=US&fields=items(track(id,name,preview_url,external_urls,artists(name),album(images(url,width,height)))),next`

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const text = await res.text()
      let msg = text || `Spotify API error (${res.status})`
      if (res.status === 403) {
        msg =
          'La playlist debe ser pública, o necesitas iniciar sesión con Spotify (playlist privada).'
      }
      if (res.status === 404) {
        msg = 'Playlist no encontrada. Revisa VITE_SPOTIFY_PLAYLIST_ID en tu .env.'
      }
      throw new Error(msg)
    }
    const data = (await res.json()) as SpotifyPlaylistResponse
    for (const item of data.items) {
      const mapped = mapItem(item)
      if (mapped) tracks.push(mapped)
    }
    url = data.next
  }

  return tracks
}

/** 30s preview when Spotify has no preview_url (common on many tracks). */
export async function resolvePreviewUrl(track: SpotifyTrack): Promise<string | null> {
  if (track.previewUrl) return track.previewUrl
  const term = encodeURIComponent(`${track.artist} ${track.name}`)
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${term}&entity=song&limit=1`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as { results?: { previewUrl?: string }[] }
    return data.results?.[0]?.previewUrl ?? null
  } catch {
    return null
  }
}
