import axiosAuth from './axiosConfig';

export const getAllServiceRecords = async () => {
  try {
    const response = await axiosAuth.get('/api/service-records');
    const rows = Array.isArray(response.data) ? response.data : [];

    const vehicleIds = [
      ...new Set(rows.map((r) => r.vehicle_id).filter((v) => v)),
    ];
    const vehiclesMap = {};

    await Promise.all(
      vehicleIds.map(async (id) => {
        try {
          const vResp = await axiosAuth.get(`/api/vehicles/${id}`);
          if (vResp && vResp.data) {
            vehiclesMap[id] = vResp.data;
          }
        } catch {
          vehiclesMap[id] = null;
        }
      })
    );

    return rows.map((r) => ({
      ...r,
      vehicle: vehiclesMap[r.vehicle_id] || null,
    }));
  } catch (error) {
    console.error(
      '[ServiceRecordsService] Помилка при отриманні сервісних записів:',
      error
    );
    throw error;
  }
};

export const getServiceRecordById = async (id) => {
  try {
    const response = await axiosAuth.get(`/api/service-records/${id}`);
    if (!response || !response.data) {
      throw new Error('Запис не знайдено');
    }
    return response.data;
  } catch (error) {
    console.error(`[ServiceRecordsService] Помилка при отриманні сервісного запису ${id}:`, error);
    throw error;
  }
};

export const createServiceRecord = async (serviceRecordData) => {
  try {
    const body = {
      vehicle_id: serviceRecordData.vehicle_id || null,
      service_date:
        serviceRecordData.date ||
        serviceRecordData.service_date ||
        new Date().toISOString(),
      mileage:
        typeof serviceRecordData.mileage === 'number'
          ? serviceRecordData.mileage
          : parseInt(serviceRecordData.mileage, 10) || null,
      description: serviceRecordData.description || '',
      cost:
        typeof serviceRecordData.cost === 'number'
          ? serviceRecordData.cost
          : parseFloat(serviceRecordData.cost) || 0,
      recommendations: serviceRecordData.recommendations || null,
      next_service_date: serviceRecordData.next_service_date || null,
    };

    const response = await axiosAuth.post('/api/service-records', body);
    return response.data;
  } catch (error) {
    console.error('[ServiceRecordsService] Помилка створення сервісного запису:', error);
    throw error;
  }
};

export const updateServiceRecord = async (id, serviceRecordData) => {
  try {
    const body = {
      description: serviceRecordData.description,
      service_date:
        serviceRecordData.date || serviceRecordData.service_date || undefined,
      mileage:
        typeof serviceRecordData.mileage === 'number'
          ? serviceRecordData.mileage
          : parseInt(serviceRecordData.mileage, 10) || null,
      cost:
        typeof serviceRecordData.cost === 'number'
          ? serviceRecordData.cost
          : parseFloat(serviceRecordData.cost) || 0,
      recommendations: serviceRecordData.recommendations,
      next_service_date: serviceRecordData.next_service_date,
    };

    const response = await axiosAuth.put(`/api/service-records/${id}`, body);
    return response.data;
  } catch (error) {
    console.error(
      `[ServiceRecordsService] Error updating service record ${id}:`,
      error
    );
    throw error;
  }
};

export const deleteServiceRecord = async (id) => {
  try {
    await axiosAuth.delete(`/api/service-records/${id}`);
    return { success: true, id };
  } catch (error) {
    console.error(
      `[ServiceRecordsService] Error deleting service record ${id}:`,
      error
    );
    throw error;
  }
};
