const { getDb } = require('./server/db/d1');

async function checkServiceRecordsSchema() {
  try {
    const db = await getDb();
    console.log('--- Service Records Table ---');
    const cols = await db.prepare("PRAGMA table_info(service_records)").all();
    console.log(cols.map(c => c.name));
  } catch (err) {
    console.error('Error:', err);
  }
}

checkServiceRecordsSchema();
