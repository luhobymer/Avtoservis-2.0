const { getDb } = require('./server/db/d1');

async function checkRelationships() {
  try {
    const db = await getDb();
    console.log('--- Relationships ---');
    const rels = await db.prepare("SELECT * FROM client_mechanics").all();
    console.log(JSON.stringify(rels, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

checkRelationships();
