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

const mapVehicle = (v) => ({
  id: v.id,
  vin: v.vin,
  make: v.make || v.brand,
  brand: v.brand || v.make,
  model: v.model,
  year: v.year,
  licensePlate:
    v.licensePlate ||
    v.license_plate ||
    v.registration_number ||
    '',
  mileage: v.mileage != null ? v.mileage : 0,
  color: v.color || '',
  engineType: v.engine_type || '',
  transmission: v.transmission || '',
  engineVolume: v.engine_capacity || '',
  photoUrl: v.photo_url || '',
  UserId: v.user_id || v.UserId || null
});

function normalizeListPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function list(options = {}) {
  const params = new URLSearchParams();
  if (options && options.serviced) {
    params.set('serviced', '1');
  }
  const url = params.toString() ? `/api/vehicles?${params.toString()}` : '/api/vehicles';
  const payload = await requestJson(url);
  const data = normalizeListPayload(payload);
  return data.map(mapVehicle);
}

export async function listForUser(userId) {
  if (!userId) return [];
  const payload = await requestJson(`/api/vehicles?user_id=${encodeURIComponent(userId)}`);
  const data = normalizeListPayload(payload);
  return data.map(mapVehicle);
}

export async function update(id, payload) {
  const vin = id;
  const body = {
    make: payload.make || payload.brand,
    model: payload.model,
    year:
      payload.year !== undefined && payload.year !== null && payload.year !== ''
        ? Number(payload.year)
        : null,
    vin: payload.vin,
    license_plate: payload.license_plate || payload.licensePlate,
    mileage:
      payload.mileage !== undefined && payload.mileage !== null && payload.mileage !== ''
        ? Number(payload.mileage)
        : null,
    color: payload.color,
    user_id: payload.user_id || payload.UserId || null,
    engineType: payload.engineType,
    transmission: payload.transmission,
    engineVolume: payload.engineVolume,
    photoUrl: payload.photoUrl
  };

  await requestJson(`/api/vehicles/${encodeURIComponent(vin)}`, {
    method: 'PUT',
    body
  });
}

export async function getById(id) {
  const payload = await requestJson(`/api/vehicles/${encodeURIComponent(id)}`);
  if (!payload) {
    throw new Error('Vehicle not found');
  }
  return mapVehicle(payload);
}

export async function create(payload, userId) {
  if (!userId) {
    throw new Error('User id is required to create vehicle');
  }

  const body = {
    user_id: userId,
    make: payload.make || payload.brand || '',
    model: payload.model || '',
    year:
      payload.year !== undefined && payload.year !== null && payload.year !== ''
        ? Number(payload.year)
        : null,
    vin: payload.vin || '',
    license_plate: payload.licensePlate || payload.license_plate || null,
    mileage:
      payload.mileage !== undefined && payload.mileage !== null && payload.mileage !== ''
        ? Number(payload.mileage)
        : null,
    color: payload.color || null,
    engineType: payload.engineType,
    transmission: payload.transmission,
    engineVolume: payload.engineVolume || payload.engineCapacity,
    photoUrl: payload.photoUrl
  };

  const created = await requestJson('/api/vehicles', {
    method: 'POST',
    body
  });

  if (created && created.id) {
    return created.id;
  }

  return null;
}

export async function attachServicedVehicles(vehicleIds) {
  const ids = Array.isArray(vehicleIds) ? vehicleIds : [];
  const normalized = ids.map((v) => (v == null ? '' : String(v).trim())).filter(Boolean);
  if (normalized.length === 0) {
    throw new Error('vehicleIds is required');
  }
  return requestJson('/api/vehicles/serviced', {
    method: 'POST',
    body: { vehicle_ids: normalized }
  });
}

export async function remove(id) {
  await requestJson(`/api/vehicles/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

export async function lookupRegistryByLicensePlate(licensePlate) {
  if (!licensePlate) {
    throw new Error('License plate is required');
  }
  const payload = await requestJson(
    `/api/vehicle-registry?license_plate=${encodeURIComponent(licensePlate)}`
  );
  return payload;
}

export async function uploadPhoto(file) {
  const token = localStorage.getItem('auth_token');
  const formData = new FormData();
  formData.append('photo', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error('Photo upload failed');
  }

  return response.json();
}
