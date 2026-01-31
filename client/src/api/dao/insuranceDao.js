async function requestJson(url, options = {}) {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
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

function normalizeListPayload(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.data)) return payload.data
  return []
}

export async function listAll() {
  const payload = await requestJson('/api/insurance')
  const data = normalizeListPayload(payload)
  return data
}

export async function create(payload) {
  const body = {
    vehicle_vin: payload.vehicle_vin,
    policy_number: payload.policy_number,
    insurance_company: payload.insurance_company,
    start_date: payload.start_date ? new Date(payload.start_date).toISOString() : null,
    end_date: payload.end_date ? new Date(payload.end_date).toISOString() : null,
  }

  return requestJson('/api/insurance', {
    method: 'POST',
    body,
  })
}

export async function updateById(id, payload) {
  const body = {
    vehicle_vin: payload.vehicle_vin,
    policy_number: payload.policy_number,
    insurance_company: payload.insurance_company,
    start_date: payload.start_date ? new Date(payload.start_date).toISOString() : null,
    end_date: payload.end_date ? new Date(payload.end_date).toISOString() : null,
  }

  return requestJson(`/api/insurance/${id}`, {
    method: 'PUT',
    body,
  })
}

export async function deleteById(id) {
  await requestJson(`/api/insurance/${id}`, {
    method: 'DELETE',
  })
  return true
}
