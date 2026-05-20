const DEFAULT_COMMENTS_POST =
  'https://okzpybliflo6h2rxpakctwvtuy0gwazh.lambda-url.us-east-2.on.aws/'
const DEFAULT_COMMENTS_LIST =
  'https://ykc62g4w4cqsb3uwntucodncym0ejhbt.lambda-url.us-east-2.on.aws/'

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

export const COMMENTS_POST_URL = resolveApiUrl(
  import.meta.env.VITE_COMMENTS_POST_URL,
  DEFAULT_COMMENTS_POST,
  '/api/comments/',
)

export const COMMENTS_LIST_URL = resolveApiUrl(
  import.meta.env.VITE_COMMENTS_LIST_URL,
  DEFAULT_COMMENTS_LIST,
  '/api/comments/list/',
)

export type Comment = {
  id: string
  nombre: string
  comentario: string
}

type CommentsListResponse = {
  total?: number
  data?: unknown[]
}

type CommentPostResponse = {
  message?: string
  error?: string
  id?: string
  item?: unknown
}

function parseComment(raw: unknown): Comment | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id : crypto.randomUUID()
  const nombre =
    (typeof o.nombre === 'string' && o.nombre) ||
    (typeof o.autor === 'string' && o.autor) ||
    null
  const comentario =
    (typeof o.comentario === 'string' && o.comentario) ||
    (typeof o.comment === 'string' && o.comment) ||
    null
  if (!nombre || !comentario) return null
  return { id, nombre: nombre.trim(), comentario: comentario.trim() }
}

export async function fetchComments(): Promise<Comment[]> {
  const res = await fetch(COMMENTS_LIST_URL, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text.trim() || `No se pudieron cargar comentarios (${res.status})`)
  }
  let data: CommentsListResponse
  try {
    data = text ? (JSON.parse(text) as CommentsListResponse) : {}
  } catch {
    throw new Error('Respuesta inválida al listar comentarios.')
  }
  const items = Array.isArray(data.data) ? data.data : []
  return items.map(parseComment).filter((c): c is Comment => c !== null)
}

export async function postComment(nombre: string, comentario: string): Promise<void> {
  const payload = { nombre, comentario }

  const res = await fetch(COMMENTS_POST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let data: CommentPostResponse | null = null
  try {
    data = text ? (JSON.parse(text) as CommentPostResponse) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const detail =
      (typeof data?.error === 'string' && data.error) ||
      (typeof data?.message === 'string' && data.message) ||
      (text.trim().length > 0 ? text : null) ||
      `Error al publicar (${res.status})`
    throw new Error(detail)
  }
}
