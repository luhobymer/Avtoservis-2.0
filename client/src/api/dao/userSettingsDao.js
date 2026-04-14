const DEFAULT_API_BASE_URL = 'https://avtoservis-server.onrender.com';
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
)
  .trim()
  .replace(/\/+$/, '');
const resolveUrl = (url) => (url.startsWith('http') ? url : `${API_BASE_URL}${url}`);

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
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody.message === 'string') {
        message = errorBody.message;
      }
      if (errorBody && typeof errorBody.msg === 'string') {
        message = errorBody.msg;
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

export async function getUserSettings(userId) {
  if (!userId) throw new Error('Missing userId');
  const payload = await requestJson(`/api/users/${encodeURIComponent(String(userId))}/settings`);
  return payload || { user_id: String(userId), settings: null };
}

export async function updateUserSettings(userId, settings) {
  if (!userId) throw new Error('Missing userId');
  const payload = await requestJson(`/api/users/${encodeURIComponent(String(userId))}/settings`, {
    method: 'PUT',
    body: { settings: settings ?? {} }
  });
  return payload || { user_id: String(userId), settings: settings ?? {} };
}
