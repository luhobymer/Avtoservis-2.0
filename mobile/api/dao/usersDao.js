import axiosAuth from '../axiosConfig'

const normalizeListPayload = payload => {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.data)) return payload.data
  return []
}

export async function listAll() {
  const response = await axiosAuth.get('/api/users')
  const rows = normalizeListPayload(response.data)
  return rows.map(u => ({
    id: u.id,
    name: u.name || u.email,
    email: u.email,
    role: u.role || 'client',
    status: u.active ? 'active' : 'inactive'
  }))
}

export async function updateStatus(userId, status) {
  await axiosAuth.put(`/api/users/${userId}`, { active: status === 'active' })
  return true
}

export async function updateRole(userId, role) {
  await axiosAuth.put(`/api/users/${userId}`, { role })
  return true
}

export async function createUser(payload) {
  const body = {
    name: payload.name,
    email: payload.email || undefined,
    phone: payload.phone || undefined,
    password: payload.password,
    role: payload.role || 'client',
    firstName: payload.firstName,
    lastName: payload.lastName,
  }

  const response = await axiosAuth.post('/api/auth/register', body)
  const data = response?.data?.user || {}

  return {
    id: data.id,
    name: data.name || body.name,
    email: data.email || body.email || null,
    phone: data.phone || body.phone || null,
    role: data.role || body.role || 'client',
  }
}
