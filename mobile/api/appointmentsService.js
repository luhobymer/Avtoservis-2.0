import axiosAuth from './axiosConfig';
import secureStorage, { SECURE_STORAGE_KEYS } from '../utils/secureStorage';

const SIMPLE_SERVICE_TYPES = ['service', 'repair', 'diagnostics', 'other'];

const getCurrentUserId = async () => {
  try {
    const storedUser = await secureStorage.secureGet(
      SECURE_STORAGE_KEYS.USER_DATA,
      true
    );
    if (storedUser && storedUser.id) {
      return storedUser.id;
    }
    return null;
  } catch {
    return null;
  }
};

export const getAllAppointments = async (token) => {
  try {
    console.log('[API] Запит записів на обслуговування');

    const userId = await getCurrentUserId();
    if (!userId) {
      return [];
    }

    const response = await axiosAuth.get('/api/appointments', {
      params: { user_id: userId },
    });

    const rows = Array.isArray(response.data) ? response.data : [];
    if (!rows.length) {
      return [];
    }

    const vins = [...new Set(rows.map((a) => a.vehicle_vin).filter(Boolean))];

    let vehiclesMap = {};
    if (vins.length > 0) {
      const vehiclesResponse = await axiosAuth.get('/api/vehicles', {
        params: { vin: vins },
      });
      const vehicles = Array.isArray(vehiclesResponse.data)
        ? vehiclesResponse.data
        : [];
      vehiclesMap = vehicles.reduce((acc, v) => {
        if (v && v.vin) {
          acc[v.vin] = v;
        }
        return acc;
      }, {});
    }

    return rows.map((a) => {
      const v = a.vehicle_vin ? vehiclesMap[a.vehicle_vin] : null;
      const vehicleInfo = v ? `${v.make} ${v.model} (${v.year})` : '';

      const serviceName =
        !a.service_type || SIMPLE_SERVICE_TYPES.includes(a.service_type)
          ? null
          : a.service_type;

      return {
        ...a,
        vehicle_info: vehicleInfo,
        service_name: serviceName,
        service_price: null,
        service_duration: null,
      };
    });
  } catch (error) {
    console.error('[AppointmentsService] Помилка при отриманні записів:', error);
    throw error;
  }
};

export const getAppointmentById = async (id, token) => {
  try {
    console.log(`[API] Запит запису на обслуговування з ID ${id}`);

    const response = await axiosAuth.get(`/api/appointments/${id}`);
    const data = response.data;

    if (!data || !data.id) {
      throw new Error('Запис не знайдено');
    }

    let vin = data.vehicle_vin || null;
    let vehicleInfo = '';

    if (data.vehicle_vin) {
      const vehiclesResponse = await axiosAuth.get('/api/vehicles', {
        params: { vin: [data.vehicle_vin] },
      });
      const vehicles = Array.isArray(vehiclesResponse.data)
        ? vehiclesResponse.data
        : [];
      const v = vehicles.find((item) => item.vin === data.vehicle_vin);
      if (v) {
        vin = v.vin || data.vehicle_vin;
        vehicleInfo = `${v.make} ${v.model} (${v.year})`;
      }
    }

    const serviceName =
      !data.service_type || SIMPLE_SERVICE_TYPES.includes(data.service_type)
        ? null
        : data.service_type;

    return {
      ...data,
      vehicle_vin: vin,
      vehicle_info: vehicleInfo,
      service_name: serviceName,
      service_price: null,
      service_duration: null,
    };
  } catch (error) {
    console.error('[appointmentsService] Помилка при отриманні деталей запису:', error);
    throw error;
  }
};

export const createAppointment = async (appointmentData, token) => {
  try {
    console.log(
      '[API] Створення нового запису на обслуговування:',
      appointmentData
    );

    const appointmentDate =
      appointmentData.appointment_date ||
      (appointmentData.scheduled_time
        ? appointmentData.scheduled_time.split('T')[0]
        : null);

    const body = {
      user_id: appointmentData.user_id,
      vehicle_vin: appointmentData.vehicle_vin,
      service_type: appointmentData.service_type,
      scheduled_time: appointmentData.scheduled_time,
      status: appointmentData.status || 'pending',
      notes: appointmentData.notes || '',
      appointment_date: appointmentDate,
    };

    const response = await axiosAuth.post('/api/appointments', body);
    return response.data;
  } catch (error) {
    console.error('[AppointmentsService] Помилка при створенні запису:', error);
    throw error;
  }
};

export const updateAppointment = async (id, appointmentData, token) => {
  try {
    console.log(
      `[API] Оновлення запису на обслуговування ${id}:`,
      appointmentData
    );

    const payload = {};

    if (appointmentData.vehicle_vin !== undefined) {
      payload.vehicle_vin = appointmentData.vehicle_vin;
    }
    if (appointmentData.service_type !== undefined) {
      payload.service_type = appointmentData.service_type;
    }
    if (appointmentData.scheduled_time !== undefined) {
      payload.scheduled_time = appointmentData.scheduled_time;
    }
    if (appointmentData.status !== undefined) {
      payload.status = appointmentData.status;
    }
    if (appointmentData.notes !== undefined) {
      payload.notes = appointmentData.notes;
    }
    if (appointmentData.appointment_date !== undefined) {
      payload.appointment_date = appointmentData.appointment_date;
    }

    const response = await axiosAuth.put(`/api/appointments/${id}`, payload);
    return response.data;
  } catch (error) {
    console.error(
      `[AppointmentsService] Помилка при оновленні запису ${id}:`,
      error
    );
    throw error;
  }
};

export const deleteAppointment = async (id, token) => {
  try {
    console.log(`[API] Видалення запису на обслуговування ${id}`);

    await axiosAuth.delete(`/api/appointments/${id}`);
    return { success: true, id };
  } catch (error) {
    console.error(
      `[AppointmentsService] Помилка при видаленні запису ${id}:`,
      error
    );
    throw error;
  }
};

export const confirmAppointment = async (id, token) => {
  try {
    console.log(`[API] Підтвердження запису на обслуговування ${id}`);

    const payload = {
      status: 'confirmed',
    };

    const response = await axiosAuth.put(`/api/appointments/${id}/status`, payload);
    return response.data;
  } catch (error) {
    console.error(
      `[AppointmentsService] Помилка при підтвердженні запису ${id}:`,
      error
    );
    throw error;
  }
};

export const startAppointment = async (id, token) => {
  try {
    console.log(
      `[API] Позначення запису ${id} як "в процесі"`
    );

    const payload = {
      status: 'in_progress',
    };

    const response = await axiosAuth.put(`/api/appointments/${id}/status`, payload);
    return response.data;
  } catch (error) {
    console.error(
      `[AppointmentsService] Помилка при позначенні запису ${id} як "в процесі":`,
      error
    );
    throw error;
  }
};

export const completeAppointment = async (id, completionData, token) => {
  try {
    console.log(
      `[API] Завершення запису на обслуговування ${id}:`,
      completionData
    );

    const payload = {
      status: 'completed',
    };

    if (completionData && typeof completionData.notes === 'string') {
      payload.completion_notes = completionData.notes;
    }

    const response = await axiosAuth.put(`/api/appointments/${id}/status`, payload);
    return response.data;
  } catch (error) {
    console.error(
      `[AppointmentsService] Помилка при завершенні запису ${id}:`,
      error
    );
    throw error;
  }
};

export const cancelAppointment = async (id, cancellationData, token) => {
  try {
    console.log(
      `[API] Скасування запису на обслуговування ${id}:`,
      cancellationData
    );

    const payload = {
      status: 'cancelled',
    };

    if (cancellationData && typeof cancellationData.reason === 'string') {
      payload.notes = cancellationData.reason;
    }

    const response = await axiosAuth.put(`/api/appointments/${id}`, payload);
    return response.data;
  } catch (error) {
    console.error(
      `[AppointmentsService] Помилка при скасуванні запису ${id}:`,
      error
    );
    throw error;
  }
};
