import axiosAuth from '../axiosConfig'

const normalizeListPayload = payload => {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.data)) return payload.data
  return []
}

const mapStatus = status => {
  if (status === 'pending') return 'pending'
  if (status === 'confirmed') return 'confirmed'
  if (status === 'in_progress') return 'in_progress'
  if (status === 'completed') return 'completed'
  if (status === 'cancelled' || status === 'canceled') return 'cancelled'
  return 'pending'
}

const mapAppointment = row => ({
  id: row.id,
  dateTime: row.scheduled_time,
  clientName: row.user_id || 'Клієнт',
  vehicleMake: '',
  vehicleModel: '',
  vehiclePlate: row.vehicle_vin || '',
  serviceName: row.service_type || null,
  servicePrice: null,
  serviceDuration: null,
  status: mapStatus(row.status)
})

export async function listAdmin() {
  const response = await axiosAuth.get('/api/appointments', { params: { admin: 1 } })
  const rows = normalizeListPayload(response.data)
  return rows.map(mapAppointment)
}

export async function updateStatus(id, status) {
  const body = { status }
  const response = await axiosAuth.put(`/api/appointments/${id}`, body)
  return response.data
}
