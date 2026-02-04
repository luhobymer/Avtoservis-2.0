const { getDb } = require('./server/db/d1');

async function migrate() {
  try {
    const db = await getDb();
    
    // Create client_mechanics table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS client_mechanics (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        mechanic_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending', -- pending, accepted, rejected
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES users(id),
        FOREIGN KEY (mechanic_id) REFERENCES users(id)
      )
    `).run();

    console.log('Migration completed: client_mechanics table created');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

migrate();
