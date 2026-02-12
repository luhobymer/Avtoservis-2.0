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

function mapServiceRecord(row) {
  const vehicleFromRow = row.vehicle || row.Vehicle || row.vehicles || null;
  const vehicleFromColumns =
    row.vehicle_make ||
    row.vehicle_brand ||
    row.vehicle_model ||
    row.vehicle_license_plate ||
    row.vehicle_year
      ? {
          make: row.vehicle_make || row.vehicle_brand || null,
          brand: row.vehicle_brand || row.vehicle_make || null,
          model: row.vehicle_model || null,
          year: row.vehicle_year || null,
          licensePlate: row.vehicle_license_plate || null,
          vin: row.vehicle_vin || row.vin || null
        }
      : null;
  const mappedVehicle = vehicleFromRow
    ? {
        make: vehicleFromRow.make || vehicleFromRow.brand || null,
        brand: vehicleFromRow.brand || vehicleFromRow.make || null,
        model: vehicleFromRow.model || null,
        year: vehicleFromRow.year || null,
        licensePlate:
          vehicleFromRow.licensePlate || vehicleFromRow.license_plate || null,
        vin: vehicleFromRow.vin || row.vehicle_vin || row.vin || null
      }
    : vehicleFromColumns;
  const vehicleId = row.vehicle_id || row.vehicleId || vehicleFromRow?.id || null;

  return {
    id: row.id,
    VehicleId: vehicleId,
    vehicleId,
    vehicleVin: row.vehicle_vin || row.vin || mappedVehicle?.vin || null,
    serviceId: row.service_id || null,
    serviceType: row.service_type || row.serviceType || null,
    serviceName: row.service_name || row.service_type || row.serviceType || null,
    servicePrice: null,
    serviceDuration: null,
    description: row.description || '',
    mileage: row.mileage ?? 0,
    serviceDate: row.service_date || row.serviceDate || row.performed_at || null,
    performedBy: row.performed_by || row.performedBy || '',
    cost: row.cost ?? 0,
    parts: Array.isArray(row.parts) ? row.parts : [],
    Vehicle: mappedVehicle,
    vehicles: undefined,
    createdBy: row.user_id || null
  };
}

export async function listAdmin() {
  const payload = await requestJson('/api/admin/service-records');
  const rows = normalizeListPayload(payload);
  return rows.map(mapServiceRecord);
}

export async function listForUser(userId, options = {}) {
  if (!userId) return [];
  const params = new URLSearchParams();
  params.set('user_id', encodeURIComponent(userId));
  if (options.vehicleId) {
    params.set('vehicle_id', options.vehicleId);
  }
  if (options.vehicleVin) {
    params.set('vehicle_vin', options.vehicleVin);
  }
  const payload = await requestJson(`/api/service-records?${params.toString()}`);
  const rows = normalizeListPayload(payload);
  return rows.map(mapServiceRecord);
}

export async function getById(id) {
  const row = await requestJson(`/api/service-records/${id}`);
  if (!row) {
    throw new Error('Service record not found');
  }
  return mapServiceRecord(row);
}

export async function create(payload) {
  const body = {
    vehicle_id: payload.vehicle_id,
    service_type: payload.service_type || payload.serviceType || null,
    description: payload.description || null,
    mileage: payload.mileage != null ? Number(payload.mileage) : null,
    service_date: payload.service_date ? new Date(payload.service_date).toISOString() : null,
    cost: payload.cost != null ? Number(payload.cost) : null
  };

  const created = await requestJson('/api/service-records', {
    method: 'POST',
    body
  });

  if (created && created.id) {
    return created.id;
  }

  return null;
}

export async function update(id, payload) {
  const body = {
    vehicle_id: payload.vehicle_id,
    service_type: payload.service_type || payload.serviceType || null,
    description: payload.description || null,
    mileage: payload.mileage != null ? Number(payload.mileage) : null,
    service_date: payload.service_date ? new Date(payload.service_date).toISOString() : null,
    cost: payload.cost != null ? Number(payload.cost) : null
  };

  await requestJson(`/api/service-records/${id}`, {
    method: 'PUT',
    body
  });
}
