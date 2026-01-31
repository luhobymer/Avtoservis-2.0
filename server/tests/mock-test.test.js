const { getDb } = require('../db/d1');

describe('DB smoke test', () => {
  it('should initialize sqlite database', () => {
    const db = getDb();
    const usersTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .get();
    expect(usersTable).toBeTruthy();
  });
});
