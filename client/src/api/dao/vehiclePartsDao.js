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

export const listForUser = async () => {
  const data = await requestJson('/api/vehicle-parts');
  return data || [];
};

export const listForVehicle = async (vin) => {
  const data = await requestJson(`/api/vehicle-parts/${vin}`);
  return data || [];
};

export const listForAppointment = async (appointmentId) => {
  const data = await requestJson(`/api/vehicle-parts/appointment/${appointmentId}`);
  return data || [];
};

export const createPart = async (partData) => {
  const data = await requestJson('/api/vehicle-parts', {
    method: 'POST',
    body: partData
  });
  return data;
};
