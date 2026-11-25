import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import './BabyShower.css'

const STORAGE_KEY = 'baby-shower:rsvp'

const MOM_NAME = 'Vania'
const DAD_NAME = 'Alex'
const EVENT_DATE = 'Sábado 12 de Diciembre'
const EVENT_TIME = '4:00 pm'
const EVENT_ADDRESS = 'Calle Guerrilleros Lanza, Edificio Tándem'
const MAPS_URL = 'https://maps.app.goo.gl/U7tcp694SE4SiSfg9'

const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/LUPmBQAiInaBdatmunQdyQ?s=cl&p=a&iam=2'

const DEFAULT_RSVP_URL = 'https://gwcex3cb5gzdsdltu6wn4bljeq0arotj.lambda-url.us-east-2.on.aws/'

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

const RSVP_API_URL = resolveApiUrl(import.meta.env.VITE_RSVP_URL, DEFAULT_RSVP_URL, '/api/rsvp/')

function buildWhatsappGreeting(name: string) {
  return `Hola chicos, soy ${name} y estaré presente en el Baby Shower 🎉`
}

async function postRsvpName(trimmedName: string) {
  const res = await fetch(RSVP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: trimmedName }),
  })
  const text = await res.text()
  if (!res.ok) {
    let message: string | null = null
    try {
      const data = text ? (JSON.parse(text) as { message?: string }) : null
      message = typeof data?.message === 'string' ? data.message : null
    } catch {
      message = null
    }
    throw new Error(message || (text.trim().length > 0 ? text : `Request failed (${res.status})`))
  }
}

type Rsvp = {
  name: string
  confirmedAt: number
}

function loadRsvp(): Rsvp | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const o = parsed as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name : null
    const confirmedAt = typeof o.confirmedAt === 'number' ? o.confirmedAt : null
    if (!name || confirmedAt === null) return null
    return { name, confirmedAt }
  } catch {
    return null
  }
}

function FloatingDecor() {
  return (
    <div className="bs-decor" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <span key={`balloon-${i}`} className={`bs-balloon bs-balloon--${i % 4}`} />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={`heart-${i}`} className={`bs-heart bs-heart--${i % 3}`}>
          ♥
        </span>
      ))}
    </div>
  )
}

export default function BabyShower() {
  const [rsvp, setRsvp] = useState<Rsvp | null>(() => loadRsvp())
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [waCopied, setWaCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function joinWhatsapp(personName: string) {
    try {
      await navigator.clipboard.writeText(buildWhatsappGreeting(personName))
      setWaCopied(true)
    } catch {
      setWaCopied(false)
    }
    window.open(WHATSAPP_GROUP_URL, '_blank', 'noopener,noreferrer')
  }

  function handleWhatsappClick() {
    if (rsvp) {
      void joinWhatsapp(rsvp.name)
    } else {
      setFormOpen(true)
    }
  }

  function handleCancel() {
    if (submitting) return
    setFormOpen(false)
    setSubmitError(null)
    setName('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      await postRsvpName(trimmed)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No pudimos registrar tu confirmación.'
      setSubmitError(message)
      setSubmitting(false)
      return
    }

    const next: Rsvp = { name: trimmed, confirmedAt: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setRsvp(next)
    setSubmitting(false)
    setFormOpen(false)
    setName('')
    void joinWhatsapp(trimmed)
  }

  return (
    <div className="bs-page">
      <div className="bs-aurora" aria-hidden />
      <FloatingDecor />
      <div className="bs-shell">
        <Link to="/golden-party" className="bs-cross-link">
          🎉 Invitación anterior - Golden Partyson
        </Link>

        <header className="bs-hero">
          <img
            className="bs-hero-img"
            src={import.meta.env.BASE_URL + 'baby-shower-hero.png'}
            width={1024}
            height={1024}
            alt="Ilustración de Baby Shower"
            loading="eager"
            decoding="async"
          />
          <p className="bs-of">{MOM_NAME} y {DAD_NAME}</p>
          <p className="bs-pill">♡ ¡Es una niña! ♡</p>
        </header>

        <section className="bs-panel" aria-label="Detalles del evento">
          <p className="bs-invite-line">
            Te invitamos a participar del baby shower de nuestra bebé. ¡Tu presencia hará
            este día aún más especial! 💜
          </p>
          <div className="bs-details-grid">
            <div className="bs-chip">
              <h3>Fecha</h3>
              <p>{EVENT_DATE}</p>
            </div>
            <div className="bs-chip bs-chip--alt">
              <h3>Hora</h3>
              <p>{EVENT_TIME}</p>
            </div>
            <div className="bs-chip">
              <h3>Lugar</h3>
              <p>{EVENT_ADDRESS}</p>
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bs-maps-btn"
              >
                Ver ubicación en Maps
              </a>
            </div>
          </div>

          <div className="bs-whatsapp-block">
            <button type="button" className="bs-whatsapp-btn" onClick={handleWhatsappClick}>
              Únete al grupo de WhatsApp
            </button>
            {waCopied ? (
              <p className="bs-whatsapp-hint">
                ¡Copiamos tu saludo! Pégalo en el grupo apenas entres 💬
              </p>
            ) : (
              <p className="bs-whatsapp-hint">
                Te pediremos tu nombre y te llevamos directo al grupo.
              </p>
            )}
          </div>
        </section>
      </div>

      {formOpen ? (
        <div
          className="bs-modal-root"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel()
          }}
        >
          <div className="bs-modal" role="dialog" aria-modal="true" aria-labelledby="bs-rsvp-heading">
            <button
              type="button"
              className="bs-modal-close"
              aria-label="Cerrar"
              onClick={handleCancel}
              disabled={submitting}
            >
              ×
            </button>
            <h2 id="bs-rsvp-heading">¿Cuál es tu nombre?</h2>
            <form className="bs-form" onSubmit={handleSubmit}>
              <label className="bs-field">
                <span>Nombre completo</span>
                <input
                  className="bs-input"
                  type="text"
                  autoComplete="name"
                  placeholder="ej. Carla Pérez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  required
                  autoFocus
                  disabled={submitting}
                />
              </label>
              {submitError ? <p className="bs-form-error">{submitError}</p> : null}
              <div className="bs-form-actions">
                <button
                  type="button"
                  className="bs-cancel"
                  onClick={handleCancel}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button className="bs-submit" type="submit" disabled={submitting}>
                  {submitting ? 'Enviando…' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
