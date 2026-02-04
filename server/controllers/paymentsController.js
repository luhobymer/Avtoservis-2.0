const { getDb } = require('../db/d1');

exports.listPayments = async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.prepare('SELECT * FROM payments ORDER BY created_at DESC').all();
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

