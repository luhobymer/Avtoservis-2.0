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

function mapMechanic(row) {
  const station = row.service_stations || null;
  const specialization = row.specializations || null;

  const firstName = row.first_name || '';
  const lastName = row.last_name || '';

  return {
    id: row.id,
    first_name: firstName,
    last_name: lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' ').trim() || row.name || '',
    phone: row.phone || '',
    email: row.email || '',
    specialization,
    station,
    station_id:
      (station && station.id) ||
      row.service_station_id ||
      row.station_id ||
      null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

export async function list(options = {}) {
  const params = new URLSearchParams();
  if (options.city) {
    params.set('city', String(options.city));
  }
  const query = params.toString();
  const payload = await requestJson(query ? `/api/mechanics?${query}` : '/api/mechanics');
  const rows = normalizeListPayload(payload);
  return rows.map(mapMechanic);
}

export async function getById(id) {
  const row = await requestJson(`/api/mechanics/${id}`);
  if (!row) {
    throw new Error('Mechanic not found');
  }
  return mapMechanic(row);
}
