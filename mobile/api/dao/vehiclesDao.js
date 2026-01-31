import { axiosAuth } from '../axiosConfig';

const mapVehicle = (v) => ({
  id: v.id || v.vin,
  vin: v.vin || v.id,
  brand: v.make,
  model: v.model,
  year: v.year,
  licensePlate: v.license_plate,
  mileage: v.mileage,
  color: v.color,
});

export async function listByUser(userId) {
  const response = await axiosAuth.get('/api/vehicles', {
    params: { user_id: userId },
  });
  const data = Array.isArray(response.data) ? response.data : [];
  return data.map(mapVehicle);
}

export async function getById(id) {
  const response = await axiosAuth.get(`/api/vehicles/${id}`);
  const v = response.data;
  return mapVehicle(v);
}

export async function create(payload, userId) {
  const body = {
    user_id: userId,
    vin: payload.vin,
    make: payload.make || payload.brand,
    model: payload.model,
    year: payload.year,
    license_plate: payload.licensePlate,
    color: payload.color,
    mileage: payload.mileage ? Number(payload.mileage) : null,
  };

  const response = await axiosAuth.post('/api/vehicles', body);
  return mapVehicle(response.data);
}

export async function updateById(id, data) {
  const body = {
    make: data.make || data.brand,
    model: data.model,
    year: data.year,
    license_plate: data.licensePlate,
    color: data.color,
    vin: data.vin,
    mileage: data.mileage ? Number(data.mileage) : null,
  };

  const response = await axiosAuth.put(`/api/vehicles/${id}`, body);
  return mapVehicle(response.data);
}

export async function deleteById(id) {
  await axiosAuth.delete(`/api/vehicles/${id}`);
  return true;
}

export async function listByVins(vins) {
  if (!Array.isArray(vins) || vins.length === 0) return [];
  const params = new URLSearchParams();
  vins.forEach((vin) => params.append('vin', vin));

  const response = await axiosAuth.get('/api/vehicles', {
    params,
  });

  const data = Array.isArray(response.data) ? response.data : [];
  return data.map(mapVehicle);
}

export async function listAllAdmin() {
  const response = await axiosAuth.get('/api/vehicles', {
    params: { admin: '1' },
  });

  const data = Array.isArray(response.data) ? response.data : [];
  return data.map((v) => ({
    id: v.id || v.vin,
    make: v.make,
    model: v.model,
    year: v.year,
    licensePlate: v.license_plate,
    status: 'active',
    ownerName: v.owner_name || '—',
  }));
}
