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
      if (errorBody && typeof errorBody.msg === 'string') {
        message = errorBody.msg;
      }
      if (errorBody && typeof errorBody.message === 'string') {
        message = errorBody.message;
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

export async function listEntityInteractions(entityType, entityId) {
  const params = new URLSearchParams();
  if (entityType) params.set('related_entity', String(entityType));
  if (entityId) params.set('related_entity_id', String(entityId));
  const payload = await requestJson(`/api/interactions?${params.toString()}`);
  return normalizeListPayload(payload);
}

export async function createInteraction(payload) {
  return requestJson('/api/interactions', {
    method: 'POST',
    body: payload
  });
}

export async function updateInteractionStatus(id, status) {
  return requestJson(`/api/interactions/${id}`, {
    method: 'PUT',
    body: { status }
  });
}

export async function listConversations(options = {}) {
  const params = new URLSearchParams();
  params.set('related_entity', options.related_entity ? String(options.related_entity) : 'appointment');
  if (options.limit != null) {
    params.set('limit', String(options.limit));
  }
  const payload = await requestJson(`/api/interactions/conversations?${params.toString()}`);
  return normalizeListPayload(payload);
}
