const crypto = require('crypto');
const { getDb } = require('../db/d1');
const serviceController = require('../controllers/serviceController');

describe('ServiceController', () => {
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
    req = { params: {}, body: {}, user: null };
    res = makeRes();
    jest.clearAllMocks();
  });

  it('getAllServices returns services with stations', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const stationId = crypto.randomUUID();
    const serviceId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO service_stations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(stationId, 'Test Station', now, now);
    db.prepare(
      'INSERT INTO services (id, name, description, price, duration, service_station_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(serviceId, 'Oil Change', 'Desc', 500, 60, stationId, now, now);

    await serviceController.getAllServices(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: serviceId,
          name: 'Oil Change',
          service_stations: { id: stationId, name: 'Test Station' },
        }),
      ])
    );
  });

  it('getServiceById returns 404 when missing', async () => {
    req.params.id = crypto.randomUUID();
    await serviceController.getServiceById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('createService inserts and returns created service', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const stationId = crypto.randomUUID();
    const categoryId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO service_stations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(stationId, 'Test Station', now, now);
    db.prepare(
      'INSERT INTO service_categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(categoryId, 'Category', now, now);

    req.body = {
      name: 'Diagnostics',
      description: 'Full',
      price: 1200,
      duration: 90,
      service_station_id: stationId,
      category_id: categoryId,
    };

    await serviceController.createService(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const created = res.json.mock.calls[0][0];
    expect(created).toEqual(expect.objectContaining({ name: 'Diagnostics' }));
    expect(created.id).toBeTruthy();
  });

  it('updateService updates existing service', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const stationId = crypto.randomUUID();
    const serviceId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO service_stations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(stationId, 'Test Station', now, now);
    db.prepare(
      'INSERT INTO services (id, name, description, price, duration, service_station_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(serviceId, 'Oil Change', 'Desc', 500, 60, stationId, now, now);

    req.params.id = serviceId;
    req.body = { name: 'Oil Change Plus', price: 650 };

    await serviceController.updateService(req, res);

    const updated = res.json.mock.calls[0][0];
    expect(updated).toEqual(
      expect.objectContaining({ id: serviceId, name: 'Oil Change Plus', price: 650 })
    );
  });

  it('deleteService deletes service', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const stationId = crypto.randomUUID();
    const serviceId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO service_stations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(stationId, 'Test Station', now, now);
    db.prepare(
      'INSERT INTO services (id, name, description, price, duration, service_station_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(serviceId, 'Oil Change', 'Desc', 500, 60, stationId, now, now);

    req.params.id = serviceId;
    await serviceController.deleteService(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});
