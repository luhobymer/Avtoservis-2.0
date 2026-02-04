const logger = require('../middleware/logger.js');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/d1');

const isAdminRole = (role) => role === 'master';

const parseSettingsValue = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

const normalizeSettingsPayload = (settings) => {
  if (settings === null) return null;
  if (typeof settings === 'string') {
    try {
      JSON.parse(settings);
      return settings;
    } catch (error) {
      return JSON.stringify(settings);
    }
  }
  return JSON.stringify(settings ?? {});
};

// Оновлення профілю користувача
const updateUserProfile = async (req, res) => {
  try {
    const { name, phone, firstName, lastName, patronymic, region, city } = req.body;
    const userId = req.user.id;

    const updateData = {};
    if (typeof name !== 'undefined') updateData.name = name;
    if (typeof phone !== 'undefined') updateData.phone = phone;
    if (typeof firstName !== 'undefined') updateData.first_name = firstName;
    if (typeof lastName !== 'undefined') updateData.last_name = lastName;
    if (typeof patronymic !== 'undefined') updateData.patronymic = patronymic;
    if (typeof region !== 'undefined') updateData.region = region;
    if (typeof city !== 'undefined') updateData.city = city;

    const fields = Object.keys(updateData);
    if (fields.length > 0) {
      const setClause = fields.map((field) => `${field} = ?`).join(', ');
      const values = fields.map((field) => updateData[field]);
      const db = await getDb();
      await db
        .prepare(`UPDATE users SET ${setClause}, updated_at = ? WHERE id = ?`)
        .run(...values, new Date().toISOString(), userId);
    }

    const db = await getDb();
    const updatedUser = await db
      .prepare(
        'SELECT id, name, email, phone, role, first_name, last_name, patronymic, region, city, created_at FROM users WHERE id = ?'
      )
      .get(userId);

    if (!updatedUser) {
      return res.status(404).json({ success: false, error: 'Користувач не знайдений' });
    }

    res.json({
      success: true,
      message: 'Профіль успішно оновлено',
      user: updatedUser,
    });
  } catch (error) {
    logger.error('Помилка при оновленні профілю:', error);
    res.status(500).json({
      success: false,
      error: 'Внутрішня помилка сервера',
    });
  }
};

const listUsers = async (req, res) => {
  try {
    const limitParam = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 500;

    const offsetParam = Number.parseInt(req.query.offset, 10);
    const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const db = await getDb();
    const params = [];
    let whereClause = '';

    if (q) {
      whereClause = 'WHERE email LIKE ? OR name LIKE ? OR phone LIKE ?';
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const rows = await db
      .prepare(
        `SELECT id, email, name, phone, role, email_verified, created_at, updated_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    res.json(rows || []);
  } catch (error) {
    logger.error('Помилка при отриманні користувачів:', error);
    res.status(500).json({
      success: false,
      error: 'Внутрішня помилка сервера',
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const requestedId = req.params.id;
    const requesterId = req.user?.id;
    const requesterRole = req.user?.role;

    if (requestedId !== requesterId && !isAdminRole(requesterRole)) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const db = await getDb();
    const user = await db
      .prepare(
        'SELECT id, email, name, phone, role, email_verified, created_at, updated_at FROM users WHERE id = ?'
      )
      .get(requestedId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    logger.error('Помилка при отриманні користувача:', error);
    res.status(500).json({
      success: false,
      error: 'Внутрішня помилка сервера',
    });
  }
};

const updateUserById = async (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body;
    const db = await getDb();
    const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (role) updateData.role = role;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const fields = Object.keys(updateData);
    if (fields.length > 0) {
      const setClause = fields.map((field) => `${field} = ?`).join(', ');
      const values = fields.map((field) => updateData[field]);
      await db
        .prepare(`UPDATE users SET ${setClause}, updated_at = ? WHERE id = ?`)
        .run(...values, new Date().toISOString(), req.params.id);
    }

    const updatedUser = await db
      .prepare(
        'SELECT id, email, name, phone, role, email_verified, created_at, updated_at FROM users WHERE id = ?'
      )
      .get(req.params.id);

    if (!updatedUser) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(updatedUser);
  } catch (error) {
    logger.error('Помилка при оновленні користувача:', error);
    res.status(500).json({
      success: false,
      error: 'Внутрішня помилка сервера',
    });
  }
};

const deleteUserById = async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ msg: 'Cannot delete your own account' });
    }

    await db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);

    res.json({ msg: 'User removed' });
  } catch (error) {
    logger.error('Помилка при видаленні користувача:', error);
    res.status(500).json({
      success: false,
      error: 'Внутрішня помилка сервера',
    });
  }
};

const getUserSettings = async (req, res) => {
  try {
    const requestedId = req.params.id;
    const requesterId = req.user?.id;
    const requesterRole = req.user?.role;

    if (requestedId !== requesterId && !isAdminRole(requesterRole)) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const db = await getDb();
    const row = await db
      .prepare('SELECT settings FROM user_settings WHERE user_id = ?')
      .get(requestedId);
    const settings = row && row.settings ? parseSettingsValue(row.settings) : null;

    res.json({ user_id: requestedId, settings });
  } catch (error) {
    logger.error('Помилка при отриманні налаштувань користувача:', error);
    res.status(500).json({
      success: false,
      error: 'Внутрішня помилка сервера',
    });
  }
};

const updateUserSettings = async (req, res) => {
  try {
    const requestedId = req.params.id;
    const requesterId = req.user?.id;
    const requesterRole = req.user?.role;

    if (requestedId !== requesterId && !isAdminRole(requesterRole)) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    if (typeof req.body.settings === 'undefined') {
      return res.status(400).json({ message: 'settings field is required' });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const normalizedSettings = normalizeSettingsPayload(req.body.settings);

    const existing = await db
      .prepare('SELECT id FROM user_settings WHERE user_id = ?')
      .get(requestedId);

    if (existing && existing.id) {
      await db
        .prepare('UPDATE user_settings SET settings = ?, updated_at = ? WHERE id = ?')
        .run(normalizedSettings, now, existing.id);
    } else {
      await db
        .prepare(
          'INSERT INTO user_settings (user_id, settings, created_at, updated_at) VALUES (?, ?, ?, ?)'
        )
        .run(requestedId, normalizedSettings, now, now);
    }

    res.json({
      user_id: requestedId,
      settings: parseSettingsValue(normalizedSettings),
    });
  } catch (error) {
    logger.error('Помилка при оновленні налаштувань користувача:', error);
    res.status(500).json({
      success: false,
      error: 'Внутрішня помилка сервера',
    });
  }
};

// Отримання профілю користувача
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const db = await getDb();
    const data = await db
      .prepare(
        'SELECT id, name, email, phone, role, first_name, last_name, patronymic, region, city, created_at FROM users WHERE id = ?'
      )
      .get(userId);

    if (!data) {
      return res.status(404).json({ success: false, error: 'Користувач не знайдений' });
    }

    res.json({
      success: true,
      user: data,
    });
  } catch (error) {
    logger.error('Помилка при отриманні профілю:', error);
    res.status(500).json({
      success: false,
      error: 'Внутрішня помилка сервера',
    });
  }
};

module.exports = {
  updateUserProfile,
  getUserProfile,
  listUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  getUserSettings,
  updateUserSettings,
};
