const { supabase } = require('../config/supabase.js');

// Отримати всі послуги
exports.getAllServices = async (req, res) => {
  try {
    const { data: services, error } = await supabase.from('services').select('*');

    if (error) throw error;

    // Для кожної послуги отримуємо інформацію про станцію
    const servicesWithStations = await Promise.all(
      services.map(async (service) => {
        if (service.station_id) {
          const { data: station } = await supabase
            .from('service_stations')
            .select('id, name')
            .eq('id', service.station_id)
            .single();
          return { ...service, service_stations: station };
        }
        return service;
      })
    );

    res.json(servicesWithStations);
  } catch (err) {
    console.error('Get services error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати послугу за ID
exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: service, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!service) {
      return res.status(404).json({ message: 'Послугу не знайдено' });
    }

    // Отримуємо інформацію про станцію
    let stationData = null;
    if (service.station_id) {
      const { data: station } = await supabase
        .from('service_stations')
        .select('id, name')
        .eq('id', service.station_id)
        .single();
      stationData = station;
    }

    // Отримуємо інформацію про категорію
    let categoryData = null;
    if (service.category_id) {
      const { data: category } = await supabase
        .from('service_categories')
        .select('id, name')
        .eq('id', service.category_id)
        .single();
      categoryData = category;
    }

    const result = {
      ...service,
      service_stations: stationData,
      service_categories: categoryData,
    };

    res.json(result);
  } catch (err) {
    console.error('Get service error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Створити нову послугу
exports.createService = async (req, res) => {
  try {
    const { name, description, price, duration, service_station_id, category_id } = req.body;

    const { data, error } = await supabase
      .from('services')
      .insert([
        {
          name,
          description,
          price,
          duration,
          service_station_id,
          category_id,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Оновити послугу
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, duration, service_station_id, category_id } = req.body;

    const { data, error } = await supabase
      .from('services')
      .update({
        name,
        description,
        price,
        duration,
        service_station_id,
        category_id,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Послугу не знайдено' });
    }

    res.json(data);
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Видалити послугу
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('services').delete().eq('id', id);

    if (error) throw error;

    res.status(204).send();
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
