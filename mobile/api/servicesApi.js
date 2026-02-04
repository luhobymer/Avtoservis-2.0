import axiosAuth from './axiosConfig';

// Отримання всіх послуг (публічний endpoint)
export const getAllServices = async () => {
  try {
    const response = await axiosAuth.get('/api/parts', {
      params: { limit: 1000, offset: 0 }
    });

    const payload = response.data;
    const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];

    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      price: Number(p.price) || 0,
      duration: null,
      category: 'Запчастини'
    }));
  } catch (error) {
    console.error('Помилка при отриманні послуг:', error);
    throw error;
  }
};

// Отримання всіх сервісних записів користувача
export const getUserServiceRecords = async (token) => {
  try {
    const response = await axiosAuth.get('/api/service-records', {
      params: {}
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map((r) => ({
      id: r.id,
      vehicle_vin: r.vehicle_id || null,
      service_details: r.description || '',
      cost: null,
      mileage: r.mileage || 0,
      performed_at: r.service_date || null,
      mechanic_notes: r.recommendations || null,
      service_date: r.service_date || null
    }));
  } catch (error) {
    console.error('Помилка при отриманні сервісних записів:', error);
    throw error;
  }
};

// Отримання деталей послуги за ID
export const getServiceById = async (serviceId) => {
  try {
    const response = await axiosAuth.get('/api/parts', {
      params: { id: serviceId }
    });
    const payload = response.data;
    const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    const found = rows.find((p) => String(p.id) === String(serviceId)) || rows[0];
    if (!found) {
      throw new Error('Послугу не знайдено');
    }
    return found;
  } catch (error) {
    console.error(`Помилка при отриманні деталей послуги (ID: ${serviceId}):`, error);
    throw error;
  }
};

// Отримання деталей сервісного запису
export const getServiceRecordDetails = async (recordId, token) => {
  try {
    const response = await axiosAuth.get(`/api/service-records/${recordId}`);
    return response.data;
  } catch (error) {
    console.error(`Помилка при отриманні деталей сервісного запису (ID: ${recordId}):`, error);
    throw error;
  }
};

// Додавання нового сервісного запису
export const addServiceRecord = async (recordData, token) => {
  try {
    const payload = {
      vehicle_id: recordData.vehicle_vin || recordData.vehicle_id,
      service_date: recordData.service_date || recordData.performed_at,
      mileage: recordData.mileage ?? null,
      description: recordData.service_details || recordData.description || '',
      recommendations: recordData.mechanic_notes || null,
      next_service_date: recordData.next_service_date || null
    };

    const response = await axiosAuth.post('/api/service-records', payload);
    return response.data;
  } catch (error) {
    console.error('Помилка при додаванні сервісного запису:', error);
    throw error;
  }
};

// Оновлення існуючого сервісного запису
export const updateServiceRecord = async (recordId, recordData, token) => {
  try {
    const payload = {};

    if (recordData.vehicle_vin !== undefined || recordData.vehicle_id !== undefined) {
      payload.vehicle_id = recordData.vehicle_vin || recordData.vehicle_id;
    }
    if (recordData.service_date !== undefined || recordData.performed_at !== undefined) {
      payload.service_date = recordData.service_date || recordData.performed_at;
    }
    if (recordData.mileage !== undefined) {
      payload.mileage = recordData.mileage;
    }
    if (recordData.service_details !== undefined || recordData.description !== undefined) {
      payload.description = recordData.service_details || recordData.description;
    }
    if (recordData.mechanic_notes !== undefined || recordData.recommendations !== undefined) {
      payload.recommendations = recordData.mechanic_notes || recordData.recommendations;
    }
    if (recordData.next_service_date !== undefined) {
      payload.next_service_date = recordData.next_service_date;
    }

    const response = await axiosAuth.put(`/api/service-records/${recordId}`, payload);
    return response.data;
  } catch (error) {
    console.error(`Помилка при оновленні сервісного запису (ID: ${recordId}):`, error);
    throw error;
  }
};

// Видалення сервісного запису
export const deleteServiceRecord = async (recordId, token) => {
  try {
    await axiosAuth.delete(`/api/service-records/${recordId}`);
    return { success: true, id: recordId };
  } catch (error) {
    console.error(`Помилка при видаленні сервісного запису (ID: ${recordId}):`, error);
    throw error;
  }
};
