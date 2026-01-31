const crypto = require('crypto');
const { getDb } = require('../db/d1');
const mechanicController = require('../controllers/mechanicController');

describe('MechanicController', () => {
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

  const seedBase = () => {
    const db = getDb();
    const now = new Date().toISOString();
    const stationId = crypto.randomUUID();
    const specializationId = crypto.randomUUID();
    const mechanicId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO service_stations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(stationId, 'Station', now, now);
    db.prepare(
      'INSERT INTO specializations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(specializationId, 'Engine', now, now);
    db.prepare(
      'INSERT INTO mechanics (id, first_name, last_name, specialization_id, service_station_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(mechanicId, 'Іван', 'Петренко', specializationId, stationId, now, now);

    return { db, now, stationId, specializationId, mechanicId };
  };

  beforeEach(() => {
    req = { params: {}, query: {}, body: {} };
    res = makeRes();
    jest.clearAllMocks();
  });

  it('getAllMechanics returns mechanics with station and specialization', async () => {
    const { mechanicId } = seedBase();
    await mechanicController.getAllMechanics(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: mechanicId,
          service_stations: expect.objectContaining({ name: 'Station' }),
          specializations: expect.objectContaining({ name: 'Engine' }),
        }),
      ])
    );
  });

  it('getMechanicById returns 404 when missing', async () => {
    seedBase();
    req.params.id = crypto.randomUUID();
    await mechanicController.getMechanicById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('createMechanic inserts and returns created mechanic', async () => {
    const { db, stationId, specializationId } = seedBase();
    req.body = {
      first_name: 'Петро',
      last_name: 'Іванов',
      phone: '+380501234567',
      email: 'p@example.com',
      specialization_id: specializationId,
      service_station_id: stationId,
      experience_years: 5,
    };

    await mechanicController.createMechanic(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const created = res.json.mock.calls[0][0];
    const row = db.prepare('SELECT * FROM mechanics WHERE id = ?').get(created.id);
    expect(row).toBeTruthy();
  });

  it('updateMechanic returns 404 when missing', async () => {
    const { stationId, specializationId } = seedBase();
    req.params.id = crypto.randomUUID();
    req.body = {
      first_name: 'X',
      last_name: 'Y',
      phone: null,
      email: null,
      specialization_id: specializationId,
      service_station_id: stationId,
      experience_years: 1,
    };
    await mechanicController.updateMechanic(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deleteMechanic returns 400 when mechanic has active appointments', async () => {
    const { db, mechanicId, stationId } = seedBase();
    const userId = crypto.randomUUID();
    const serviceId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, 'user@example.com', 'hashed', 'client', now, now);
    db.prepare(
      'INSERT INTO services (id, name, price, duration, service_station_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(serviceId, 'Service', 1, 1, stationId, now, now);
    db.prepare(
      'INSERT INTO appointments (id, user_id, service_id, mechanic_id, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(),
      userId,
      serviceId,
      mechanicId,
      new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      'confirmed'
    );

    req.params.id = mechanicId;
    await mechanicController.deleteMechanic(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('getMechanicSchedule returns appointments within date range', async () => {
    const { db, mechanicId, stationId } = seedBase();
    const userId = crypto.randomUUID();
    const serviceId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, 'user@example.com', 'hashed', 'client', now, now);
    db.prepare(
      'INSERT INTO services (id, name, price, duration, service_station_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(serviceId, 'Service', 1, 30, stationId, now, now);

    const inRange = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const outRange = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    const idIn = crypto.randomUUID();
    const idOut = crypto.randomUUID();

    db.prepare(
      'INSERT INTO appointments (id, user_id, service_id, mechanic_id, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(idIn, userId, serviceId, mechanicId, inRange, 'confirmed');
    db.prepare(
      'INSERT INTO appointments (id, user_id, service_id, mechanic_id, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(idOut, userId, serviceId, mechanicId, outRange, 'confirmed');

    req.params.id = mechanicId;
    req.query.start_date = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    req.query.end_date = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    await mechanicController.getMechanicSchedule(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: idIn,
          services: expect.objectContaining({ id: serviceId, name: 'Service' }),
        }),
      ])
    );
    expect(payload.find((row) => row.id === idOut)).toBeUndefined();
  });
});
