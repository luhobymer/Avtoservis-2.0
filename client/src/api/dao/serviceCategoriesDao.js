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

export async function listServiceCategories() {
  const payload = await requestJson('/api/service-categories');
  return normalizeListPayload(payload);
}

