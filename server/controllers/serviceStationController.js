const { supabase } = require('../config/supabase.js');

// Отримати всі СТО
exports.getAllStations = async (req, res) => {
  try {
    const { data, error } = await supabase.from('service_stations').select(`
        *,
        services (id, name, price, duration),
        mechanics (id, first_name, last_name, specialization)
      `);

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Get stations error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати СТО за ID
exports.getStationById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('service_stations')
      .select(
        `
        *,
        services (id, name, price, duration),
        mechanics (id, first_name, last_name, specialization),
        reviews (id, rating, comment, created_at, users (id, email))
      `
      )
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'СТО не знайдено' });
    }

    res.json(data);
  } catch (err) {
    console.error('Get station error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Створити нову СТО
exports.createStation = async (req, res) => {
  try {
    const { name, address, phone, working_hours, description } = req.body;

    const { data, error } = await supabase
      .from('service_stations')
      .insert([{ name, address, phone, working_hours, description }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    console.error('Create station error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Оновити СТО
exports.updateStation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, working_hours, description } = req.body;

    const { data, error } = await supabase
      .from('service_stations')
      .update({ name, address, phone, working_hours, description })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'СТО не знайдено' });
    }

    res.json(data);
  } catch (err) {
    console.error('Update station error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Видалити СТО
exports.deleteStation = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('service_stations').delete().eq('id', id);

    if (error) throw error;

    res.status(204).send();
  } catch (err) {
    console.error('Delete station error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
