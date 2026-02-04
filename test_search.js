const { getDb } = require('./server/db/d1');

async function testSearch() {
  try {
    const db = await getDb();
    const city = "Новомиргород";
    const name = "0980914374";
    const cleanPhone = name.replace(/[^\d+]/g, '');

    console.log(`Searching for city: "${city}", name/phone: "${name}" (clean: "${cleanPhone}")`);

    let query = "SELECT id, name, email, phone, city, role FROM users WHERE role = 'master'";
    const params = [];

    if (city) {
      query += " AND lower(city) LIKE lower(?)";
      params.push(`%${city}%`);
    }
    
    if (name) {
      query += " AND (lower(name) LIKE lower(?) OR lower(email) LIKE lower(?) OR phone LIKE ?)";
      params.push(`%${name}%`);
      params.push(`%${name}%`);
      params.push(`%${cleanPhone}%`);
    }

    console.log("Query:", query);
    console.log("Params:", params);

    const results = await db.prepare(query).all(...params);
    console.log("Results:", JSON.stringify(results, null, 2));

    // Test without lower()
    console.log("\n--- Test without lower() ---");
    let query2 = "SELECT id, name, email, phone, city, role FROM users WHERE role = 'master'";
    const params2 = [];
    if (city) {
      query2 += " AND city LIKE ?";
      params2.push(`%${city}%`);
    }
    if (name) {
      query2 += " AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)";
      params2.push(`%${name}%`);
      params2.push(`%${name}%`);
      params2.push(`%${cleanPhone}%`);
    }
    const results2 = await db.prepare(query2).all(...params2);
    console.log("Results 2:", JSON.stringify(results2, null, 2));

  } catch (err) {
    console.error('Error:', err);
  }
}

testSearch();
