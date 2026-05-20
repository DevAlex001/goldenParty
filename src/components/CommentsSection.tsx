import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { fetchComments, postComment, type Comment } from '../lib/comments'
import './CommentsSection.css'

export default function CommentsSection() {
  const [comments, setComments] = useState<Comment[]>([])
  const [nombre, setNombre] = useState('')
  const [comentario, setComentario] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const refreshComments = useCallback(async () => {
    const list = await fetchComments()
    setComments(list)
    return list
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const list = await fetchComments()
        if (!cancelled) setComments(list)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los comentarios.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!formOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeForm()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [formOpen])

  function closeForm() {
    if (submitting) return
    setFormOpen(false)
    setSubmitError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedNombre = nombre.trim()
    const trimmedComentario = comentario.trim()
    if (!trimmedNombre || !trimmedComentario) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      await postComment(trimmedNombre, trimmedComentario)
      setNombre('')
      setComentario('')
      await refreshComments()
      setError(null)
      setFormOpen(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No se pudo publicar el comentario.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className="comments panel page-block" aria-labelledby="comments-heading">
        <div className="panel-glow" aria-hidden />
        <h2 id="comments-heading">Comentarios</h2>
        <p className="comments-lead">Mensajes de la fiesta, actualizados en vivo.</p>

        <button type="button" className="cta-open cta-open--comments" onClick={() => setFormOpen(true)}>
          <span className="cta-open-label">Escribir</span>
        </button>

        {error ? <p className="list-banner">{error}</p> : null}
        {loading ? (
          <p className="comments-empty comments-empty--pulse">Cargando comentarios…</p>
        ) : comments.length === 0 ? (
          <p className="comments-empty">Sé el primero en comentar.</p>
        ) : (
          <ul className="comment-list">
            {comments.map((c) => (
              <li key={c.id} className="comment-card">
                <span className="comment-author">{c.nombre}</span>
                <p className="comment-text">{c.comentario}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {formOpen ? (
        <div
          className="modal-root"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeForm()
          }}
        >
          <div
            className="modal panel panel--comments"
            role="dialog"
            aria-modal="true"
            aria-labelledby="comments-form-heading"
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Cerrar"
              onClick={closeForm}
              disabled={submitting}
            >
              ×
            </button>
            <h2 id="comments-form-heading">Escribir comentario</h2>
            <p className="comments-lead">
              Tu mensaje aparecerá en la lista para todos los invitados.
            </p>
            <form className="comments-form" onSubmit={handleSubmit}>
              <label className="field">
                <span className="label">Tu nombre</span>
                <input
                  className="input"
                  type="text"
                  name="nombre"
                  placeholder="ej. James Bons"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={120}
                  required
                  autoFocus
                />
              </label>
              <label className="field">
                <span className="label">Comentario</span>
                <textarea
                  className="input input--area"
                  name="comentario"
                  placeholder="ej. Fija lo haré caer al vayron"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  maxLength={500}
                  rows={4}
                  required
                />
              </label>
              {submitError ? <p className="form-error">{submitError}</p> : null}
              <button className="submit submit--comments" type="submit" disabled={submitting}>
                <span className="submit-label">
                  {submitting ? 'Enviando…' : 'Enviar comentario'}
                </span>
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
