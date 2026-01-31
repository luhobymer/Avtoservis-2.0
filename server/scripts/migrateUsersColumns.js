const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const getEnv = (name) => {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
};

const getD1Config = () => {
  const accountId = getEnv('CLOUDFLARE_ACCOUNT_ID');
  const databaseId = getEnv('CLOUDFLARE_D1_DATABASE_ID');
  const apiToken = getEnv('CLOUDFLARE_API_TOKEN');
  if (!accountId || !databaseId || !apiToken) {
    throw new Error('Missing Cloudflare D1 configuration');
  }
  return { accountId, databaseId, apiToken };
};

const createD1Client = ({ accountId, databaseId, apiToken }) => {
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const query = async (sql, params = []) => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });

    const payload = await response.json();
    if (!payload?.success) {
      const error = payload?.errors?.[0]?.message || 'D1 query failed';
      throw new Error(error);
    }
    const result = Array.isArray(payload.result) ? payload.result[0] : payload.result;
    if (!result?.success) {
      throw new Error('D1 query failed');
    }
    return result;
  };

  return { query };
};

const ensureUserColumns = async (client) => {
  const existing = await client.query('PRAGMA table_info(users)');
  const columnNames = new Set((existing.results || []).map((column) => column.name));
  const columns = [
    { name: 'first_name', def: 'TEXT' },
    { name: 'last_name', def: 'TEXT' },
    { name: 'patronymic', def: 'TEXT' },
    { name: 'region', def: 'TEXT' },
    { name: 'city', def: 'TEXT' },
  ];

  const added = [];
  for (const column of columns) {
    if (!columnNames.has(column.name)) {
      await client.query(`ALTER TABLE users ADD COLUMN ${column.name} ${column.def}`);
      added.push(column.name);
    }
  }
  return { added, existing: Array.from(columnNames) };
};

async function main() {
  const config = getD1Config();
  const client = createD1Client(config);
  const { added } = await ensureUserColumns(client);
  if (added.length === 0) {
    process.stdout.write('OK: user columns already exist\n');
    return;
  }
  process.stdout.write(`OK: added columns: ${added.join(', ')}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
});
