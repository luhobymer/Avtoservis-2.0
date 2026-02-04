const crypto = require('crypto');
const { getDb, getExistingColumn } = require('../db/d1');

// Отримати всі послуги
exports.getAllServices = async (req, res) => {
  try {
    const db = await getDb();
    const stationColumn = await getExistingColumn('services', ['service_station_id', 'station_id']);
    const services = await db.prepare('SELECT * FROM services').all();

    // Map database columns to API response
    const mappedServices = services.map((service) => ({
      ...service,
      price: service.base_price || service.price,
      duration: service.duration_minutes || service.duration,
      category_id: service.category || service.category_id,
      price_text: service.price_text ?? null,
      duration_text: service.duration_text ?? null,
    }));

    const servicesWithStations = await Promise.all(
      mappedServices.map(async (service) => {
        const stationId = service[stationColumn];
        const station = stationId
          ? await db.prepare('SELECT id, name FROM service_stations WHERE id = ?').get(stationId)
          : null;
        return { ...service, service_stations: station };
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
    const db = await getDb();
    const stationColumn = await getExistingColumn('services', ['service_station_id', 'station_id']);
    const service = await db.prepare('SELECT * FROM services WHERE id = ?').get(id);

    if (!service) {
      return res.status(404).json({ message: 'Послугу не знайдено' });
    }

    // Map columns
    service.price = service.base_price || service.price;
    service.duration = service.duration_minutes || service.duration;
    service.category_id = service.category || service.category_id;
    service.price_text = service.price_text ?? null;
    service.duration_text = service.duration_text ?? null;

    const stationId = service[stationColumn];
    const stationData = stationId
      ? await db.prepare('SELECT id, name FROM service_stations WHERE id = ?').get(stationId)
      : null;
    const categoryData = service.category_id
      ? await db
          .prepare('SELECT id, name FROM service_categories WHERE id = ?')
          .get(service.category_id)
      : null;

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
    const {
      name,
      description,
      price,
      price_text,
      duration,
      duration_text,
      service_station_id,
      category_id,
      is_active,
    } = req.body;

    const db = await getDb();
    const stationColumn = await getExistingColumn('services', ['service_station_id', 'station_id']);
    const serviceColumns = await db.prepare('PRAGMA table_info(services)').all();
    const serviceColumnNames = new Set((serviceColumns || []).map((column) => column.name));
    const serviceId = crypto.randomUUID();

    const insertColumns = ['id', 'name', 'description'];
    const insertValues = [serviceId, name, description];

    if (serviceColumnNames.has('base_price')) {
      insertColumns.push('base_price');
      insertValues.push(price);
    } else {
      insertColumns.push('price');
      insertValues.push(price);
    }

    if (serviceColumnNames.has('price_text')) {
      insertColumns.push('price_text');
      insertValues.push(price_text ?? null);
    }

    if (serviceColumnNames.has('duration_minutes')) {
      insertColumns.push('duration_minutes');
      insertValues.push(duration);
    } else {
      insertColumns.push('duration');
      insertValues.push(duration);
    }

    if (serviceColumnNames.has('duration_text')) {
      insertColumns.push('duration_text');
      insertValues.push(duration_text ?? null);
    }

    if (stationColumn) {
      insertColumns.push(stationColumn);
      insertValues.push(service_station_id);
    }

    if (serviceColumnNames.has('category')) {
      insertColumns.push('category');
      insertValues.push(category_id);
    } else {
      insertColumns.push('category_id');
      insertValues.push(category_id);
    }

    if (serviceColumnNames.has('is_active')) {
      insertColumns.push('is_active');
      insertValues.push(is_active === undefined ? 1 : is_active ? 1 : 0);
    }

    const placeholders = insertColumns.map(() => '?').join(', ');
    await db
      .prepare(`INSERT INTO services (${insertColumns.join(', ')}) VALUES (${placeholders})`)
      .run(...insertValues);

    const created = await db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
    res.status(201).json(created);
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Оновити послугу
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      price_text,
      duration,
      duration_text,
      service_station_id,
      category_id,
      is_active,
    } = req.body;

    const db = await getDb();
    const stationColumn = await getExistingColumn('services', ['service_station_id', 'station_id']);
    const serviceColumns = await db.prepare('PRAGMA table_info(services)').all();
    const serviceColumnNames = new Set((serviceColumns || []).map((column) => column.name));

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    if (price !== undefined) {
      if (serviceColumnNames.has('base_price')) updateData.base_price = price;
      else updateData.price = price;
    }

    if (serviceColumnNames.has('price_text') && price_text !== undefined) {
      updateData.price_text = price_text;
    }

    if (duration !== undefined) {
      if (serviceColumnNames.has('duration_minutes')) updateData.duration_minutes = duration;
      else updateData.duration = duration;
    }

    if (serviceColumnNames.has('duration_text') && duration_text !== undefined) {
      updateData.duration_text = duration_text;
    }

    if (serviceColumnNames.has('is_active') && is_active !== undefined) {
      updateData.is_active = is_active ? 1 : 0;
    }
    if (service_station_id !== undefined && stationColumn)
      updateData[stationColumn] = service_station_id;

    if (category_id !== undefined) {
      if (serviceColumnNames.has('category')) updateData.category = category_id;
      else updateData.category_id = category_id;
    }

    const fields = Object.keys(updateData);
    if (fields.length > 0) {
      const setClause = fields.map((field) => `${field} = ?`).join(', ');
      const values = fields.map((field) => updateData[field]);
      const updateResult = await db
        .prepare(`UPDATE services SET ${setClause} WHERE id = ?`)
        .run(...values, id);

      if (updateResult.changes === 0) {
        return res.status(404).json({ message: 'Послугу не знайдено' });
      }
    }

    const updated = await db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    if (!updated) {
      return res.status(404).json({ message: 'Послугу не знайдено' });
    }

    res.json(updated);
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Видалити послугу
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    await db.prepare('DELETE FROM services WHERE id = ?').run(id);

    res.status(204).send();
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
