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

const DEFAULT_SPOTIFY_TOKEN =
  'https://bbgyax7gc7d4tt7yhjtszjsjui0gsjgw.lambda-url.us-east-2.on.aws/'

function normalizeApiBase(url: string) {
  const t = url.trim()
  return t.endsWith('/') ? t : `${t}/`
}

function resolveApiUrl(
  envValue: string | undefined,
  productionDefault: string,
  devProxyPath: string,
) {
  if (typeof envValue === 'string' && envValue.trim().length > 0) {
    return normalizeApiBase(envValue)
  }
  if (import.meta.env.DEV) return devProxyPath
  return normalizeApiBase(productionDefault)
}

function tokenEndpoint(): string {
  return resolveApiUrl(
    import.meta.env.VITE_SPOTIFY_TOKEN_URL,
    DEFAULT_SPOTIFY_TOKEN,
    '/api/spotify/token',
  )
}

export function parsePlaylistId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const urlMatch = trimmed.match(/playlist\/([a-zA-Z0-9]+)/)
  if (urlMatch) return urlMatch[1]
  if (/^[a-zA-Z0-9]+$/.test(trimmed)) return trimmed
  return null
}

async function parseTokenResponse(res: Response): Promise<string> {
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
      'No se pudo obtener el token de Spotify.'
    throw new Error(msg)
  }
  if (!data.access_token) throw new Error('Respuesta de token inválida.')
  return data.access_token
}

/** Pide un token nuevo en cada visita (no caduca como el del build). */
export async function getAccessToken(): Promise<string> {
  const res = await fetch(tokenEndpoint(), { method: 'POST', cache: 'no-store' })
  return parseTokenResponse(res)
}

function spotifyApiError(status: number, text: string): string {
  if (status === 401) {
    try {
      const j = JSON.parse(text) as { error?: { message?: string } }
      if (j.error?.message?.toLowerCase().includes('expired')) {
        return 'El token de Spotify expiró. Despliega la Lambda de token y configura VITE_SPOTIFY_TOKEN_URL en GitHub (no embebas el token en el build).'
      }
    } catch {
      /* ignore */
    }
    return 'Token de Spotify inválido o expirado. Revisa VITE_SPOTIFY_TOKEN_URL.'
  }
  if (status === 403) {
    return 'La playlist debe ser pública.'
  }
  if (status === 404) {
    return 'Playlist no encontrada. Revisa VITE_SPOTIFY_PLAYLIST_ID.'
  }
  return text || `Spotify API error (${status})`
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
  let token = await getAccessToken()
  const tracks: SpotifyTrack[] = []
  let url: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&market=US&fields=items(track(id,name,preview_url,external_urls,artists(name),album(images(url,width,height)))),next`

  while (url) {
    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (res.status === 401) {
      token = await getAccessToken()
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
    }

    if (!res.ok) {
      const text = await res.text()
      throw new Error(spotifyApiError(res.status, text))
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
