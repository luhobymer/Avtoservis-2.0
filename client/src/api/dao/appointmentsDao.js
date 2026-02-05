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

function mapStatus(status) {
  const value = (status || '').toLowerCase();
  if (value === 'pending') return 'pending';
  if (value === 'confirmed') return 'confirmed';
  if (value === 'in_progress') return 'in_progress';
  if (value === 'completed') return 'completed';
  if (value === 'cancelled' || value === 'canceled') return 'cancelled';
  if (value === 'scheduled') return 'pending';
  if (value === 'in-progress') return 'in_progress';
  return 'pending';
}

function normalizeListPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function mapAppointment(row) {
  const service = row.services || null;
  const mechanic = row.mechanics || null;
  const servicesList = Array.isArray(row.services_list) ? row.services_list : [];
  const serviceIds = Array.isArray(row.service_ids)
    ? row.service_ids
    : Array.isArray(row.service_ids_list)
      ? row.service_ids_list
      : [];
  const serviceId = row.service_id || (service && service.id) || (serviceIds[0] || null);
  const serviceName =
    (servicesList[0] && servicesList[0].name) || (service && service.name) || row.service_type || null;
  const servicePrice =
    service && service.price != null ? Number(service.price) : null;
  const serviceDuration =
    service && service.duration != null ? Number(service.duration) : null;

  const appointmentPrice =
    row.appointment_price != null && row.appointment_price !== ''
      ? Number(row.appointment_price)
      : null;
  const appointmentDuration =
    row.appointment_duration != null && row.appointment_duration !== ''
      ? Number(row.appointment_duration)
      : null;

  return {
    id: row.id,
    UserId: row.user_id,
    service_id: serviceId,
    service_ids: serviceIds,
    mechanic_id: row.mechanic_id || (mechanic && mechanic.id) || null,
    vehicle_vin: row.vehicle_vin,
    serviceId,
    serviceType: row.service_type || serviceName || '',
    serviceName,
    servicePrice,
    serviceDuration,
    appointmentPrice,
    appointmentDuration,
    scheduledDate: row.scheduled_time,
    estimatedCompletionDate: row.estimated_completion_date || row.appointment_date || null,
    actualCompletionDate: row.actual_completion_date || null,
    status: mapStatus(row.status),
    description: row.description || '',
    notes: row.notes || '',
    services: service,
    services_list: servicesList,
    mechanics: mechanic
  };
}

export async function listAdmin() {
  const payload = await requestJson('/api/appointments?admin=1');
  const rows = normalizeListPayload(payload);
  return rows.map(mapAppointment);
}

export async function update(id, payload) {
  const body = {
    service_id: payload.service_id ?? payload.serviceId ?? null,
    service_ids: payload.service_ids || payload.serviceIds || null,
    mechanic_id: payload.mechanic_id ?? payload.mechanicId ?? null,
    vehicle_vin: payload.vehicle_vin,
    service_type: payload.service_type || payload.serviceType,
    scheduled_time: payload.scheduled_time || payload.scheduledTime,
    status: payload.status || null,
    notes: payload.notes,
    completion_notes: payload.completion_notes,
    completion_mileage: payload.completion_mileage,
    parts: payload.parts,
    appointment_date: payload.estimated_completion_date || null,
    appointment_price: payload.appointment_price ?? payload.appointmentPrice ?? null,
    appointment_duration: payload.appointment_duration ?? payload.appointmentDuration ?? null
  };

  await requestJson(`/api/appointments/${id}`, {
    method: 'PUT',
    body
  });
}

export async function updateStatus(id, status, completionData = {}) {
  const body = {
    status,
    ...completionData
  };
  await requestJson(`/api/appointments/${id}/status`, {
    method: 'PUT',
    body
  });
}

export async function listForUser(userId) {
  if (!userId) return [];
  const payload = await requestJson(`/api/appointments?user_id=${encodeURIComponent(userId)}`);
  const rows = normalizeListPayload(payload);
  return rows.map(mapAppointment);
}

export async function getById(id) {
  const row = await requestJson(`/api/appointments/${id}`);
  if (!row) {
    throw new Error('Appointment not found');
  }
  return mapAppointment(row);
}

export async function create(payload) {
  const body = {
    user_id: payload.user_id,
    service_id: payload.service_id ?? payload.serviceId,
    service_ids: payload.service_ids || payload.serviceIds || null,
    mechanic_id: payload.mechanic_id ?? payload.mechanicId,
    vehicle_vin: payload.vehicle_vin,
    service_type: payload.service_type || payload.serviceType,
    scheduled_time: payload.scheduled_time,
    status: payload.status || 'pending',
    notes: payload.notes || null,
    parts: payload.parts,
    appointment_date: payload.estimated_completion_date || null,
    appointment_price: payload.appointment_price ?? payload.appointmentPrice ?? null,
    appointment_duration: payload.appointment_duration ?? payload.appointmentDuration ?? null
  };

  const created = await requestJson('/api/appointments', {
    method: 'POST',
    body
  });

  if (created && created.id) {
    return created.id;
  }

  return null;
}
