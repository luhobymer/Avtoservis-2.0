import { axiosAuth } from '../axiosConfig';

export async function listAll() {
  const response = await axiosAuth.get('/api/parts', {
    params: {
      limit: 500,
      offset: 0,
    },
  });
  const payload = response && response.data ? response.data : null;
  const rows = payload && Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? payload : [];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || '',
    price: row.price != null ? row.price : 0,
    stock: typeof row.stock === 'number' ? row.stock : 0,
  }));
}

export async function create(payload) {
  const body = {
    name: payload.name,
    description: payload.description || '',
    price: Number(payload.price) || 0,
    stock: Number(payload.stock) || 0,
  };
  const response = await axiosAuth.post('/api/parts', body);
  return response && response.data ? response.data : null;
}

export async function updateById(id, payload) {
  const body = {
    name: payload.name,
    description: payload.description || '',
    price: Number(payload.price) || 0,
    stock: Number(payload.stock) || 0,
  };
  const response = await axiosAuth.put(`/api/parts/${id}`, body);
  return response && response.data ? response.data : null;
}

export async function deleteById(id) {
  await axiosAuth.delete(`/api/parts/${id}`);
  return true;
}
