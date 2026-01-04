const { supabase } = require('../config/supabase.js');

// Хелпер: нормалізація держномеру (прибирає пробіли/розділювачі, upper-case, мапить кирилицю на латиницю для однакових символів)
const normalizeLicensePlate = (input) => {
  if (!input) return '';
  const raw = String(input)
    .replace(/[\s\-_.]/g, '') // прибираємо пробіли та розділювачі
    .toUpperCase();
  const map = {
    А: 'A',
    В: 'B',
    С: 'C',
    Е: 'E',
    Н: 'H',
    І: 'I',
    К: 'K',
    М: 'M',
    О: 'O',
    Р: 'P',
    Т: 'T',
    Х: 'X',
  };
  return raw
    .split('')
    .map((ch) => map[ch] || ch)
    .join('');
};

// Отримати всі автомобілі користувача
exports.getUserVehicles = async (req, res) => {
  try {
    const userId = req.user?.id || req.params.userId;
    if (!userId) {
      return res.status(400).json({ message: 'Не вказано користувача' });
    }
    // Отримуємо автомобілі
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (vehiclesError) throw vehiclesError;

    // Для кожного автомобіля отримуємо додаткову інформацію
    const vehiclesWithDetails = await Promise.all(
      vehicles.map(async (vehicle) => {
        // Отримуємо записи на обслуговування
        const { data: appointments } = await supabase
          .from('appointments')
          .select('id, scheduled_time, status, completion_notes, service_id')
          .eq('vehicle_vin', vehicle.vin);

        // Отримуємо історію обслуговування
        const { data: serviceHistory } = await supabase
          .from('service_history')
          .select('id, service_date, description, cost, mileage')
          .eq('vehicle_vin', vehicle.vin);

        // Для кожного запису отримуємо інформацію про сервіс
        const appointmentsWithServices = await Promise.all(
          (appointments || []).map(async (appointment) => {
            if (appointment.service_id) {
              const { data: service } = await supabase
                .from('services')
                .select('name, description')
                .eq('id', appointment.service_id)
                .single();
              return { ...appointment, services: service };
            }
            return appointment;
          })
        );

        return {
          ...vehicle,
          make: vehicle.brand || vehicle.make,
          brand: vehicle.brand || vehicle.make,
          licensePlate: vehicle.license_plate,
          appointments: appointmentsWithServices,
          service_history: serviceHistory || [],
        };
      })
    );

    res.json(vehiclesWithDetails);
  } catch (err) {
    console.error('Get user vehicles error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати автомобіль за VIN
exports.getVehicleByVin = async (req, res) => {
  try {
    const { vin } = req.params;

    // Отримуємо автомобіль
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('vin', vin)
      .eq('user_id', req.user.id)
      .single();

    // Якщо не знайдено — повертаємо 404, інакше кидаємо інші помилки
    if (vehicleError) {
      if (vehicleError.code === 'PGRST116') {
        return res.status(404).json({ message: 'Автомобіль не знайдено' });
      }
      throw vehicleError;
    }

    if (!vehicle) {
      return res.status(404).json({ message: 'Автомобіль не знайдено' });
    }

    // Отримуємо записи на обслуговування
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, scheduled_time, status, completion_notes, service_id, mechanic_id')
      .eq('vehicle_vin', vin);

    // Отримуємо історію обслуговування
    const { data: serviceHistory } = await supabase
      .from('service_history')
      .select('id, service_date, description, cost, mileage')
      .eq('vehicle_vin', vin);

    // Для кожного запису отримуємо інформацію про сервіс та механіка
    const appointmentsWithDetails = await Promise.all(
      (appointments || []).map(async (appointment) => {
        let serviceData = null;
        let mechanicData = null;

        if (appointment.service_id) {
          const { data: service } = await supabase
            .from('services')
            .select('name, description')
            .eq('id', appointment.service_id)
            .single();
          serviceData = service;
        }

        if (appointment.mechanic_id) {
          const { data: mechanic } = await supabase
            .from('mechanics')
            .select('id, first_name, last_name')
            .eq('id', appointment.mechanic_id)
            .single();
          mechanicData = mechanic;
        }

        return {
          ...appointment,
          services: serviceData,
          mechanics: mechanicData,
        };
      })
    );

    const result = {
      ...vehicle,
      make: vehicle.brand || vehicle.make,
      brand: vehicle.brand || vehicle.make,
      licensePlate: vehicle.license_plate,
      appointments: appointmentsWithDetails,
      service_history: serviceHistory || [],
    };

    res.json(result);
  } catch (err) {
    console.error('Get vehicle error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Додати новий автомобіль
exports.addVehicle = async (req, res) => {
  try {
    const {
      vin,
      make,
      model,
      year,
      color,
      mileage,
      licensePlate,
      license_plate,
      brand,
      user_id, // для Telegram API
    } = req.body;

    // Перевірка чи VIN вже існує
    const { data: existingVehicle } = await supabase
      .from('vehicles')
      .select('*')
      .eq('vin', vin)
      .single();

    if (existingVehicle) {
      return res.status(400).json({ message: 'Автомобіль з таким VIN вже існує' });
    }

    // Узгодження полів: приймаємо make/brand з клієнта, зберігаємо у brand
    const brandValue = brand || make;
    const licensePlateValue = licensePlate || license_plate;
    const normalizedLicensePlate = normalizeLicensePlate(licensePlateValue);

    const { data, error } = await supabase
      .from('vehicles')
      .insert([
        {
          user_id: req.user?.id || user_id,
          vin,
          brand: brandValue,
          model,
          year,
          color,
          mileage,
          license_plate: normalizedLicensePlate || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Повертаємо з уніфікованими полями
    const result = {
      ...data,
      make: data.brand,
      licensePlate: data.license_plate,
    };

    res.status(201).json(result);
  } catch (err) {
    console.error('Add vehicle error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Оновити інформацію про автомобіль
exports.updateVehicle = async (req, res) => {
  try {
    const { vin } = req.params;
    const { make, model, year, color, mileage, brand } = req.body;

    const licensePlateValue = req.body.licensePlate || req.body.license_plate;
    const normalizedLicensePlate = licensePlateValue
      ? normalizeLicensePlate(licensePlateValue)
      : undefined;

    const { data, error } = await supabase
      .from('vehicles')
      .update({
        brand: brand ?? make,
        model,
        year,
        color,
        mileage,
        ...(licensePlateValue ? { license_plate: normalizedLicensePlate } : {}),
      })
      .eq('vin', vin)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Автомобіль не знайдено' });
    }

    const result = {
      ...data,
      make: data.brand,
      licensePlate: data.license_plate,
    };

    res.json(result);
  } catch (err) {
    console.error('Update vehicle error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Видалити автомобіль
exports.deleteVehicle = async (req, res) => {
  try {
    const { vin } = req.params;

    // Перевіряємо чи є активні записи
    const { data: activeAppointments } = await supabase
      .from('appointments')
      .select('id')
      .eq('vehicle_vin', vin)
      .in('status', ['pending', 'confirmed'])
      .limit(1);

    if (activeAppointments?.length > 0) {
      return res.status(400).json({
        message: 'Неможливо видалити автомобіль з активними записами на обслуговування',
      });
    }

    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('vin', vin)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.status(204).send();
  } catch (err) {
    console.error('Delete vehicle error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати автомобіль за номерним знаком
exports.getVehicleByLicensePlate = async (req, res) => {
  try {
    const { licensePlate } = req.params;
    const normalizedPlate = normalizeLicensePlate(licensePlate);

    // Отримуємо автомобіль за номерним знаком
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('license_plate', normalizedPlate)
      .single();

    if (vehicleError) {
      if (vehicleError.code === 'PGRST116') {
        return res.status(404).json({ message: 'Автомобіль не знайдено' });
      }
      throw vehicleError;
    }

    const result = {
      ...vehicle,
      make: vehicle.brand || vehicle.make,
      brand: vehicle.brand || vehicle.make,
      licensePlate: vehicle.license_plate,
    };

    res.json(result);
  } catch (err) {
    console.error('Get vehicle by license plate error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати автомобіль за номерним знаком для Telegram бота
exports.getVehicleByLicensePlateForBot = async (req, res) => {
  try {
    const { licensePlate } = req.params;
    const normalizedPlate = normalizeLicensePlate(licensePlate);

    // Отримуємо автомобіль за номерним знаком
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('license_plate', normalizedPlate)
      .single();

    if (vehicleError) {
      if (vehicleError.code === 'PGRST116') {
        return res.status(404).json({ message: 'Автомобіль не знайдено' });
      }
      throw vehicleError;
    }

    // Отримуємо інформацію про власника
    const { data: owner, error: ownerError } = await supabase
      .from('users')
      .select('id, name, phone')
      .eq('id', vehicle.user_id)
      .single();

    if (ownerError) throw ownerError;

    const result = {
      ...vehicle,
      make: vehicle.brand || vehicle.make,
      brand: vehicle.brand || vehicle.make,
      licensePlate: vehicle.license_plate,
      owner: owner || null,
    };

    res.json(result);
  } catch (err) {
    console.error('Get vehicle by license plate for bot error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
