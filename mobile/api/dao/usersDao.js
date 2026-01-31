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
