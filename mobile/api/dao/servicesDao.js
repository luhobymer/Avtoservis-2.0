import axiosAuth from '../axiosConfig'

export async function listAll() {
  const response = await axiosAuth.get('/api/parts', {
    params: { limit: 1000, offset: 0 }
  })
  const payload = response.data
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description || '',
    price: Number(p.price) || 0,
    duration: null
  }))
}

export async function create(payload) {
  const body = {
    name: payload.name,
    description: payload.description || '',
    price: typeof payload.price === 'number' ? payload.price : parseFloat(payload.price) || 0
  }
  const response = await axiosAuth.post('/api/parts', body)
  return response.data
}

export async function updateById(id, payload) {
  const body = {
    name: payload.name,
    description: payload.description || '',
    price: typeof payload.price === 'number' ? payload.price : parseFloat(payload.price) || 0
  }
  const response = await axiosAuth.put(`/api/parts/${id}`, body)
  return response.data
}

export async function deleteById(id) {
  await axiosAuth.delete(`/api/parts/${id}`)
  return true
}
