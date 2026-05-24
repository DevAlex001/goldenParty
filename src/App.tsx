import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import CommentsSection from './components/CommentsSection'
import SpotifyPlaylist from './components/SpotifyPlaylist'
import type { SpotifyTrack } from './lib/spotify'
import './App.css'

const STORAGE_KEY = 'golden-party:guests'

const DEFAULT_INVITE =
  'https://gwcex3cb5gzdsdltu6wn4bljeq0arotj.lambda-url.us-east-2.on.aws/'
const DEFAULT_LIST =
  'https://yb2kwwkcmqgi5silinakvvmp4y0xgggn.lambda-url.us-east-2.on.aws/'



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

const INVITE_API_URL = resolveApiUrl(
  import.meta.env.VITE_RSVP_URL,
  DEFAULT_INVITE,
  '/api/rsvp/',
)

const LIST_API_URL = resolveApiUrl(import.meta.env.VITE_INVITES_URL, DEFAULT_LIST, '/api/invites/')

type Guest = {
  id: string
  name: string
  nick: string
  joinedAt: number
}

type InvitePostResponse = {
  message?: string
  id_generado?: string
  item_completo?: {
    id?: string
    name?: string
    nick?: string
    fecha_creacion?: string
  }
}

type ListResponse = {
  total?: number
  invitados?: unknown[]
}

function saveGuests(guests: Guest[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(guests))
}

function loadGuestsFromCache(): Guest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((g): Guest | null => {
        if (typeof g !== 'object' || g === null) return null
        const o = g as Record<string, unknown>
        const id = typeof o.id === 'string' ? o.id : null
        const name = typeof o.name === 'string' ? o.name : null
        const joinedAt = typeof o.joinedAt === 'number' ? o.joinedAt : null
        if (!id || !name || joinedAt === null) return null
        const nick = typeof o.nick === 'string' && o.nick.trim() ? o.nick : name
        return { id, name, nick, joinedAt }
      })
      .filter((g): g is Guest => g !== null)
  } catch {
    return []
  }
}

function parseGuestFromApi(raw: unknown): Guest | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id : null
  const name = typeof o.name === 'string' ? o.name : null
  if (!id || !name) return null
  const nickRaw = typeof o.nick === 'string' ? o.nick.trim() : ''
  const nick = nickRaw.length > 0 ? nickRaw : name
  let joinedAt = Date.now()
  const fc = o.fecha_creacion
  if (typeof fc === 'string') {
    const parsed = Date.parse(fc)
    if (!Number.isNaN(parsed)) joinedAt = parsed
  }
  return { id, name, nick, joinedAt }
}

async function fetchInvites(): Promise<Guest[]> {
  const res = await fetch(LIST_API_URL, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text.trim() || `Could not load invites (${res.status})`)
  }
  let data: ListResponse
  try {
    data = text ? (JSON.parse(text) as ListResponse) : {}
  } catch {
    throw new Error('Unexpected response from invite list.')
  }
  const items = Array.isArray(data.invitados) ? data.invitados : []
  return items
    .map(parseGuestFromApi)
    .filter((g): g is Guest => g !== null)
    .sort((a, b) => b.joinedAt - a.joinedAt)
}

function GuestFlipCard({ guest, staggerIndex }: { guest: Guest; staggerIndex: number }) {
  const [flipped, setFlipped] = useState(false)
  const style = {
    '--stagger': String(Math.min(staggerIndex, 12)),
  } as CSSProperties

  return (
    <li className="guest-item" style={style}>
      <button
        type="button"
        className="guest-flip"
        aria-expanded={flipped}
        aria-label={
          flipped
            ? `Mostrando el nombre completo ${guest.name}. Presiona para mostrar el Nick.`
            : `Nick ${guest.nick}. Presiona para mostrar el nombre completo.`
        }
        onClick={() => setFlipped((v) => !v)}
      >
        <div className={`flip-inner${flipped ? ' is-flipped' : ''}`}>
          <div className="flip-face flip-front">
            <span className="flip-text">{guest.nick}</span>
          </div>
          <div className="flip-face flip-back">
            <span className="flip-text">{guest.name}</span>
          </div>
        </div>
      </button>
    </li>
  )
}

export default function App() {
  const [guests, setGuests] = useState<Guest[]>([])
  const [name, setName] = useState('')
  const [nick, setNick] = useState('')
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [rsvpOpen, setRsvpOpen] = useState(false)
  const [activeTrack, setActiveTrack] = useState<SpotifyTrack | null>(null)

  const refreshGuests = useCallback(async () => {
    const next = await fetchInvites()
    setGuests(next)
    saveGuests(next)
    return next
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setListLoading(true)
      setListError(null)
      try {
        const remote = await fetchInvites()
        if (cancelled) return
        setGuests(remote)
        saveGuests(remote)
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : 'Could not load the guest list from the server.'
        setListError(message)
        setGuests(loadGuestsFromCache())
      } finally {
        if (!cancelled) setListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (listLoading) return
    saveGuests(guests)
  }, [guests, listLoading])

  useEffect(() => {
    if (!rsvpOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRsvpOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [rsvpOpen])

  function closeRsvp() {
    if (submitting) return
    setRsvpOpen(false)
    setSubmitError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedNick = nick.trim()
    if (!trimmedName || !trimmedNick) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch(INVITE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, nick: trimmedNick }),
      })

      const text = await res.text()
      let data: InvitePostResponse | null = null
      try {
        data = text ? (JSON.parse(text) as InvitePostResponse) : null
      } catch {
        data = null
      }

      if (!res.ok) {
        const detail =
          (typeof data?.message === 'string' && data.message) ||
          (text.trim().length > 0 ? text : null) ||
          `Request failed (${res.status})`
        throw new Error(detail)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not reach the server.'
      setSubmitError(message)
      setSubmitting(false)
      return
    }

    setName('')
    setNick('')

    try {
      await refreshGuests()
      setListError(null)
      setRsvpOpen(false)
    } catch {
      setListError('Te registramos, pero no pudimos actualizar la lista. Recarga la página.')
      setGuests((prev) => [
        {
          id: crypto.randomUUID(),
          name: trimmedName,
          nick: trimmedNick,
          joinedAt: Date.now(),
        },
        ...prev,
      ])
      setRsvpOpen(false)
    }

    setSubmitting(false)
  }

  return (
    <div className={`page-wrap${activeTrack ? ' page-wrap--track' : ''}`}>
      {activeTrack ? (
        <div className="album-backdrop" aria-hidden>
          <img
            className="album-backdrop__img"
            src={activeTrack.albumArtUrl}
            alt=""
            decoding="async"
          />
          <div className="album-backdrop__shade" />
        </div>
      ) : null}
      <div className="app-aurora" aria-hidden />
      <div className="app-noise" aria-hidden />
      <div className="shell">
        <div className="page-flow">
          <header className="hero page-block">
            <p className="eyebrow">Estas invitado a mi fiesta!!</p>
            <h1 className="title">
              <span className="title-shimmer">Golden Partyson</span>
            </h1>
          </header>

          <div className="hero-visual page-block">
            <div className="visual-frame">
              <div className="visual-glow" aria-hidden />
              <img
                className="host-photo"
                src={import.meta.env.BASE_URL + 'party-host.png'}
                width={800}
                height={800}
                alt="Host at the desk, warm golden lighting"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>

          <section className="intro panel page-block" aria-label="Detalles del evento">
            <p className="subtitle">
              Una tarde para celebrar la vida, la amistad y un gran logro en la nube — acompáñame a festejar mi cumpleaños y la obtención de mi AWS Golden Jacket bajo luces cálidas.
            </p>
            <div className="details-grid details-grid--intro">
              <div className="detail-chip">
                <h3>Cuándo</h3>
                <p>Sábado 20 de Junio · puertas abiertas desde las 3 pm</p>
              </div>
              <div className="detail-chip">
                <h3>Dónde</h3>
                <p>Sera en mi casa, Barrio Petrolero, Calle #15 Nro. 1769</p>
                  <a 
                    href="https://maps.app.goo.gl/v8sNYCEC1uyQnxaL7" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-6 py-2.5 mt-4 text-sm font-medium text-white bg-amber-400 hover:bg-amber-500 rounded-full shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
                    style={{ color: '#ffffff' }}
                  >
                    Ver ubicación en Maps
                  </a>
              </div>
            </div>
            <button type="button" className="cta-open" onClick={() => setRsvpOpen(true)}>
              <span className="cta-open-label">Confirmar invitación</span>
            </button>
          </section>

          <SpotifyPlaylist
            activeTrackId={activeTrack?.id ?? null}
            onSelectTrack={setActiveTrack}
          />

          <CommentsSection />

          <section
            className="guests panel guests--compact page-block"
            aria-labelledby="guests-heading"
          >
          <div className="panel-glow" aria-hidden />
          <h2 id="guests-heading">Quienes confirmaron?</h2>
          <p className="guests-lead">
            Lista en vivo. Toca un nombre para ver nick o nombre completo.
          </p>
          {listError ? <p className="list-banner">{listError}</p> : null}
          {listLoading ? (
            <p className="guests-empty guests-empty--pulse">Sincronizando la lista…</p>
          ) : guests.length === 0 ? (
            <p className="guests-empty">Sé la primera persona en confirmar tu invitación.</p>
          ) : (
            <div className="guest-list-scroll">
              <ol className="guest-list">
                {guests.map((g, i) => (
                  <GuestFlipCard key={g.id} guest={g} staggerIndex={i} />
                ))}
              </ol>
            </div>
          )}
          </section>
        </div>
      </div>

      {rsvpOpen ? (
        <div
          className="modal-root"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeRsvp()
          }}
        >
          <div
            className="modal panel panel--rsvp"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rsvp-heading"
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Cerrar"
              onClick={closeRsvp}
              disabled={submitting}
            >
              ×
            </button>
            <h2 id="rsvp-heading">Confirmar asistencia</h2>
            <p className="rsvp-lead">
              Tu invitación se guarda con tu nombre completo y tu nick que se mostrará en la lista.
              Todos verán las actualizaciones.
            </p>
            <form className="rsvp-form" onSubmit={handleSubmit}>
              <label className="field">
                <span className="label">Nombre completo</span>
                <input
                  className="input"
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="ej. Carlos Pérez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  required
                  autoFocus
                />
              </label>
              <label className="field">
                <span className="label">Nick</span>
                <input
                  className="input"
                  type="text"
                  name="nick"
                  autoComplete="nickname"
                  placeholder="ej. Quispe Decente"
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  maxLength={120}
                  required
                />
              </label>
              {submitError ? <p className="form-error">{submitError}</p> : null}
              <button className="submit" type="submit" disabled={submitting}>
                <span className="submit-label">
                  {submitting ? 'Enviando…' : 'Confirmar asistencia'}
                </span>
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
