require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/d1');
const logger = require('../middleware/logger');

async function seed() {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    const nowDate = new Date();

    const getColumns = (tableName) =>
      new Set(
        db
          .prepare(`PRAGMA table_info(${tableName})`)
          .all()
          .map((col) => col.name)
      );

    const insertRow = (tableName, row) => {
      const columns = getColumns(tableName);
      const entries = Object.entries(row).filter(
        ([key, value]) => columns.has(key) && value !== undefined
      );
      if (entries.length === 0) {
        throw new Error(`No matching columns for insert into ${tableName}`);
      }
      const columnNames = entries.map(([key]) => key);
      const placeholders = entries.map(() => '?').join(', ');
      const values = entries.map(([, value]) => value);
      db.prepare(
        `INSERT INTO ${tableName} (${columnNames.join(', ')}) VALUES (${placeholders})`
      ).run(...values);
    };

    const getStationColumn = (tableName) => {
      const columns = getColumns(tableName);
      if (columns.has('service_station_id')) return 'service_station_id';
      if (columns.has('station_id')) return 'station_id';
      return null;
    };

    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminEmail = 'admin@avtoservis.com';
    let admin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
    if (!admin) {
      const adminId = crypto.randomUUID();
      insertRow('users', {
        id: adminId,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        created_at: now,
        updated_at: now,
      });
      admin = db.prepare('SELECT * FROM users WHERE id = ?').get(adminId);
    } else {
      db.prepare('UPDATE users SET password = ?, role = ?, updated_at = ? WHERE id = ?').run(
        adminPassword,
        'admin',
        now,
        admin.id
      );
      admin = db.prepare('SELECT * FROM users WHERE id = ?').get(admin.id);
    }
    logger.info('Адміністратор створений:', admin);

    const stationId = crypto.randomUUID();
    const workingHours = JSON.stringify({
      monday: { open: '09:00', close: '18:00' },
      tuesday: { open: '09:00', close: '18:00' },
      wednesday: { open: '09:00', close: '18:00' },
      thursday: { open: '09:00', close: '18:00' },
      friday: { open: '09:00', close: '18:00' },
      saturday: { open: '10:00', close: '15:00' },
      sunday: null,
    });
    insertRow('service_stations', {
      id: stationId,
      name: 'Avtoservis #1',
      address: 'вул. Механіків, 1, Київ',
      phone: '+380441234567',
      email: 'service1@avtoservis.com',
      working_hours: workingHours,
      description: 'Повний спектр послуг з ремонту та обслуговування автомобілів',
      created_at: now,
      updated_at: now,
    });
    const station = db.prepare('SELECT * FROM service_stations WHERE id = ?').get(stationId);
    logger.info('СТО створена:', station);

    const serviceStationColumn = getStationColumn('services');
    const services = [
      {
        name: 'Заміна масла',
        description: 'Заміна моторного масла та масляного фільтра',
        price: 800,
        duration: 30,
      },
      {
        name: 'Діагностика',
        description: "Комп'ютерна діагностика автомобіля",
        price: 500,
        duration: 60,
      },
      {
        name: 'Заміна гальмівних колодок',
        description: 'Заміна передніх або задніх гальмівних колодок',
        price: 1000,
        duration: 90,
      },
    ];

    const createdServices = services.map((service) => {
      const serviceId = crypto.randomUUID();
      const row = {
        id: serviceId,
        ...service,
        created_at: now,
        updated_at: now,
      };
      if (serviceStationColumn) {
        row[serviceStationColumn] = stationId;
      }
      insertRow('services', row);
      return db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
    });

    logger.info('Послуги створені:', createdServices);

    const mechanicStationColumn = getStationColumn('mechanics');
    const mechanics = [
      {
        first_name: 'Іван',
        last_name: 'Петренко',
        phone: '+380501234567',
        email: 'petrenko@avtoservis.com',
        specialization: 'Двигуни',
      },
      {
        first_name: 'Михайло',
        last_name: 'Коваленко',
        phone: '+380502345678',
        email: 'kovalenko@avtoservis.com',
        specialization: 'Ходова частина',
      },
    ];

    const createdMechanics = mechanics.map((mechanic) => {
      const mechanicId = crypto.randomUUID();
      const row = {
        id: mechanicId,
        ...mechanic,
        specialization_id: null,
        experience_years: null,
        created_at: now,
        updated_at: now,
      };
      if (mechanicStationColumn) {
        row[mechanicStationColumn] = stationId;
      }
      insertRow('mechanics', row);
      return db.prepare('SELECT * FROM mechanics WHERE id = ?').get(mechanicId);
    });

    logger.info('Механіки створені:', createdMechanics);
    const demoEmail = 'luhobymer@gmail.com';
    const demoPassword = await bcrypt.hash('123456', 10);
    let demoUser = db.prepare('SELECT * FROM users WHERE email = ?').get(demoEmail);
    if (!demoUser) {
      const demoUserId = crypto.randomUUID();
      insertRow('users', {
        id: demoUserId,
        email: demoEmail,
        password: demoPassword,
        role: 'client',
        name: 'Демо Користувач',
        phone: '+380670001122',
        created_at: now,
        updated_at: now,
      });
      demoUser = db.prepare('SELECT * FROM users WHERE id = ?').get(demoUserId);
    } else {
      db.prepare(
        'UPDATE users SET password = ?, role = ?, name = ?, phone = ?, updated_at = ? WHERE id = ?'
      ).run(demoPassword, 'client', 'Демо Користувач', '+380670001122', now, demoUser.id);
      demoUser = db.prepare('SELECT * FROM users WHERE id = ?').get(demoUser.id);
    }

    const existingVehicles = db
      .prepare('SELECT COUNT(1) as count FROM vehicles WHERE user_id = ?')
      .get(demoUser.id);
    const shouldCreateVehicles = !existingVehicles || Number(existingVehicles.count) === 0;
    const demoVehicles = [];
    if (shouldCreateVehicles) {
      const vehicleRows = [
        {
          id: crypto.randomUUID(),
          user_id: demoUser.id,
          vin: 'WBAFR71070L123456',
          make: 'BMW',
          model: 'X5',
          year: 2020,
          color: 'Чорний',
          license_plate: 'AA1234BB',
          mileage: 85000,
          created_at: now,
          updated_at: now,
        },
        {
          id: crypto.randomUUID(),
          user_id: demoUser.id,
          vin: 'WVWZZZ1KZ6W987654',
          make: 'Volkswagen',
          model: 'Passat',
          year: 2018,
          color: 'Сірий',
          license_plate: 'BC5678CE',
          mileage: 120000,
          created_at: now,
          updated_at: now,
        },
      ];
      vehicleRows.forEach((row) => insertRow('vehicles', row));
      demoVehicles.push(
        ...db
          .prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at DESC')
          .all(demoUser.id)
      );
    } else {
      demoVehicles.push(
        ...db
          .prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at DESC')
          .all(demoUser.id)
      );
    }

    const existingRecords = db
      .prepare('SELECT COUNT(1) as count FROM service_records WHERE user_id = ?')
      .get(demoUser.id);
    if (!existingRecords || Number(existingRecords.count) === 0) {
      const pastDate = new Date(nowDate.getTime() - 1000 * 60 * 60 * 24 * 30).toISOString();
      const pastDate2 = new Date(nowDate.getTime() - 1000 * 60 * 60 * 24 * 90).toISOString();
      const demoVehicleId = demoVehicles[0]?.id;
      if (demoVehicleId) {
        insertRow('service_records', {
          id: crypto.randomUUID(),
          vehicle_id: demoVehicleId,
          user_id: demoUser.id,
          service_type: 'Заміна масла',
          service_date: pastDate,
          mileage: 82000,
          description: 'Заміна масла та масляного фільтра',
          performed_by: 'Іван Петренко',
          cost: 950,
          parts: JSON.stringify([{ name: 'Фільтр масляний', qty: 1 }]),
          created_at: now,
          updated_at: now,
        });
        insertRow('service_records', {
          id: crypto.randomUUID(),
          vehicle_id: demoVehicleId,
          user_id: demoUser.id,
          service_type: 'Діагностика',
          service_date: pastDate2,
          mileage: 78000,
          description: "Комп'ютерна діагностика системи",
          performed_by: 'Михайло Коваленко',
          cost: 500,
          parts: JSON.stringify([]),
          created_at: now,
          updated_at: now,
        });
      }
    }

    const existingAppointments = db
      .prepare('SELECT COUNT(1) as count FROM appointments WHERE user_id = ?')
      .get(demoUser.id);
    if (!existingAppointments || Number(existingAppointments.count) === 0) {
      const upcomingDate = new Date(nowDate.getTime() + 1000 * 60 * 60 * 24 * 3).toISOString();
      const serviceId = createdServices?.[0]?.id || null;
      const mechanicId = createdMechanics?.[0]?.id || null;
      const demoVehicle = demoVehicles[0];
      insertRow('appointments', {
        id: crypto.randomUUID(),
        user_id: demoUser.id,
        vehicle_id: demoVehicle?.id || null,
        vehicle_vin: demoVehicle?.vin || null,
        service_type: 'Планове ТО',
        service_id: serviceId,
        mechanic_id: mechanicId,
        scheduled_time: upcomingDate,
        status: 'scheduled',
        appointment_date: upcomingDate,
        notes: 'Планове обслуговування',
        car_info: demoVehicle
          ? `${demoVehicle.make} ${demoVehicle.model} ${demoVehicle.year}`
          : null,
        created_at: now,
        updated_at: now,
      });
    }

    const existingNotifications = db
      .prepare('SELECT COUNT(1) as count FROM notifications WHERE user_id = ?')
      .get(demoUser.id);
    if (!existingNotifications || Number(existingNotifications.count) === 0) {
      insertRow('notifications', {
        id: crypto.randomUUID(),
        user_id: demoUser.id,
        title: 'Нагадування про запис',
        message: 'У вас заплановане обслуговування через 3 дні.',
        type: 'appointment',
        is_read: 0,
        status: 'pending',
        created_at: now,
        scheduled_for: new Date(nowDate.getTime() + 1000 * 60 * 60).toISOString(),
      });
    }

    const existingReminders = db
      .prepare('SELECT COUNT(1) as count FROM reminders WHERE user_id = ?')
      .get(demoUser.id);
    if (!existingReminders || Number(existingReminders.count) === 0) {
      const demoVehicle = demoVehicles[0];
      insertRow('reminders', {
        id: crypto.randomUUID(),
        user_id: demoUser.id,
        vehicle_vin: demoVehicle?.vin || null,
        title: 'Перевірка масла',
        description: 'Перевірити рівень масла через 2000 км',
        reminder_type: 'mileage',
        due_date: new Date(nowDate.getTime() + 1000 * 60 * 60 * 24 * 45).toISOString(),
        due_mileage: 2000,
        is_completed: 0,
        is_recurring: 0,
        recurrence_interval: null,
        priority: 'medium',
        notification_sent: 0,
        created_at: now,
        updated_at: now,
      });
    }

    logger.info('Демо-дані для користувача створені:', {
      email: demoEmail,
      userId: demoUser.id,
    });
    logger.info('Сідування даних успішно завершено');
  } catch (error) {
    logger.error('Помилка сідування даних:', error);
    process.exit(1);
  }
}

seed();
