const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const resolveUrl = (url) => (url.startsWith('http') ? url : `${API_BASE_URL}${url}`);

async function requestJson(url, options = {}, attemptRefresh = true) {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(resolveUrl(url), {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include'
  });

  if (response.status === 401 && attemptRefresh) {
    try {
      const storedRefreshToken = localStorage.getItem('refresh_token');
      if (!storedRefreshToken) throw new Error('Refresh token missing');

      const refreshResponse = await fetch(resolveUrl('/api/auth/refresh-token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: storedRefreshToken }),
        credentials: 'include'
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const newAccessToken = refreshData?.token || refreshData?.accessToken || null;
        const newRefreshToken = refreshData?.refresh_token || refreshData?.refreshToken || null;
        if (newAccessToken) localStorage.setItem('auth_token', newAccessToken);
        if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken);
        return requestJson(url, options, false);
      }
    } catch (error) {
      void error;
    }
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody.msg === 'string') message = errorBody.msg;
      if (errorBody && typeof errorBody.message === 'string') message = errorBody.message;
    } catch (error) {
      void error;
    }
    throw new Error(message);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  return null;
}

export async function getVapidPublicKey() {
  const payload = await requestJson('/api/web-push/vapid-public-key');
  return payload?.publicKey || '';
}

export async function subscribe(subscription) {
  const payload = await requestJson('/api/web-push/subscribe', {
    method: 'POST',
    body: { subscription }
  });
  return payload;
}

export async function unsubscribe(endpoint) {
  const payload = await requestJson('/api/web-push/unsubscribe', {
    method: 'POST',
    body: { endpoint }
  });
  return payload;
}

export async function testPush() {
  const payload = await requestJson('/api/web-push/test', {
    method: 'POST'
  });
  return payload;
}
