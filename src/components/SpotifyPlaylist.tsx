import { useEffect, useRef, useState } from 'react'
import {
  fetchPlaylistTracks,
  parsePlaylistId,
  resolvePreviewUrl,
  type SpotifyTrack,
} from '../lib/spotify'
import './SpotifyPlaylist.css'

type Props = {
  onSelectTrack: (track: SpotifyTrack) => void
  activeTrackId: string | null
}

export default function SpotifyPlaylist({ onSelectTrack, activeTrackId }: Props) {
  const playlistRaw = import.meta.env.VITE_SPOTIFY_PLAYLIST_ID ?? ''
  const playlistId = parsePlaylistId(playlistRaw)

  const [tracks, setTracks] = useState<SpotifyTrack[]>([])
  const [loading, setLoading] = useState(!!playlistId)
  const [error, setError] = useState<string | null>(null)
  const [playStatus, setPlayStatus] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!playlistId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const list = await fetchPlaylistTracks(playlistId)
        if (!cancelled) setTracks(list)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la playlist.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [playlistId])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  async function handleSelect(track: SpotifyTrack) {
    // If the same track is playing, stop it
    if (activeTrackId === track.id && isPlaying) {
      audioRef.current?.pause()
      audioRef.current = null
      setIsPlaying(false)
      setPlayStatus(null)
      return
    }

    onSelectTrack(track)
    setPlayStatus(null)
    setIsPlaying(false)
    audioRef.current?.pause()
    audioRef.current = null

    setPreviewLoading(true)
    const preview = await resolvePreviewUrl(track)
    setPreviewLoading(false)

    if (!preview) {
      setPlayStatus('No hay preview de 30s para esta canción — el fondo sí cambió.')
      return
    }

    const audio = new Audio(preview)
    audio.volume = 0.9
    audioRef.current = audio

    audio.addEventListener('ended', () => {
      setPlayStatus(null)
      setIsPlaying(false)
    })

    try {
      await audio.play()
      setIsPlaying(true)
      setPlayStatus(`Reproduciendo preview · ${track.name}`)
    } catch {
      setPlayStatus('El navegador bloqueó el audio. Toca otra vez la canción.')
    }
  }

  if (!playlistId) {
    return (
      <section className="spotify panel page-block" aria-label="Música">
        <h2>Música de la fiesta</h2>
        <p className="spotify-hint">
          Configura <code>VITE_SPOTIFY_PLAYLIST_ID</code> en tu archivo <code>.env</code> con el
          enlace de tu playlist de Spotify.
        </p>
      </section>
    )
  }

  return (
    <section className="spotify panel page-block" aria-label="Música de la fiesta">
      <h2>Música de la fiesta</h2>
      <p className="spotify-hint">Toca una canción — el fondo cambia y suena un preview de ~30s.</p>
      {previewLoading ? <p className="spotify-status">Cargando audio…</p> : null}
      {playStatus ? <p className="spotify-now-playing">{playStatus}</p> : null}
      {loading ? <p className="spotify-status">Cargando playlist…</p> : null}
      {error ? <p className="spotify-error">{error}</p> : null}
      {!loading && !error && tracks.length > 0 ? (
        <ul className="track-list">
          {tracks.map((track) => (
            <li key={track.id}>
              <button
                type="button"
                className={`track-btn${activeTrackId === track.id ? ' is-active' : ''}${activeTrackId === track.id && isPlaying ? ' is-playing' : ''}`}
                onClick={() => void handleSelect(track)}
                aria-label={activeTrackId === track.id && isPlaying ? `Detener ${track.name}` : `Reproducir ${track.name}`}
              >
                <img src={track.albumArtUrl} alt="" className="track-thumb" width={40} height={40} />
                <span className="track-meta">
                  <span className="track-name">{track.name}</span>
                  <span className="track-artist">{track.artist}</span>
                </span>
                {activeTrackId === track.id && isPlaying ? (
                  <span className="track-stop-icon" aria-hidden>⏹</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
