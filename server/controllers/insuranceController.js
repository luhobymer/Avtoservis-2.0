const crypto = require('crypto');
const { getDb } = require('../db/d1');

const normalizeRole = (role) => String(role || '').toLowerCase();

const isPrivileged = (role) => ['master', 'admin'].includes(normalizeRole(role));

const resolveVehicleOwner = async (db, vin) => {
  if (!vin) return null;
  return db.prepare('SELECT vin, user_id FROM vehicles WHERE vin = ?').get(vin);
};

exports.listInsurances = async (req, res) => {
  try {
    const db = await getDb();
    const role = normalizeRole(req.user?.role);
    const filters = [];
    const params = [];

    const requestedUserId = req.query?.user_id ? String(req.query.user_id).trim() : '';
    const requestedVin = req.query?.vehicle_vin ? String(req.query.vehicle_vin).trim() : '';

    if (requestedVin) {
      filters.push('vehicle_vin = ?');
      params.push(requestedVin);
    }

    if (isPrivileged(role) && requestedUserId) {
      filters.push('user_id = ?');
      params.push(requestedUserId);
    } else {
      filters.push('user_id = ?');
      params.push(req.user.id);
    }

    const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = await db
      .prepare(
        `SELECT * FROM insurances
         ${whereSql}
         ORDER BY start_date DESC`
      )
      .all(...params);

    res.json(rows || []);
  } catch (err) {
    console.error('List insurances error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

exports.createInsurance = async (req, res) => {
  try {
    const { vehicle_vin, policy_number, insurance_company, start_date, end_date } = req.body || {};
    if (!vehicle_vin) {
      return res.status(400).json({ message: 'VIN is required' });
    }

    const db = await getDb();
    const vehicle = await resolveVehicleOwner(db, vehicle_vin);
    if (!vehicle) {
      return res.status(404).json({ message: 'Авто не знайдено' });
    }

    if (vehicle.user_id !== req.user.id && !isPrivileged(req.user?.role)) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO insurances (
          id, vehicle_vin, user_id, policy_number, insurance_company, start_date, end_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        vehicle_vin,
        vehicle.user_id,
        policy_number || null,
        insurance_company || null,
        start_date || null,
        end_date || null
      );

    res.status(201).json({ id, message: 'Insurance created' });
  } catch (err) {
    console.error('Create insurance error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

exports.updateInsurance = async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicle_vin, policy_number, insurance_company, start_date, end_date } = req.body || {};

    const db = await getDb();
    const insurance = await db.prepare('SELECT * FROM insurances WHERE id = ?').get(id);
    if (!insurance) {
      return res.status(404).json({ message: 'Запис не знайдено' });
    }

    if (insurance.user_id !== req.user.id && !isPrivileged(req.user?.role)) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    const updates = [];
    const params = [];
    let nextUserId = insurance.user_id;

    if (vehicle_vin !== undefined) {
      const vehicle = await resolveVehicleOwner(db, vehicle_vin);
      if (!vehicle) {
        return res.status(404).json({ message: 'Авто не знайдено' });
      }
      if (vehicle.user_id !== req.user.id && !isPrivileged(req.user?.role)) {
        return res.status(403).json({ message: 'Доступ заборонено' });
      }
      updates.push('vehicle_vin = ?');
      params.push(vehicle_vin);
      updates.push('user_id = ?');
      params.push(vehicle.user_id);
      nextUserId = vehicle.user_id;
    }

    if (policy_number !== undefined) {
      updates.push('policy_number = ?');
      params.push(policy_number || null);
    }

    if (insurance_company !== undefined) {
      updates.push('insurance_company = ?');
      params.push(insurance_company || null);
    }

    if (start_date !== undefined) {
      updates.push('start_date = ?');
      params.push(start_date || null);
    }

    if (end_date !== undefined) {
      updates.push('end_date = ?');
      params.push(end_date || null);
    }

    if (updates.length === 0) {
      return res.json({ message: 'No changes applied' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.prepare(`UPDATE insurances SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    res.json({ id, user_id: nextUserId, message: 'Insurance updated' });
  } catch (err) {
    console.error('Update insurance error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

exports.deleteInsurance = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const insurance = await db.prepare('SELECT * FROM insurances WHERE id = ?').get(id);
    if (!insurance) {
      return res.status(404).json({ message: 'Запис не знайдено' });
    }

    if (insurance.user_id !== req.user.id && !isPrivileged(req.user?.role)) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    await db.prepare('DELETE FROM insurances WHERE id = ?').run(id);
    res.json({ message: 'Insurance deleted' });
  } catch (err) {
    console.error('Delete insurance error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
