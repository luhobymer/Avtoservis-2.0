const crypto = require('crypto');
const { getDb } = require('../db/d1');

const isPrivileged = (user) => {
  const role = String(user?.role || '').toLowerCase();
  return role === 'master' || role === 'mechanic';
};

const normalizeIds = (value) => {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(list.map((v) => (v == null ? '' : String(v).trim())).filter(Boolean))
  );
};

exports.attachServicedVehicles = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const vehicleIds = normalizeIds(req.body?.vehicle_ids || req.body?.vehicleIds);
    if (vehicleIds.length === 0) {
      return res.status(400).json({ message: 'Не вказано vehicle_ids' });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const mechanicId = String(req.user.id);

    const attached = [];

    for (const vid of vehicleIds) {
      const vehicle = await db.prepare('SELECT id, user_id FROM vehicles WHERE id = ?').get(vid);
      if (!vehicle) {
        return res.status(404).json({ message: 'Автомобіль не знайдено', vehicle_id: vid });
      }
      const clientId = vehicle.user_id ? String(vehicle.user_id) : null;
      if (!clientId) {
        return res.status(400).json({ message: 'Некоректний власник авто', vehicle_id: vid });
      }

      try {
        await db
          .prepare(
            `INSERT INTO mechanic_serviced_vehicles
              (id, mechanic_id, vehicle_id, client_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(mechanic_id, vehicle_id) DO UPDATE SET
               updated_at = excluded.updated_at`
          )
          .run(crypto.randomUUID(), mechanicId, vid, clientId, now, now);
      } catch (err) {
        const existing = await db
          .prepare(
            'SELECT id FROM mechanic_serviced_vehicles WHERE mechanic_id = ? AND vehicle_id = ?'
          )
          .get(mechanicId, vid);
        if (existing?.id) {
          await db
            .prepare('UPDATE mechanic_serviced_vehicles SET updated_at = ? WHERE id = ?')
            .run(now, existing.id);
        } else {
          await db
            .prepare(
              'INSERT INTO mechanic_serviced_vehicles (id, mechanic_id, vehicle_id, client_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
            )
            .run(crypto.randomUUID(), mechanicId, vid, clientId, now, now);
        }
      }

      attached.push({ vehicle_id: vid, client_id: clientId });
    }

    return res.status(201).json({ attached });
  } catch (err) {
    return res.status(500).json({ message: 'Помилка сервера', details: err.message });
  }
};

