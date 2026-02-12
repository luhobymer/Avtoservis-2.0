const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const resolveUrl = (url) => (url.startsWith('http') ? url : `${API_BASE_URL}${url}`)

async function requestJson(url, options = {}) {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(resolveUrl(url), {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const errorBody = await response.json()
      if (errorBody && typeof errorBody.message === 'string') {
        message = errorBody.message
      }
    } catch (error) {
      void error
    }
    throw new Error(message)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return null
}

export async function listAll() {
  const payload = await requestJson('/api/parts?limit=500&offset=0')
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.data)) return payload.data
  return []
}

export async function create(payload) {
  const body = {
    name: payload.name || '',
    article: payload.article || null,
    manufacturer: payload.manufacturer || null,
    price: payload.price != null ? Number(payload.price) : null,
    warranty_period: payload.warranty_period != null ? Number(payload.warranty_period) : null
  }
  return requestJson('/api/parts', {
    method: 'POST',
    body
  })
}

export async function updateById(id, payload) {
  const body = {
    name: payload.name || '',
    article: payload.article || null,
    manufacturer: payload.manufacturer || null,
    price: payload.price != null ? Number(payload.price) : null,
    warranty_period: payload.warranty_period != null ? Number(payload.warranty_period) : null
  }
  return requestJson(`/api/parts/${id}`, {
    method: 'PUT',
    body
  })
}

export async function deleteById(id) {
  await requestJson(`/api/parts/${id}`, {
    method: 'DELETE'
  })
  return true
}
