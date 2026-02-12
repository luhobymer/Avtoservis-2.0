const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
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

function mapService(row) {
  const station =
    row.service_stations ||
    (row.station_id && row.station_name
      ? { id: row.station_id, name: row.station_name }
      : null);

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    price: row.price != null ? Number(row.price) : null,
    price_text: row.price_text != null ? String(row.price_text) : null,
    duration: row.duration != null ? Number(row.duration) : null,
    duration_text: row.duration_text != null ? String(row.duration_text) : null,
    is_active:
      row.is_active === undefined || row.is_active === null
        ? true
        : Number(row.is_active) !== 0,
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

export async function list() {
  const payload = await requestJson('/api/services');
  const rows = normalizeListPayload(payload);
  return rows.map(mapService);
}

export async function getById(id) {
  const row = await requestJson(`/api/services/${id}`);
  if (!row) {
    throw new Error('Service not found');
  }
  return mapService(row);
}

export async function create(payload) {
  const body = {
    name: payload.name,
    description: payload.description || null,
    price: payload.price != null ? Number(payload.price) : null,
    price_text: payload.price_text != null ? String(payload.price_text) : null,
    duration: payload.duration != null ? Number(payload.duration) : null,
    duration_text: payload.duration_text != null ? String(payload.duration_text) : null,
    is_active: payload.is_active === undefined ? true : Boolean(payload.is_active),
    service_station_id: payload.service_station_id || payload.station_id || null,
    category_id: payload.category_id || null
  };

  const created = await requestJson('/api/services', {
    method: 'POST',
    body
  });

  return created ? mapService(created) : null;
}

export async function update(id, payload) {
  const body = {
    name: payload.name,
    description: payload.description,
    price: payload.price != null ? Number(payload.price) : null,
    price_text: payload.price_text !== undefined ? (payload.price_text == null ? null : String(payload.price_text)) : undefined,
    duration: payload.duration != null ? Number(payload.duration) : null,
    duration_text: payload.duration_text !== undefined ? (payload.duration_text == null ? null : String(payload.duration_text)) : undefined,
    is_active: payload.is_active === undefined ? undefined : Boolean(payload.is_active),
    service_station_id: payload.service_station_id || payload.station_id || undefined,
    category_id: payload.category_id || undefined
  };

  await requestJson(`/api/services/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body
  });
}

export async function remove(id) {
  await requestJson(`/api/services/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}
