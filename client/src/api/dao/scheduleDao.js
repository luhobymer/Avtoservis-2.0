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

const BUSY_KEY_PREFIX = 'master_busy_status_';
const HOURS_KEY_PREFIX = 'master_working_hours_';

function normalizeBusyStatus(masterId, data) {
  return {
    master_id: data.master_id || masterId,
    is_busy: Boolean(data.is_busy),
    busy_until: data.busy_until || null,
    busy_reason: data.busy_reason || '',
    updated_at: data.updated_at || new Date().toISOString()
  };
}

function defaultBusyStatus(masterId) {
  return {
    master_id: masterId,
    is_busy: false,
    busy_until: null,
    busy_reason: '',
    updated_at: new Date().toISOString()
  };
}

export async function getMasterBusyStatus(masterId) {
  if (!masterId) {
    return defaultBusyStatus(masterId || '');
  }
  const mechanicIdValue = /^[0-9]+$/.test(String(masterId)) ? Number(masterId) : masterId;
  try {
    const data = await requestJson(`/api/schedule/busy-status?mechanic_id=${encodeURIComponent(mechanicIdValue)}`);
    if (data && typeof data === 'object') {
      const normalized = normalizeBusyStatus(masterId, data);
      localStorage.setItem(`${BUSY_KEY_PREFIX}${masterId}`, JSON.stringify(normalized));
      return normalized;
    }
  } catch (error) {
    void error;
  }
  try {
    const cachedRaw = localStorage.getItem(`${BUSY_KEY_PREFIX}${masterId}`);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      return normalizeBusyStatus(masterId, cached);
    }
  } catch (error) {
    void error;
  }
  return defaultBusyStatus(masterId);
}

export async function setMasterBusyStatus(masterId, isBusy, busyUntil, reason) {
  if (!masterId) {
    return defaultBusyStatus(masterId || '');
  }
  const mechanicIdValue = /^[0-9]+$/.test(String(masterId)) ? Number(masterId) : masterId;
  const payload = {
    mechanic_id: mechanicIdValue,
    is_busy: Boolean(isBusy),
    busy_until: busyUntil,
    busy_reason: reason || ''
  };
  let result = {
    master_id: masterId,
    is_busy: Boolean(isBusy),
    busy_until: busyUntil,
    busy_reason: reason || '',
    updated_at: new Date().toISOString()
  };
  try {
    await requestJson('/api/schedule/busy-status', {
      method: 'POST',
      body: payload
    });
  } catch (error) {
    void error;
  }
  try {
    localStorage.setItem(`${BUSY_KEY_PREFIX}${masterId}`, JSON.stringify(result));
  } catch (error) {
    void error;
  }
  return result;
}

function defaultWorkingHours() {
  return {
    1: { start_time: '09:00', end_time: '18:00', is_working_day: true },
    2: { start_time: '09:00', end_time: '18:00', is_working_day: true },
    3: { start_time: '09:00', end_time: '18:00', is_working_day: true },
    4: { start_time: '09:00', end_time: '18:00', is_working_day: true },
    5: { start_time: '09:00', end_time: '18:00', is_working_day: true },
    6: { start_time: '10:00', end_time: '15:00', is_working_day: false },
    0: { start_time: '00:00', end_time: '00:00', is_working_day: false }
  };
}

export async function getMasterWorkingHours(masterId) {
  if (!masterId) {
    return defaultWorkingHours();
  }
  try {
    const data = await requestJson(`/api/schedule/working-hours?master_id=${encodeURIComponent(masterId)}`);
    if (data && typeof data === 'object') {
      localStorage.setItem(`${HOURS_KEY_PREFIX}${masterId}`, JSON.stringify(data));
      return data;
    }
  } catch (error) {
    void error;
  }
  try {
    const cachedRaw = localStorage.getItem(`${HOURS_KEY_PREFIX}${masterId}`);
    if (cachedRaw) {
      return JSON.parse(cachedRaw);
    }
  } catch (error) {
    void error;
  }
  const fallback = defaultWorkingHours();
  try {
    localStorage.setItem(`${HOURS_KEY_PREFIX}${masterId}`, JSON.stringify(fallback));
  } catch (error) {
    void error;
  }
  return fallback;
}

export async function updateMasterWorkingHours(masterId, workingHours) {
  if (!masterId) {
    return defaultWorkingHours();
  }
  const hours = workingHours && typeof workingHours === 'object' ? workingHours : defaultWorkingHours();
  const workingHoursArray = Object.entries(hours).map(([day, value]) => ({
    master_id: masterId,
    day_of_week: Number(day),
    start_time: value.start_time,
    end_time: value.end_time,
    is_working_day: Boolean(value.is_working_day)
  }));
  try {
    await requestJson('/api/schedule/working-hours', {
      method: 'POST',
      body: { master_id: masterId, items: workingHoursArray }
    });
  } catch (error) {
    void error;
  }
  try {
    localStorage.setItem(`${HOURS_KEY_PREFIX}${masterId}`, JSON.stringify(hours));
  } catch (error) {
    void error;
  }
  return hours;
}

