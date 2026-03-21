import { axiosAuth } from '../axiosConfig';

const mapVehicle = (v) => ({
  id: v.id || v.vin,
  vin: v.vin || v.id,
  brand: v.make || v.brand,
  model: v.model,
  year: v.year,
  licensePlate: v.license_plate || v.licensePlate,
  mileage: v.mileage,
  color: v.color,
});

const mapVehicleDetails = (v) => ({
  id: v.id || v.vin,
  make: v.make || v.brand || '',
  model: v.model || '',
  year: v.year || v.make_year || null,
  vin: v.vin || '',
  licensePlate: v.license_plate || v.licensePlate || '',
  color: v.color || '',
  mileage: v.mileage != null ? Number(v.mileage) : null,
  engineType: v.engine_type || v.engineType || '',
  engineCapacity: v.engine_capacity || v.engineVolume || null,
  transmission: v.transmission || '',
  photoUrl: v.photo_url || v.photoUrl || null,
});

const mapRegistryVehicle = (v) => {
  const fuelRaw = String(v?.fuel_type || '').toUpperCase();
  let engineType = '';
  if (fuelRaw.includes('BENZINE') || fuelRaw.includes('PETROL')) engineType = 'petrol';
  else if (fuelRaw.includes('DIESEL')) engineType = 'diesel';
  else if (fuelRaw.includes('GAS')) engineType = 'gas';
  else if (fuelRaw.includes('ELECTRO') || fuelRaw.includes('ELECTRIC')) engineType = 'electric';
  else if (fuelRaw.includes('HYBRID')) engineType = 'hybrid';
  return {
    id: v?.vin || null,
    make: v?.brand || v?.make || '',
    model: v?.model || '',
    year: v?.make_year || v?.year || null,
    vin: v?.vin || '',
    licensePlate: v?.license_plate || v?.licensePlate || '',
    color: v?.color || '',
    mileage: null,
    engineType,
    engineCapacity: v?.engine_volume || v?.engineVolume || null,
    transmission: '',
    photoUrl: null,
  };
};

export async function listByUser(userId) {
  const response = await axiosAuth.get('/api/vehicles', {
    params: userId ? { user_id: userId } : undefined,
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
    make: v.make || v.brand,
    model: v.model,
    year: v.year,
    licensePlate: v.license_plate || v.licensePlate,
    status: 'active',
    ownerName: v.owner_name || '—',
  }));
}

export async function listServicedByCurrentMechanic() {
  const response = await axiosAuth.get('/api/vehicles', {
    params: { serviced: '1' },
  });
  const data = Array.isArray(response.data) ? response.data : [];
  return data.map(mapVehicle);
}

export async function uploadPhoto(uri) {
  if (!uri) return null;
  const filename = uri.split(/[\\/]/).pop() || 'photo.jpg';
  const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : 'jpg';
  const type = ext === 'png' ? 'image/png' : 'image/jpeg';

  const formData = new FormData();
  formData.append('photo', {
    uri,
    name: filename,
    type,
  });

  const response = await axiosAuth.post('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response?.data || null;
}

export async function getDetailsByLicensePlate(licensePlate) {
  if (!licensePlate) return null;
  const normalized = String(licensePlate).trim();
  const response = await axiosAuth.get(
    `/api/vehicles/license/${encodeURIComponent(normalized)}`
  );
  if (!response?.data) return null;
  return mapVehicleDetails(response.data);
}

export async function getDetailsByVin(vin) {
  if (!vin) return null;
  const normalized = String(vin).trim().toUpperCase();
  const response = await axiosAuth.get(`/api/vehicles/${encodeURIComponent(normalized)}`);
  if (!response?.data) return null;
  return mapVehicleDetails(response.data);
}

export async function getRegistryDetailsByLicensePlate(licensePlate) {
  if (!licensePlate) return null;
  const normalized = String(licensePlate).trim();
  const response = await axiosAuth.get('/api/vehicle-registry', {
    params: { license_plate: normalized },
  });
  if (!response?.data) return null;
  return mapRegistryVehicle(response.data);
}
