import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
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
    '--stagger': String(Math.min(staggerIndex, 18)),
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
    } catch {
      setListError('You are registered, but the live list could not be refreshed. Try reloading.')
      setGuests((prev) => [
        {
          id: crypto.randomUUID(),
          name: trimmedName,
          nick: trimmedNick,
          joinedAt: Date.now(),
        },
        ...prev,
      ])
    }

    setSubmitting(false)
  }

  return (
    <div className="page-wrap">
      <div className="app-aurora" aria-hidden />
      <div className="app-noise" aria-hidden />
      <div className="shell">
        <header className="hero hero--split">
          <p className="eyebrow">Estas invitado a mi fiesta!!</p>
          <h1 className="title">
            <span className="title-shimmer">Golden Party</span>
          </h1>
        </header>

        <div className="split">
          <aside className="split-visual">
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
          </aside>

          <div className="split-main">
            <section className="guests panel" aria-labelledby="guests-heading">
              <div className="panel-glow" aria-hidden />
              <h2 id="guests-heading">Quienes confirmaron?</h2>
              <p className="guests-lead">
                La lista se actualiza en vivo conforme tus amigos confirman su asistencia. Presiona sobre los nombres para ver los nicks y viceversa.
              </p>
              {listError ? <p className="list-banner">{listError}</p> : null}
              {listLoading ? (
                <p className="guests-empty guests-empty--pulse">Syncing the guest list…</p>
              ) : guests.length === 0 ? (
                <p className="guests-empty">Sé la primera persona en confirmar tu asistencia abajo.</p>
              ) : (
                <ol className="guest-list">
                  {guests.map((g, i) => (
                    <GuestFlipCard key={g.id} guest={g} staggerIndex={i} />
                  ))}
                </ol>
              )}
            </section>

            <p className="subtitle">
              Una noche de música, amigos y champagne bajo luces cálidas — ahora con un toque especial.
            </p>

            <section className="details panel details--party" aria-label="Detalles del evento">
              <div className="details-grid">
                <div className="detail-chip">
                  <h3>Cuándo</h3>
                  <p>Sábado 20 de junio · puertas abiertas a las 6pm</p>
                </div>
                <div className="detail-chip">
                  <h3>Dónde</h3>
                  <p>En mi casa o discoteca a confirmar :v</p>
                </div>
                <div className="detail-chip">
                  <h3>Código de vestimenta</h3>
                  <p>Ninguno, solo procura llegar temprano</p>
                </div>
              </div>
            </section>

            <section className="rsvp panel panel--rsvp" aria-labelledby="rsvp-heading">
              <h2 id="rsvp-heading">Confirmar asistencia</h2>
              <p className="rsvp-lead">
                Tu invitación se guarda con tu nombre completo y tu nick que se mostrará en la lista.<br />
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
                  <span className="submit-label">{submitting ? 'Enviando…' : 'Confirmar invitación'}</span>
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
