import axiosAuth from './axiosConfig';

export const getServiceRecordsByPart = async (partNumber, vehicleVin) => {
  try {
    const params = {};
    if (partNumber) {
      params.part_number = partNumber;
    }
    if (vehicleVin) {
      params.vehicle_vin = vehicleVin;
    }
    const response = await axiosAuth.get('/api/service-records', { params });
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map(r => ({
      id: r.id,
      service_date: r.service_date,
      description: r.description || '',
      mileage: r.mileage,
      cost: r.cost,
      vehicleName: r.vehicle_name || ''
    }));
  } catch (error) {
    console.error('[API] Помилка при отриманні історії запчастини:', error);
    return [];
  }
};

