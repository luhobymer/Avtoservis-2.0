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

function mapUser(row) {
  return {
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    role: row.role || 'client',
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

export async function list() {
  const payload = await requestJson('/api/users?limit=500');
  const rows = normalizeListPayload(payload);
  return rows.map(mapUser);
}

export async function update(id, payload) {
  const body = {
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    role: payload.role
  };

  await requestJson(`/api/users/${id}`, {
    method: 'PUT',
    body
  });
}

export async function remove(id) {
  await requestJson(`/api/users/${id}`, {
    method: 'DELETE'
  });
}

export async function create(payload) {
  const body = {
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    role: payload.role || 'client',
    password: payload.password
  };

  const created = await requestJson('/api/admin/users', {
    method: 'POST',
    body
  });

  return created || null;
}
