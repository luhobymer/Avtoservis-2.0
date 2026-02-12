const { getDb } = require('../db/d1');
const crypto = require('crypto');
const defaultMaintenanceTasks = require('../utils/defaultMaintenance');

// Get maintenance schedule for a vehicle
exports.getSchedule = async (req, res) => {
  try {
    const { vin } = req.params;
    const userId = req.user.id;
    const db = await getDb();

    // Verify ownership or permission
    const vehicle = await db
      .prepare('SELECT user_id, mileage FROM vehicles WHERE vin = ?')
      .get(vin);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (vehicle.user_id !== userId && !['master', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const schedules = await db
      .prepare(
        `
      SELECT * FROM maintenance_schedules
      WHERE vehicle_vin = ?
      ORDER BY created_at DESC
    `
      )
      .all(vin);

    // Calculate status for each item
    const currentMileage = vehicle.mileage || 0;
    const currentDate = new Date();

    const schedulesWithStatus = schedules.map((item) => {
      let nextServiceDate = null;
      let nextServiceMileage = null;
      let dueByMileage = false;
      let dueByDate = false;
      let remainingKm = null;
      let remainingDays = null;

      if (item.last_service_mileage && item.interval_km) {
        nextServiceMileage = item.last_service_mileage + item.interval_km;
        remainingKm = nextServiceMileage - currentMileage;
        if (remainingKm <= 0) dueByMileage = true;
      }

      if (item.last_service_date && item.interval_months) {
        const lastDate = new Date(item.last_service_date);
        nextServiceDate = new Date(lastDate);
        nextServiceDate.setMonth(lastDate.getMonth() + item.interval_months);

        const diffTime = nextServiceDate - currentDate;
        remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (remainingDays <= 0) dueByDate = true;
      }

      let status = 'ok';
      if (dueByMileage || dueByDate) {
        status = 'overdue';
      } else if (
        (remainingKm !== null && remainingKm < 1000) ||
        (remainingDays !== null && remainingDays < 30)
      ) {
        status = 'upcoming';
      }

      return {
        ...item,
        next_service_date: nextServiceDate,
        next_service_mileage: nextServiceMileage,
        remaining_km: remainingKm,
        remaining_days: remainingDays,
        status,
      };
    });

    res.json(schedulesWithStatus);
  } catch (err) {
    console.error('Get maintenance schedule error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add item to schedule
exports.addItem = async (req, res) => {
  try {
    const {
      vehicle_vin,
      service_item,
      interval_km,
      interval_months,
      last_service_date,
      last_service_mileage,
    } = req.body;

    const userId = req.user.id;
    const db = await getDb();

    // Verify ownership
    const vehicle = await db.prepare('SELECT user_id FROM vehicles WHERE vin = ?').get(vehicle_vin);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    if (vehicle.user_id !== userId && !['master', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const id = crypto.randomUUID();
    await db
      .prepare(
        `
      INSERT INTO maintenance_schedules (
        id, vehicle_vin, service_item, interval_km, interval_months, 
        last_service_date, last_service_mileage
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        vehicle_vin,
        service_item,
        interval_km || null,
        interval_months || null,
        last_service_date || null,
        last_service_mileage || null
      );

    res.status(201).json({ id, message: 'Maintenance item added' });
  } catch (err) {
    console.error('Add maintenance item error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update item
exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { service_item, interval_km, interval_months, last_service_date, last_service_mileage } =
      req.body;

    const userId = req.user.id;
    const db = await getDb();

    // Verify ownership via join
    const item = await db
      .prepare(
        `
      SELECT ms.*, v.user_id 
      FROM maintenance_schedules ms
      JOIN vehicles v ON v.vin = ms.vehicle_vin
      WHERE ms.id = ?
    `
      )
      .get(id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.user_id !== userId && !['master', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const payload = [];
    const params = [];

    if (service_item !== undefined) {
      payload.push('service_item = ?');
      params.push(service_item);
    }
    if (interval_km !== undefined) {
      payload.push('interval_km = ?');
      params.push(interval_km);
    }
    if (interval_months !== undefined) {
      payload.push('interval_months = ?');
      params.push(interval_months);
    }
    if (last_service_date !== undefined) {
      payload.push('last_service_date = ?');
      params.push(last_service_date);
    }
    if (last_service_mileage !== undefined) {
      payload.push('last_service_mileage = ?');
      params.push(last_service_mileage);
    }

    payload.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db
      .prepare(`UPDATE maintenance_schedules SET ${payload.join(', ')} WHERE id = ?`)
      .run(...params);

    res.json({ message: 'Maintenance item updated' });
  } catch (err) {
    console.error('Update maintenance item error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete item
exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const db = await getDb();

    const item = await db
      .prepare(
        `
      SELECT ms.*, v.user_id 
      FROM maintenance_schedules ms
      JOIN vehicles v ON v.vin = ms.vehicle_vin
      WHERE ms.id = ?
    `
      )
      .get(id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.user_id !== userId && !['master', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await db.prepare('DELETE FROM maintenance_schedules WHERE id = ?').run(id);

    res.json({ message: 'Maintenance item deleted' });
  } catch (err) {
    console.error('Delete maintenance item error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Initialize default schedule for existing vehicle
exports.initDefaultSchedule = async (req, res) => {
  try {
    const { vin } = req.params;
    const userId = req.user.id;
    const db = await getDb();

    // Verify ownership
    const vehicle = await db.prepare('SELECT user_id FROM vehicles WHERE vin = ?').get(vin);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    if (vehicle.user_id !== userId && !['master', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if schedule already exists to avoid duplicates
    const existing = await db
      .prepare('SELECT COUNT(*) as count FROM maintenance_schedules WHERE vehicle_vin = ?')
      .get(vin);
    if (existing.count > 0) {
      return res.status(400).json({ message: 'Schedule already exists for this vehicle' });
    }

    const now = new Date().toISOString();
    const maintenanceInsert = db.prepare(`
      INSERT INTO maintenance_schedules (
        id, vehicle_vin, service_item, interval_km, interval_months, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const task of defaultMaintenanceTasks) {
      await maintenanceInsert.run(
        crypto.randomUUID(),
        vin,
        task.service_item,
        task.interval_km,
        task.interval_months,
        now,
        now
      );
    }

    res.status(201).json({ message: 'Default schedule initialized' });
  } catch (err) {
    console.error('Init default schedule error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
