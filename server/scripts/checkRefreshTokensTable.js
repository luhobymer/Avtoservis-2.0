const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const { getDb } = require('../db/d1');

async function main() {
  const db = await getDb();
  const row = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='refresh_tokens'")
    .get();
  process.stdout.write(`${row ? 'OK: refresh_tokens exists' : 'MISSING: refresh_tokens'}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
});
