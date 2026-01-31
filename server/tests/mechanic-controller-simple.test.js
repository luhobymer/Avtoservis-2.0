const { getAllMechanics } = require('../controllers/mechanicController');
const crypto = require('crypto');
const { getDb } = require('../db/d1');

describe('MechanicController Simple Test', () => {
  let req, res;

  beforeEach(() => {
    req = {};
    res = {
      json: jest.fn(),
      status: jest.fn(() => res),
    };
    jest.clearAllMocks();
  });

  it('should get all mechanics', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const stationId = crypto.randomUUID();
    const specializationId = crypto.randomUUID();
    const mechanicId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO service_stations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(stationId, 'Test Station', now, now);
    db.prepare(
      'INSERT INTO specializations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(specializationId, 'Engine', now, now);
    db.prepare(
      'INSERT INTO mechanics (id, first_name, last_name, specialization_id, service_station_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(mechanicId, 'Іван', 'Петренко', specializationId, stationId, now, now);

    await getAllMechanics(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: mechanicId,
          first_name: 'Іван',
          last_name: 'Петренко',
          service_stations: expect.objectContaining({ id: stationId, name: 'Test Station' }),
          specializations: expect.objectContaining({ id: specializationId, name: 'Engine' }),
        }),
      ])
    );
  });
});
