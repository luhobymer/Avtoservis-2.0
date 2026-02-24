const crypto = require('crypto');
const { getDb, getExistingColumn } = require('../db/d1');

// Запросити механіка (клієнт -> майстер)
exports.inviteMechanic = async (req, res) => {
  try {
    const { mechanic_id } = req.body;
    const client_id = req.user.id;

    if (!mechanic_id) {
      return res.status(400).json({ message: 'Mechanic ID is required' });
    }

    const db = await getDb();

    // Перевірка чи існує такий користувач і чи він майстер
    const mechanic = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(mechanic_id);
    if (!mechanic || mechanic.role !== 'master') {
      return res.status(404).json({ message: 'Master not found' });
    }

    // Перевірка чи вже є зв'язок
    const existing = await db
      .prepare('SELECT id, status FROM client_mechanics WHERE client_id = ? AND mechanic_id = ?')
      .get(client_id, mechanic_id);

    if (existing) {
      if (existing.status === 'pending') {
        return res.status(400).json({ message: 'Invitation already sent' });
      }
      if (existing.status === 'accepted') {
        return res.status(400).json({ message: 'Already connected' });
      }
      // Якщо rejected, можна дозволити надіслати знову (оновити статус)
      await db
        .prepare(
          "UPDATE client_mechanics SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
        .run(existing.id);
      return res.json({ message: 'Invitation sent' });
    }

    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO client_mechanics (id, client_id, mechanic_id, status) VALUES (?, ?, ?, 'pending')"
      )
      .run(id, client_id, mechanic_id);

    res.status(201).json({ message: 'Invitation sent' });
  } catch (err) {
    console.error('Invite mechanic error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Отримати список механіків клієнта
exports.getClientMechanics = async (req, res) => {
  try {
    const client_id = req.user.id;
    const db = await getDb();

    const rows = await db
      .prepare(
        `
      SELECT cm.*, u.name, u.email, u.phone, u.city, u.avatar_url 
      FROM client_mechanics cm
      JOIN users u ON u.id = cm.mechanic_id
      WHERE cm.client_id = ?
    `
      )
      .all(client_id);

    res.json(rows || []);
  } catch (err) {
    console.error('Get client mechanics error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Отримати список клієнтів механіка (запити та активні)
exports.getMechanicClients = async (req, res) => {
  try {
    const mechanic_id = req.user.id;
    const db = await getDb();

    const rows = await db
      .prepare(
        `
      SELECT cm.*, u.name, u.email, u.phone, u.city, u.avatar_url
      FROM client_mechanics cm
      JOIN users u ON u.id = cm.client_id
      WHERE cm.mechanic_id = ?
    `
      )
      .all(mechanic_id);

    res.json(rows || []);
  } catch (err) {
    console.error('Get mechanic clients error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Оновити статус запиту (прийняти/відхилити)
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // accepted, rejected
    const mechanic_id = req.user.id;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const db = await getDb();

    // Перевіряємо, чи цей запит адресований цьому механіку
    const result = await db
      .prepare(
        'UPDATE client_mechanics SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND mechanic_id = ?'
      )
      .run(status, id, mechanic_id);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Request not found or access denied' });
    }

    res.json({ message: `Request ${status}` });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addClientForMechanic = async (req, res) => {
  try {
    const { client_id } = req.body;
    const mechanic_id = req.user.id;

    if (!client_id) {
      return res.status(400).json({ message: 'Client ID is required' });
    }

    const db = await getDb();
    const mechanic = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(mechanic_id);
    if (!mechanic || mechanic.role !== 'master') {
      return res.status(403).json({ message: 'Access denied. Master privileges required.' });
    }
    const client = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(client_id);
    if (!client || client.role !== 'client') {
      return res.status(404).json({ message: 'Client not found' });
    }

    const existing = await db
      .prepare('SELECT id, status FROM client_mechanics WHERE client_id = ? AND mechanic_id = ?')
      .get(client_id, mechanic_id);

    if (existing) {
      if (existing.status !== 'accepted') {
        await db
          .prepare(
            "UPDATE client_mechanics SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          )
          .run(existing.id);
      }
      // Створюємо сповіщення обом сторонам
      try {
        const readCol = await getExistingColumn('notifications', ['is_read', 'read']);
        const nowIso = new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO notifications (id, user_id, title, message, type, status, scheduled_for, data, ${readCol}, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            crypto.randomUUID(),
            client_id,
            'Додано механіка',
            'Механік підключив вас як клієнта',
            'relationship',
            'info',
            null,
            JSON.stringify({ mechanic_id }),
            0,
            nowIso
          );
        await db
          .prepare(
            `INSERT INTO notifications (id, user_id, title, message, type, status, scheduled_for, data, ${readCol}, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            crypto.randomUUID(),
            mechanic_id,
            'Додано клієнта',
            'Клієнта підключено до ваших обслуговувань',
            'relationship',
            'info',
            null,
            JSON.stringify({ client_id }),
            0,
            nowIso
          );
      } catch (_) {}
      return res.json({ message: 'Client connected' });
    }

    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO client_mechanics (id, client_id, mechanic_id, status) VALUES (?, ?, ?, 'accepted')"
      )
      .run(id, client_id, mechanic_id);

    // Створюємо сповіщення обом сторонам
    try {
      const readCol = await getExistingColumn('notifications', ['is_read', 'read']);
      const nowIso = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO notifications (id, user_id, title, message, type, status, scheduled_for, data, ${readCol}, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          crypto.randomUUID(),
          client_id,
          'Додано механіка',
          'Механік підключив вас як клієнта',
          'relationship',
          'info',
          null,
          JSON.stringify({ mechanic_id }),
          0,
          nowIso
        );
      await db
        .prepare(
          `INSERT INTO notifications (id, user_id, title, message, type, status, scheduled_for, data, ${readCol}, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          crypto.randomUUID(),
          mechanic_id,
          'Додано клієнта',
          'Клієнта підключено до ваших обслуговувань',
          'relationship',
          'info',
          null,
          JSON.stringify({ client_id }),
          0,
          nowIso
        );
    } catch (_) {}

    res.status(201).json({ message: 'Client connected' });
  } catch (err) {
    console.error('Add client error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Пошук майстрів (публічний або для авторизованих)
exports.searchMasters = async (req, res) => {
  try {
    const { city, name } = req.query;
    const db = await getDb();

    let query = "SELECT id, name, email, phone, city, avatar_url FROM users WHERE role = 'master'";
    const params = [];

    if (city) {
      // Використовуємо LIKE для часткового співпадіння
      // Додаємо COLLATE NOCASE для ігнорування регістру (якщо база підтримує, або через lower())
      // D1/SQLite за замовчуванням LIKE регістронезалежний тільки для ASCII
      // Для кирилиці краще використовувати lower()
      const cityParam = `%${city}%`;
      query += ' AND lower(city) LIKE lower(?)';
      params.push(cityParam);
    }

    if (name) {
      // Пошук по імені, email або телефону
      // Очищаємо телефон від зайвих символів для пошуку, якщо користувач ввів "+380..."
      const cleanPhone = name.replace(/[^\d+]/g, '');

      // Якщо введений лише номер телефону (цифри), шукаємо тільки по телефону, щоб уникнути конфліктів з іменами
      // Або шукаємо скрізь

      // Додаємо % для LIKE
      const nameParam = `%${name}%`;
      const phoneParam = `%${cleanPhone}%`;

      query += ' AND (lower(name) LIKE lower(?) OR lower(email) LIKE lower(?) OR phone LIKE ?)';
      params.push(nameParam);
      params.push(nameParam);
      params.push(phoneParam);
    }

    const rows = await db.prepare(query).all(...params);
    res.json(rows || []);
  } catch (err) {
    console.error('Search masters error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
