async function requestJson(url, options = {}) {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody.message === 'string') {
        message = errorBody.message;
        if (typeof errorBody.details === 'string' && errorBody.details.trim()) {
          message = `${message}: ${errorBody.details}`;
        }
      }
    } catch (error) {
      void error;
    }
    throw new Error(message);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return null;
}

function normalizeListPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function listMechanicServices(mechanicId, options = {}) {
  if (!mechanicId) {
    throw new Error('mechanicId is required');
  }
  const params = new URLSearchParams();
  if (options.enabled) {
    params.set('enabled', '1');
  }
  const query = params.toString();
  const payload = await requestJson(
    query ? `/api/mechanics/${mechanicId}/services?${query}` : `/api/mechanics/${mechanicId}/services`
  );
  return normalizeListPayload(payload);
}

export async function setMechanicServiceEnabled(mechanicId, serviceId, isEnabled) {
  if (!mechanicId || !serviceId) {
    throw new Error('mechanicId and serviceId are required');
  }
  return requestJson(`/api/mechanics/${mechanicId}/services/${serviceId}`, {
    method: 'PUT',
    body: { is_enabled: isEnabled ? 1 : 0 }
  });
}

export async function createMechanicService(mechanicId, payload) {
  if (!mechanicId) {
    throw new Error('mechanicId is required');
  }
  return requestJson(`/api/mechanics/${mechanicId}/services`, {
    method: 'POST',
    body: payload
  });
}

export async function updateMechanicServiceDetails(mechanicId, serviceId, payload) {
  if (!mechanicId || !serviceId) {
    throw new Error('mechanicId and serviceId are required');
  }
  return requestJson(`/api/mechanics/${mechanicId}/services/${serviceId}/details`, {
    method: 'PUT',
    body: payload
  });
}
