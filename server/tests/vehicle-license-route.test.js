const request = require('supertest');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const app = require('../index');
const { getDb } = require('../db/d1');

describe('Vehicle license lookup route - integration', () => {
  const signToken = (payload) =>
    jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });

  test('GET /api/vehicles/license/:plate returns vehicle for current user', async () => {
    const db = getDb();
    const now = new Date().toISOString();

    const userId = crypto.randomUUID();
    const vehicleId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, 'user@example.com', 'hashed', 'client', now, now);

    db.prepare(
      'INSERT INTO vehicles (id, user_id, vin, make, model, year, color, license_plate, mileage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      vehicleId,
      userId,
      `VIN-${crypto.randomUUID()}`,
      'Audi',
      'A6',
      2012,
      'black',
      'KA2878IA',
      1000,
      now,
      now
    );

    const token = signToken({ id: userId, email: 'user@example.com', role: 'client' });

    const res = await request(app)
      .get('/api/vehicles/license/KA 2878 IA')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', vehicleId);
    expect(res.body).toHaveProperty('licensePlate', 'KA2878IA');
    expect(res.body).toHaveProperty('make', 'Audi');
    expect(res.body).toHaveProperty('model', 'A6');
  });

  test('GET /api/vehicles/license/:plate supports master querying by user_id', async () => {
    const db = getDb();
    const now = new Date().toISOString();

    const masterId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const vehicleId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(masterId, 'master@example.com', 'hashed', 'master', now, now);

    db.prepare(
      'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, 'user@example.com', 'hashed', 'client', now, now);

    db.prepare(
      'INSERT INTO vehicles (id, user_id, vin, make, model, year, color, license_plate, mileage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      vehicleId,
      userId,
      `VIN-${crypto.randomUUID()}`,
      'BMW',
      'X5',
      2020,
      'black',
      'AA1234BB',
      1000,
      now,
      now
    );

    const token = signToken({ id: masterId, email: 'master@example.com', role: 'master' });

    const res = await request(app)
      .get(`/api/vehicles/license/AA1234BB?user_id=${encodeURIComponent(userId)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', vehicleId);
    expect(res.body).toHaveProperty('licensePlate', 'AA1234BB');
  });

  test('GET /api/vehicles/license/:plate finds vehicle with non-normalized stored plate for current user', async () => {
    const db = getDb();
    const now = new Date().toISOString();

    const userId = crypto.randomUUID();
    const vehicleId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, 'plate-user@example.com', 'hashed', 'client', now, now);

    db.prepare(
      'INSERT INTO vehicles (id, user_id, vin, make, model, year, color, license_plate, mileage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      vehicleId,
      userId,
      `VIN-${crypto.randomUUID()}`,
      'Skoda',
      'Octavia',
      2018,
      'gray',
      'ВА 1190 НІ',
      1000,
      now,
      now
    );

    const token = signToken({ id: userId, email: 'plate-user@example.com', role: 'client' });

    const res = await request(app)
      .get('/api/vehicles/license/BA1190HI')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', vehicleId);
  });

  test('GET /api/vehicles/license/:plate lets master find vehicle by plate without user_id fallback', async () => {
    const db = getDb();
    const now = new Date().toISOString();

    const masterId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const vehicleId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(masterId, 'master-fallback@example.com', 'hashed', 'master', now, now);

    db.prepare(
      'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, 'fallback-user@example.com', 'hashed', 'client', now, now);

    db.prepare(
      'INSERT INTO vehicles (id, user_id, vin, make, model, year, color, license_plate, mileage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      vehicleId,
      userId,
      `VIN-${crypto.randomUUID()}`,
      'Skoda',
      'Fabia',
      2011,
      'white',
      'ВА1190НІ',
      1000,
      now,
      now
    );

    const token = signToken({ id: masterId, email: 'master-fallback@example.com', role: 'master' });

    const res = await request(app)
      .get('/api/vehicles/license/BA1190HI')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', vehicleId);
  });
});
