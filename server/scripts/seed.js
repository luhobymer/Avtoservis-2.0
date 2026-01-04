require('dotenv').config();
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const logger = require('../middleware/logger');

async function seed() {
  try {
    // Створюємо адміністратора
    const adminPassword = await bcrypt.hash('admin123', 10);
    const { data: admin, error: adminError } = await supabase
      .from('users')
      .insert([
        {
          email: 'admin@avtoservis.com',
          password: adminPassword,
          role: 'admin',
        },
      ])
      .select()
      .single();

    if (adminError) {
      throw adminError;
    }

    logger.info('Адміністратор створений:', admin);

    // Створюємо тестову СТО
    const { data: station, error: stationError } = await supabase
      .from('service_stations')
      .insert([
        {
          name: 'Avtoservis #1',
          address: 'вул. Механіків, 1, Київ',
          phone: '+380441234567',
          email: 'service1@avtoservis.com',
          working_hours: {
            monday: { open: '09:00', close: '18:00' },
            tuesday: { open: '09:00', close: '18:00' },
            wednesday: { open: '09:00', close: '18:00' },
            thursday: { open: '09:00', close: '18:00' },
            friday: { open: '09:00', close: '18:00' },
            saturday: { open: '10:00', close: '15:00' },
            sunday: null,
          },
          description: 'Повний спектр послуг з ремонту та обслуговування автомобілів',
        },
      ])
      .select()
      .single();

    if (stationError) {
      throw stationError;
    }

    logger.info('СТО створена:', station);

    // Створюємо базові послуги
    const services = [
      {
        name: 'Заміна масла',
        description: 'Заміна моторного масла та масляного фільтра',
        price: 800,
        duration: 30,
        station_id: station.id,
      },
      {
        name: 'Діагностика',
        description: "Комп'ютерна діагностика автомобіля",
        price: 500,
        duration: 60,
        station_id: station.id,
      },
      {
        name: 'Заміна гальмівних колодок',
        description: 'Заміна передніх або задніх гальмівних колодок',
        price: 1000,
        duration: 90,
        station_id: station.id,
      },
    ];

    const { data: createdServices, error: servicesError } = await supabase
      .from('services')
      .insert(services)
      .select();

    if (servicesError) {
      throw servicesError;
    }

    logger.info('Послуги створені:', createdServices);

    // Створюємо тестових механіків
    const mechanics = [
      {
        first_name: 'Іван',
        last_name: 'Петренко',
        phone: '+380501234567',
        email: 'petrenko@avtoservis.com',
        specialization: 'Двигуни',
        station_id: station.id,
      },
      {
        first_name: 'Михайло',
        last_name: 'Коваленко',
        phone: '+380502345678',
        email: 'kovalenko@avtoservis.com',
        specialization: 'Ходова частина',
        station_id: station.id,
      },
    ];

    const { data: createdMechanics, error: mechanicsError } = await supabase
      .from('mechanics')
      .insert(mechanics)
      .select();

    if (mechanicsError) {
      throw mechanicsError;
    }

    logger.info('Механіки створені:', createdMechanics);

    logger.info('Сідування даних успішно завершено');
  } catch (error) {
    logger.error('Помилка сідування даних:', error);
    process.exit(1);
  }
}

seed();
