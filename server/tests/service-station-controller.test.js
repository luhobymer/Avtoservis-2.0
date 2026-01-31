const crypto = require('crypto');
const { getDb } = require('../db/d1');
const serviceStationController = require('../controllers/serviceStationController');

describe('ServiceStationController', () => {
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
    req = { params: {}, body: {} };
    res = makeRes();
    jest.clearAllMocks();
  });

  const seedStationWithRelations = () => {
    const db = getDb();
    const now = new Date().toISOString();
    const stationId = crypto.randomUUID();
    const serviceId = crypto.randomUUID();
    const specializationId = crypto.randomUUID();
    const mechanicId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO service_stations (id, name, address, phone, working_hours, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      stationId,
      'СТО №1',
      'вул. Головна, 1',
      '+380501234567',
      '9:00-18:00',
      'Професійний автосервіс',
      now,
      now
    );

    db.prepare(
      'INSERT INTO services (id, name, price, duration, service_station_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(serviceId, 'Заміна масла', 500, 60, stationId, now, now);

    db.prepare(
      'INSERT INTO specializations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(specializationId, 'Двигуни', now, now);

    db.prepare(
      'INSERT INTO mechanics (id, first_name, last_name, specialization_id, service_station_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(mechanicId, 'Іван', 'Петренко', specializationId, stationId, now, now);

    return { db, now, stationId, serviceId, mechanicId, specializationId };
  };

  it('getAllStations returns stations with services and mechanics', async () => {
    const { stationId, serviceId, mechanicId } = seedStationWithRelations();

    await serviceStationController.getAllStations(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: stationId,
          name: 'СТО №1',
          services: expect.arrayContaining([
            expect.objectContaining({
              id: serviceId,
              name: 'Заміна масла',
              price: 500,
              duration: 60,
            }),
          ]),
          mechanics: expect.arrayContaining([
            expect.objectContaining({
              id: mechanicId,
              first_name: 'Іван',
              last_name: 'Петренко',
              specialization: 'Двигуни',
            }),
          ]),
        }),
      ])
    );
  });

  it('getStationById returns station with services, mechanics, and reviews', async () => {
    const { db, now, stationId, serviceId, mechanicId } = seedStationWithRelations();
    const userId = crypto.randomUUID();
    const reviewId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, 'user@example.com', 'hashed', 'client', now, now);
    db.prepare(
      'INSERT INTO reviews (id, user_id, service_station_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(reviewId, userId, stationId, 5, 'Відмінний сервіс', '2024-01-15T10:00:00Z');

    req.params.id = stationId;
    await serviceStationController.getStationById(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: stationId,
        services: expect.arrayContaining([expect.objectContaining({ id: serviceId })]),
        mechanics: expect.arrayContaining([expect.objectContaining({ id: mechanicId })]),
        reviews: expect.arrayContaining([
          expect.objectContaining({
            id: reviewId,
            rating: 5,
            comment: 'Відмінний сервіс',
            users: expect.objectContaining({ id: userId, email: 'user@example.com' }),
          }),
        ]),
      })
    );
  });

  it('getStationById returns 404 when station is missing', async () => {
    req.params.id = crypto.randomUUID();
    await serviceStationController.getStationById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'СТО не знайдено' });
  });

  it('createStation inserts station and returns 201', async () => {
    const db = getDb();
    req.body = {
      name: 'СТО №2',
      address: 'вул. Тестова, 2',
      phone: '+380501234000',
      working_hours: '10:00-19:00',
      description: 'Опис',
    };

    await serviceStationController.createStation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const created = res.json.mock.calls[0][0];
    expect(created).toEqual(expect.objectContaining({ name: 'СТО №2', phone: '+380501234000' }));
    const row = db.prepare('SELECT * FROM service_stations WHERE id = ?').get(created.id);
    expect(row).toBeTruthy();
  });

  it('updateStation updates station and returns updated row', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const stationId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO service_stations (id, name, address, phone, working_hours, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(stationId, 'Old', 'Addr', 'Phone', '9-18', 'Desc', now, now);

    req.params.id = stationId;
    req.body = {
      name: 'New',
      address: 'New Addr',
      phone: 'New Phone',
      working_hours: '8-19',
      description: 'New Desc',
    };

    await serviceStationController.updateStation(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: stationId, name: 'New', phone: 'New Phone' })
    );
  });

  it('updateStation returns 404 when station is missing', async () => {
    req.params.id = crypto.randomUUID();
    req.body = { name: 'New', address: 'A', phone: 'P', working_hours: 'H', description: 'D' };
    await serviceStationController.updateStation(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'СТО не знайдено' });
  });

  it('deleteStation deletes station and returns 204', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const stationId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO service_stations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(stationId, 'Delete Me', now, now);

    req.params.id = stationId;
    await serviceStationController.deleteStation(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
    const row = db.prepare('SELECT id FROM service_stations WHERE id = ?').get(stationId);
    expect(row).toBeFalsy();
  });
});
