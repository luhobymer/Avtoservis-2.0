const { getDb } = require('../db/d1');

exports.listForUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await getDb();

    // Join with vehicles to ensure we only get parts for vehicles owned by user
    const parts = await db.prepare(`
      SELECT vp.*, v.make, v.model, v.year 
      FROM vehicle_parts vp
      JOIN vehicles v ON v.vin = vp.vehicle_vin
      WHERE v.user_id = ?
      ORDER BY vp.installed_date DESC
    `).all(userId);

    res.json(parts || []);
  } catch (err) {
    console.error('List vehicle parts error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

exports.listForVehicle = async (req, res) => {
  try {
    const { vin } = req.params;
    const userId = req.user.id;
    const db = await getDb();

    // Verify ownership or permission (e.g. master)
    const vehicle = await db.prepare('SELECT user_id FROM vehicles WHERE vin = ?').get(vin);
    
    if (!vehicle) {
        return res.status(404).json({ message: 'Авто не знайдено' });
    }

    // Allow owner or master/admin
    if (vehicle.user_id !== userId && !['master', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Доступ заборонено' });
    }

    const parts = await db.prepare(`
      SELECT * FROM vehicle_parts
      WHERE vehicle_vin = ?
      ORDER BY installed_date DESC
    `).all(vin);

    res.json(parts || []);
  } catch (err) {
    console.error('List vehicle parts error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
