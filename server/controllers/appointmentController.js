const { supabase } = require('../config/supabase.js');

// Отримати всі записи
exports.getAllAppointments = async (req, res) => {
  try {
    const { data, error } = await supabase.from('appointments').select(`
        *,
        users (id, email),
        services (id, name, price, duration)
      `);

    if (error) throw error;

    // Додаємо інформацію про механіків окремо
    const appointmentsWithMechanics = await Promise.all(
      data.map(async (appointment) => {
        if (appointment.mechanic_id) {
          const { data: mechanic, error: mechanicError } = await supabase
            .from('mechanics')
            .select('id, first_name, last_name, specialization')
            .eq('id', appointment.mechanic_id)
            .single();

          if (!mechanicError && mechanic) {
            appointment.mechanics = mechanic;
          }
        }
        return appointment;
      })
    );

    res.json(appointmentsWithMechanics);
  } catch (err) {
    console.error('Get appointments error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати запис за ID
exports.getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('appointments')
      .select(
        `
        *,
        users (id, email),
        services (id, name, price, duration)
      `
      )
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Запис не знайдено' });
    }

    // Додаємо інформацію про механіка окремо
    if (data.mechanic_id) {
      const { data: mechanic, error: mechanicError } = await supabase
        .from('mechanics')
        .select('id, first_name, last_name, specialization')
        .eq('id', data.mechanic_id)
        .single();

      if (!mechanicError && mechanic) {
        data.mechanics = mechanic;
      }
    }

    res.json(data);
  } catch (err) {
    console.error('Get appointment error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати записи користувача
exports.getUserAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('appointments')
      .select(
        `
        *,
        services (id, name, price, duration)
      `
      )
      .eq('user_id', userId)
      .order('scheduled_time', { ascending: true });

    if (error) throw error;

    // Додаємо інформацію про механіків окремо
    const appointmentsWithMechanics = await Promise.all(
      data.map(async (appointment) => {
        if (appointment.mechanic_id) {
          const { data: mechanic, error: mechanicError } = await supabase
            .from('mechanics')
            .select('id, first_name, last_name, specialization')
            .eq('id', appointment.mechanic_id)
            .single();

          if (!mechanicError && mechanic) {
            appointment.mechanics = mechanic;
          }
        }
        return appointment;
      })
    );

    res.json(appointmentsWithMechanics);
  } catch (err) {
    console.error('Get user appointments error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Створити новий запис
exports.createAppointment = async (req, res) => {
  try {
    const { service_id, mechanic_id, scheduled_time, notes, car_info } = req.body;

    const user_id = req.user.id;

    // Перевірка доступності часу
    const { data: existingAppointment, error: checkError } = await supabase
      .from('appointments')
      .select('*')
      .eq('mechanic_id', mechanic_id)
      .eq('scheduled_time', scheduled_time)
      .single();

    if (checkError && checkError.code !== 'PGRST116') throw checkError;
    if (existingAppointment) {
      return res.status(400).json({ message: 'Цей час вже зайнято' });
    }

    // Створення запису
    const { data, error } = await supabase
      .from('appointments')
      .insert([
        {
          user_id,
          service_id,
          mechanic_id,
          scheduled_time,
          notes,
          car_info,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    console.error('Create appointment error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Оновити статус запису
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, completion_notes } = req.body;

    const { data, error } = await supabase
      .from('appointments')
      .update({
        status,
        completion_notes,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Запис не знайдено' });
    }

    res.json(data);
  } catch (err) {
    console.error('Update appointment status error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Скасувати запис
exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Перевіряємо чи запис належить користувачу
    const { data: appointment, error: checkError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (checkError) throw checkError;
    if (!appointment) {
      return res.status(404).json({ message: 'Запис не знайдено' });
    }

    // Перевіряємо чи можна скасувати (наприклад, не менше ніж за 24 години)
    const appointmentDate = new Date(appointment.scheduled_time);
    const now = new Date();
    const hoursUntilAppointment = (appointmentDate - now) / (1000 * 60 * 60);

    if (hoursUntilAppointment < 24) {
      return res.status(400).json({
        message: 'Скасування можливе не менше ніж за 24 години до запису',
      });
    }

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({ message: 'Запис скасовано' });
  } catch (err) {
    console.error('Cancel appointment error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
