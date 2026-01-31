import axiosAuth from './axiosConfig';

export const listMasters = async (options = {}) => {
  try {
    const params = { limit: 200, offset: 0 };
    if (options.city) {
      params.city = String(options.city);
    }
    const response = await axiosAuth.get('/api/mechanics', { params });
    const payload = response.data;
    const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    return rows.map(m => ({
      id: m.id,
      first_name: m.first_name,
      last_name: m.last_name,
      name: m.name,
      specialization: m.specialization,
      station_id: m.station_id
    }));
  } catch (error) {
    console.error('[API] Помилка при отриманні списку майстрів:', error);
    return [];
  }
};
