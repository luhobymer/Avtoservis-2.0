const request = require('supertest');
const app = require('../index');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDb } = require('../db/d1');

describe('API Tests', () => {
  let authToken;
  let userId;
  let hashedPassword;
  const email = 'test@example.com';
  const password = 'password123';

  beforeAll(async () => {
    hashedPassword = await bcrypt.hash(password, 10);
  });

  beforeEach(() => {
    const db = getDb();
    const now = new Date().toISOString();
    userId = crypto.randomUUID();
    db.prepare(
      'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, email, hashedPassword, 'client', now, now);

    authToken = jwt.sign(
      { id: userId, email, role: 'client' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('Auth Routes', () => {
    test('POST /api/auth/login - успішний вхід', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email,
        password,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    test('GET /api/auth/me - отримання даних користувача', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('email', email);
    });
  });

  describe('Service Station Routes', () => {
    test('GET /api/stations - отримання списку СТО', async () => {
      const res = await request(app).get('/api/stations');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Services Routes', () => {
    test('GET /api/services - отримання списку послуг', async () => {
      const res = await request(app).get('/api/services');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Appointments Routes', () => {
    test('POST /api/appointments - створення запису', async () => {
      const db = getDb();
      const serviceId = crypto.randomUUID();
      const mechanicId = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO services (id, name, price, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(serviceId, 'Test Service', 100, 30, now, now);
      db.prepare(
        'INSERT INTO mechanics (id, first_name, last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).run(mechanicId, 'Test', 'Mechanic', now, now);

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_id: serviceId,
          mechanic_id: mechanicId,
          scheduled_time: '2025-05-01T10:00:00Z',
        });

      if (res.status !== 201) {
        throw new Error(`Unexpected response: ${res.status} ${JSON.stringify(res.body)}`);
      }
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    test('GET /api/appointments - отримання списку записів', async () => {
      const res = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`);

      if (res.status !== 200) {
        throw new Error(`Unexpected response: ${res.status} ${JSON.stringify(res.body)}`);
      }
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('PUT /api/appointments/:id - оновлення запису', async () => {
      const db = getDb();
      const serviceId = crypto.randomUUID();
      const mechanicId = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO services (id, name, price, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(serviceId, 'Test Service', 100, 30, now, now);
      db.prepare(
        'INSERT INTO mechanics (id, first_name, last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).run(mechanicId, 'Test', 'Mechanic', now, now);

      const createRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_id: serviceId,
          mechanic_id: mechanicId,
          scheduled_time: '2025-05-01T10:00:00Z',
        });
      const appointmentId = createRes.body.id;

      const res = await request(app)
        .put(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'confirmed',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'confirmed');
    });
  });

  describe('Vehicles Routes', () => {
    test('POST /api/vehicles - додавання автомобіля', async () => {
      const res = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vin: 'TEST1234567890',
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    test('GET /api/vehicles - отримання списку автомобілів', async () => {
      const res = await request(app)
        .get('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('PUT /api/vehicles/:id - оновлення автомобіля', async () => {
      await request(app).post('/api/vehicles').set('Authorization', `Bearer ${authToken}`).send({
        vin: 'TEST1234567890',
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
      });

      const res = await request(app)
        .put('/api/vehicles/TEST1234567890')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          mileage: 50000,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('mileage', 50000);
    });
  });
});
