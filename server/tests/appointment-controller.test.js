const crypto = require('crypto');
const { getDb } = require('../db/d1');
const appointmentController = require('../controllers/appointmentController');

describe('AppointmentController', () => {
  let req;
  let res;

  const makeRes = () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    response.status.mockReturnValue(response);
    return response;
  };

  beforeEach(() => {
    req = { params: {}, query: {}, body: {}, user: { id: null } };
    res = makeRes();
    jest.clearAllMocks();
  });

  const seedBase = () => {
    const db = getDb();
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const stationId = crypto.randomUUID();
    const categoryId = crypto.randomUUID();
    const serviceId = crypto.randomUUID();
    const specializationId = crypto.randomUUID();
    const mechanicId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, 'user@example.com', 'hashed', 'client', now, now);
    db.prepare(
      'INSERT INTO service_stations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(stationId, 'Station', now, now);
    db.prepare(
      'INSERT INTO service_categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(categoryId, 'Cat', now, now);
    db.prepare(
      'INSERT INTO services (id, name, price, duration, service_station_id, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(serviceId, 'Oil Change', 500, 60, stationId, categoryId, now, now);
    db.prepare(
      'INSERT INTO specializations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(specializationId, 'Engine', now, now);
    db.prepare(
      'INSERT INTO mechanics (id, first_name, last_name, specialization_id, service_station_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(mechanicId, 'Іван', 'Петренко', specializationId, stationId, now, now);

    db.prepare(
      'INSERT INTO mechanic_services (id, mechanic_id, service_id, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), mechanicId, serviceId, 1, now, now);

    req.user.id = userId;

    return { db, now, userId, stationId, serviceId, mechanicId };
  };

  it('getAllAppointments returns mapped appointments', async () => {
    const { db, userId, serviceId, mechanicId } = seedBase();
    const appointmentId = crypto.randomUUID();
    const scheduledTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    db.prepare(
      'INSERT INTO appointments (id, user_id, service_id, mechanic_id, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(appointmentId, userId, serviceId, mechanicId, scheduledTime, 'confirmed');

    await appointmentController.getAllAppointments(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: appointmentId,
          users: expect.objectContaining({ id: userId, email: 'user@example.com' }),
          services: expect.objectContaining({
            id: serviceId,
            name: 'Oil Change',
            price: 500,
            duration: 60,
          }),
          mechanics: expect.objectContaining({
            id: mechanicId,
            first_name: 'Іван',
            last_name: 'Петренко',
            specialization: 'Engine',
          }),
        }),
      ])
    );
  });

  it('getAppointmentById returns 404 when missing', async () => {
    seedBase();
    req.params.id = crypto.randomUUID();
    await appointmentController.getAppointmentById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('getUserAppointments returns in scheduled_time order', async () => {
    const { db, userId, serviceId, mechanicId } = seedBase();
    const a1 = crypto.randomUUID();
    const a2 = crypto.randomUUID();
    const t1 = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const t2 = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    db.prepare(
      'INSERT INTO appointments (id, user_id, service_id, mechanic_id, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(a2, userId, serviceId, mechanicId, t2, 'confirmed');
    db.prepare(
      'INSERT INTO appointments (id, user_id, service_id, mechanic_id, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(a1, userId, serviceId, mechanicId, t1, 'confirmed');

    await appointmentController.getUserAppointments(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload[0].id).toBe(a1);
    expect(payload[1].id).toBe(a2);
  });

  it('createAppointment returns 201 when time is available', async () => {
    const { db, serviceId, mechanicId } = seedBase();
    const scheduledTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    req.body = {
      service_id: serviceId,
      mechanic_id: mechanicId,
      scheduled_time: scheduledTime,
      notes: 'n',
      car_info: 'c',
    };

    await appointmentController.createAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const created = res.json.mock.calls[0][0];
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(created.id);
    expect(row).toBeTruthy();
  });

  it('createAppointment returns 400 when time is already taken', async () => {
    const { db, userId, serviceId, mechanicId } = seedBase();
    const scheduledTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const existingId = crypto.randomUUID();
    db.prepare(
      'INSERT INTO appointments (id, user_id, service_id, mechanic_id, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(existingId, userId, serviceId, mechanicId, scheduledTime, 'pending');

    req.body = { service_id: serviceId, mechanic_id: mechanicId, scheduled_time: scheduledTime };
    await appointmentController.createAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Цей час вже зайнято' });
  });

  it('updateAppointmentStatus returns 404 when missing', async () => {
    seedBase();
    req.params.id = crypto.randomUUID();
    req.body = { status: 'completed', completion_notes: 'done' };
    await appointmentController.updateAppointmentStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('cancelAppointment returns 400 when less than 24 hours before', async () => {
    const { db, userId, serviceId, mechanicId } = seedBase();
    const appointmentId = crypto.randomUUID();
    const scheduledTime = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    db.prepare(
      'INSERT INTO appointments (id, user_id, service_id, mechanic_id, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(appointmentId, userId, serviceId, mechanicId, scheduledTime, 'confirmed');

    req.params.id = appointmentId;
    await appointmentController.cancelAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('cancelAppointment returns 200 and updates status when allowed', async () => {
    const { db, userId, serviceId, mechanicId } = seedBase();
    const appointmentId = crypto.randomUUID();
    const scheduledTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    db.prepare(
      'INSERT INTO appointments (id, user_id, service_id, mechanic_id, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(appointmentId, userId, serviceId, mechanicId, scheduledTime, 'confirmed');

    req.params.id = appointmentId;
    await appointmentController.cancelAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Запис скасовано' });
    const updated = db.prepare('SELECT status FROM appointments WHERE id = ?').get(appointmentId);
    expect(updated.status).toBe('cancelled');
  });
});
