const { supabase } = require('../config/supabase.js');

// Отримати всіх механіків
exports.getAllMechanics = async (req, res) => {
  try {
    const { data, error } = await supabase.from('mechanics').select(`
        *,
        service_stations (id, name),
        specializations (id, name)
      `);

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Get mechanics error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати механіка за ID
exports.getMechanicById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('mechanics')
      .select(
        `
        *,
        service_stations (id, name),
        specializations (id, name),
        appointments (
          id,
          scheduled_time,
          status,
          services (id, name)
        )
      `
      )
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Механіка не знайдено' });
    }

    res.json(data);
  } catch (err) {
    console.error('Get mechanic error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати розклад механіка
exports.getMechanicSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    const { data, error } = await supabase
      .from('appointments')
      .select(
        `
        id,
        scheduled_time,
        status,
        services (id, name, duration),
        users (id, email)
      `
      )
      .eq('mechanic_id', id)
      .gte('scheduled_time', start_date)
      .lte('scheduled_time', end_date)
      .order('scheduled_time', { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Get mechanic schedule error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Створити нового механіка
exports.createMechanic = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      phone,
      email,
      specialization_id,
      service_station_id,
      experience_years,
    } = req.body;

    const { data, error } = await supabase
      .from('mechanics')
      .insert([
        {
          first_name,
          last_name,
          phone,
          email,
          specialization_id,
          service_station_id,
          experience_years,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    console.error('Create mechanic error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Оновити інформацію про механіка
exports.updateMechanic = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      phone,
      email,
      specialization_id,
      service_station_id,
      experience_years,
    } = req.body;

    const { data, error } = await supabase
      .from('mechanics')
      .update({
        first_name,
        last_name,
        phone,
        email,
        specialization_id,
        service_station_id,
        experience_years,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Механіка не знайдено' });
    }

    res.json(data);
  } catch (err) {
    console.error('Update mechanic error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Видалити механіка
exports.deleteMechanic = async (req, res) => {
  try {
    const { id } = req.params;

    // Перевіряємо чи є активні записи
    const { data: activeAppointments, error: checkError } = await supabase
      .from('appointments')
      .select('id')
      .eq('mechanic_id', id)
      .in('status', ['pending', 'confirmed'])
      .limit(1);

    if (checkError) throw checkError;
    if (activeAppointments?.length > 0) {
      return res.status(400).json({
        message: 'Неможливо видалити механіка з активними записами',
      });
    }

    const { error } = await supabase.from('mechanics').delete().eq('id', id);

    if (error) throw error;

    res.status(204).send();
  } catch (err) {
    console.error('Delete mechanic error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
