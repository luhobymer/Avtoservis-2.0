const { getDb } = require('./server/db/d1');

async function checkMasters() {
  try {
    const db = await getDb();
    console.log('--- Masters in DB ---');
    const masters = await db.prepare("SELECT id, name, email, phone, city, role FROM users WHERE role = 'master'").all();
    console.log(JSON.stringify(masters, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

checkMasters();
