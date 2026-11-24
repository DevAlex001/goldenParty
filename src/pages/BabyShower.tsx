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
const RSVP_CONTACT_NAME = 'Vania'
const RSVP_PHONE = '74089404'
const GIFT_SUGGESTION = 'Pañales talla 1 o lo que gustes'

const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/LUPmBQAiInaBdatmunQdyQ?s=cl&p=a&iam=2'

function buildWhatsappGreeting(name: string) {
  return `Hola chicos, soy ${name} y estaré presente en el Baby Shower 🎉`
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const next: Rsvp = { name: trimmed, confirmedAt: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setRsvp(next)
    setFormOpen(false)
    setName('')
  }

  async function handleJoinWhatsapp() {
    if (!rsvp) return
    try {
      await navigator.clipboard.writeText(buildWhatsappGreeting(rsvp.name))
      setWaCopied(true)
    } catch {
      setWaCopied(false)
    }
    window.open(WHATSAPP_GROUP_URL, '_blank', 'noopener,noreferrer')
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
          <div className="bs-cloud">Baby Shower</div>
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

          <p className="bs-rsvp-line">
            Confirma tu asistencia con {RSVP_CONTACT_NAME} al {RSVP_PHONE}
          </p>
          <p className="bs-gift-line">Sugerencia de regalo: {GIFT_SUGGESTION}</p>

          {rsvp ? (
            <div className="bs-confirmed">
              <p className="bs-confirmed-title">
                ¡Gracias por confirmar, {rsvp.name}! 💜
              </p>
              <button type="button" className="bs-whatsapp-btn" onClick={handleJoinWhatsapp}>
                Únete al grupo de WhatsApp
              </button>
              {waCopied ? (
                <p className="bs-whatsapp-hint">
                  ¡Copiamos tu saludo! Pégalo en el grupo apenas entres 💬
                </p>
              ) : (
                <p className="bs-whatsapp-hint">
                  Te llevamos al grupo y copiamos un saludo para que lo compartas ahí.
                </p>
              )}
            </div>
          ) : (
            <button type="button" className="bs-cta" onClick={() => setFormOpen(true)}>
              Confirmar asistencia
            </button>
          )}
        </section>
      </div>

      {formOpen ? (
        <div
          className="bs-modal-root"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFormOpen(false)
          }}
        >
          <div className="bs-modal" role="dialog" aria-modal="true" aria-labelledby="bs-rsvp-heading">
            <button
              type="button"
              className="bs-modal-close"
              aria-label="Cerrar"
              onClick={() => setFormOpen(false)}
            >
              ×
            </button>
            <h2 id="bs-rsvp-heading">Confirmar asistencia</h2>
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
                />
              </label>
              <button className="bs-submit" type="submit">
                Confirmar
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
