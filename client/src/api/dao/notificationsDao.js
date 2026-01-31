async function requestJson(url, options = {}, attemptRefresh = true) {
  const token = localStorage.getItem('auth_token')
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include'
  })

  if (response.status === 401 && attemptRefresh) {
    try {
      const storedRefreshToken = localStorage.getItem('refresh_token')
      if (!storedRefreshToken) {
        throw new Error('Refresh token missing')
      }
      const refreshResponse = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: storedRefreshToken }),
        credentials: 'include'
      })
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        const newAccessToken = refreshData?.token || refreshData?.accessToken || null
        const newRefreshToken = refreshData?.refresh_token || refreshData?.refreshToken || null
        if (newAccessToken) {
          localStorage.setItem('auth_token', newAccessToken)
        }
        if (newRefreshToken) {
          localStorage.setItem('refresh_token', newRefreshToken)
        }
        return requestJson(url, options, false)
      }
    } catch (error) {
      void error
    }
  }

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

function normalizeListPayload(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.data)) return payload.data
  return []
}

function mapNotification(n) {
  const rawData = n.data
  let parsed = null
  if (rawData && typeof rawData === 'string') {
    try {
      parsed = JSON.parse(rawData)
    } catch (e) {
      parsed = null
    }
  } else if (rawData && typeof rawData === 'object') {
    parsed = rawData
  }
  const d = parsed || {}
  const referenceId =
    d.referenceId || d.reference_id || d.record_id || d.appointment_id || null

  return {
    id: n.id,
    user_id: n.user_id,
    title: n.title || '',
    message: n.message || '',
    type: n.type || 'general',
    read: !!n.is_read,
    createdAt: n.created_at,
    status: n.status || 'pending',
    referenceId
  }
}

export async function listForUser(userId, { limit = 50, offset = 0 } = {}) {
  if (!userId) return []
  const payload = await requestJson(
    `/api/notifications?user_id=${encodeURIComponent(
      userId
    )}&limit=${limit}&offset=${offset}`
  )
  const rows = normalizeListPayload(payload)
  return rows.map(mapNotification)
}

export async function markAsRead(id) {
  await requestJson(`/api/notifications/${id}/read`, {
    method: 'POST'
  })
}

export async function markAllRead(userId) {
  if (!userId) return
  await requestJson('/api/notifications/mark-all-read', {
    method: 'POST',
    body: { user_id: userId }
  })
}

export async function deleteById(id) {
  await requestJson(`/api/notifications/${id}`, {
    method: 'DELETE'
  })
}

export async function deleteAllForUser(userId) {
  if (!userId) return
  await requestJson('/api/notifications/delete-all', {
    method: 'POST',
    body: { user_id: userId }
  })
}
