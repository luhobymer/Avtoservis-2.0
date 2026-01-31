const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let dbInstancePromise;

const getEnv = (name) => {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
};

const getD1Config = (overrideDbId = null) => {
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    return null;
  }
  const accountId = getEnv('CLOUDFLARE_ACCOUNT_ID');
  const databaseId = overrideDbId || getEnv('CLOUDFLARE_D1_DATABASE_ID');
  const apiToken = getEnv('CLOUDFLARE_API_TOKEN');
  if (!accountId || !databaseId || !apiToken) {
    return null;
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

const createMemoryDb = () => {
  const tables = new Map();

  const ensureTable = (name) => {
    if (!tables.has(name)) {
      tables.set(name, new Map());
    }
    return tables.get(name);
  };

  ensureTable('users');
  ensureTable('refresh_tokens');
  ensureTable('user_settings');

  const tableColumns = new Map([
    [
      'users',
      new Set([
        'id',
        'email',
        'password',
        'role',
        'profile_id',
        'two_factor_secret',
        'two_factor_enabled',
        'two_factor_pending',
        'recovery_codes',
        'created_at',
        'updated_at',
        'name',
        'phone',
        'first_name',
        'last_name',
        'patronymic',
        'region',
        'city',
      ]),
    ],
    [
      'refresh_tokens',
      new Set(['id', 'user_id', 'token', 'expires_at', 'is_revoked', 'created_at']),
    ],
    ['user_settings', new Set(['id', 'user_id', 'settings', 'created_at', 'updated_at'])],
  ]);

  const parseInsert = (sql) => {
    const match = /^\s*INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i.exec(
      sql
    );
    if (!match) return null;
    const [, table, columns] = match;
    const cols = columns.split(',').map((c) => c.trim().replace(/`|"/g, ''));
    return { table, cols };
  };

  const parseSelect = (sql) => {
    const match =
      /^\s*SELECT\s+(.+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+.+?)?(?:\s+LIMIT\s+\d+)?\s*$/i.exec(
        sql.trim()
      );
    if (!match) return null;
    const [, fields, table, where] = match;
    return { fields: fields.trim(), table: table.trim(), where: where ? where.trim() : null };
  };

  const parseUpdate = (sql) => {
    const match = /^\s*UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.+?)\s+WHERE\s+(.+?)\s*$/i.exec(
      sql.trim()
    );
    if (!match) return null;
    const [, table, setPart, where] = match;
    const assignments = setPart
      .split(',')
      .map((part) => part.trim())
      .map((part) => part.split('=')[0].trim().replace(/`|"/g, ''));
    return { table: table.trim(), assignments, where: where.trim() };
  };

  const parseDelete = (sql) => {
    const match = /^\s*DELETE\s+FROM\s+([a-zA-Z0-9_]+)\s+WHERE\s+(.+?)\s*$/i.exec(sql.trim());
    if (!match) return null;
    const [, table, where] = match;
    return { table: table.trim(), where: where.trim() };
  };

  const applyWhere = (rows, where, params) => {
    if (!where) return rows;
    const simpleEq = /^([a-zA-Z0-9_]+)\s*=\s*\?$/i.exec(where);
    if (simpleEq) {
      const field = simpleEq[1];
      const value = params[0];
      return rows.filter((row) => String(row[field]) === String(value));
    }
    const andEq =
      /^([a-zA-Z0-9_]+)\s*=\s*\?\s+AND\s+([a-zA-Z0-9_]+)\s*=\s*\?\s+AND\s+([a-zA-Z0-9_]+)\s*=\s*(\d+)\s*$/i.exec(
        where
      );
    if (andEq) {
      const [, f1, f2, f3, lit3] = andEq;
      const v1 = params[0];
      const v2 = params[1];
      const v3 = Number(lit3);
      return rows.filter(
        (row) =>
          String(row[f1]) === String(v1) &&
          String(row[f2]) === String(v2) &&
          Number(row[f3] ?? 0) === v3
      );
    }
    return rows;
  };

  const prepare = (sql) => {
    const trimmed = String(sql || '').trim();

    if (/^\s*PRAGMA\s+table_info\(users\)/i.test(trimmed)) {
      return {
        all: () =>
          Array.from(tableColumns.get('users') || []).map((name, idx) => ({ cid: idx, name })),
        get: () => null,
        run: () => ({ changes: 0 }),
      };
    }

    const insert = parseInsert(trimmed);
    if (insert) {
      const tableMap = ensureTable(insert.table);
      return {
        run: (...params) => {
          const row = {};
          insert.cols.forEach((col, i) => {
            row[col] = params[i];
          });
          const id = row.id || crypto.randomUUID();
          row.id = id;
          tableMap.set(String(id), row);
          return { changes: 1, lastInsertRowid: id };
        },
        get: () => null,
        all: () => [],
      };
    }

    const update = parseUpdate(trimmed);
    if (update) {
      const tableMap = ensureTable(update.table);
      return {
        run: (...params) => {
          const whereEq = /^([a-zA-Z0-9_]+)\s*=\s*\?$/i.exec(update.where);
          if (!whereEq) return { changes: 0 };
          const whereField = whereEq[1];
          const whereValue = params[update.assignments.length];
          const rows = Array.from(tableMap.values()).filter(
            (row) => String(row[whereField]) === String(whereValue)
          );
          let changes = 0;
          for (const row of rows) {
            update.assignments.forEach((field, idx) => {
              row[field] = params[idx];
            });
            if (row.id) tableMap.set(String(row.id), row);
            changes += 1;
          }
          return { changes };
        },
        get: () => null,
        all: () => [],
      };
    }

    const del = parseDelete(trimmed);
    if (del) {
      const tableMap = ensureTable(del.table);
      return {
        run: (...params) => {
          const whereEq = /^([a-zA-Z0-9_]+)\s*=\s*\?$/i.exec(del.where);
          if (!whereEq) return { changes: 0 };
          const whereField = whereEq[1];
          const whereValue = params[0];
          const keys = Array.from(tableMap.keys());
          let changes = 0;
          for (const key of keys) {
            const row = tableMap.get(key);
            if (row && String(row[whereField]) === String(whereValue)) {
              tableMap.delete(key);
              changes += 1;
            }
          }
          return { changes };
        },
        get: () => null,
        all: () => [],
      };
    }

    const select = parseSelect(trimmed);
    if (select) {
      const tableMap = ensureTable(select.table);
      const rows = () => Array.from(tableMap.values());
      const isCount = /COUNT\(\*\)\s+as\s+count/i.test(select.fields);
      return {
        all: (...params) => {
          const filtered = applyWhere(rows(), select.where, params);
          if (isCount) return [{ count: filtered.length }];
          return filtered;
        },
        get: (...params) => {
          const filtered = applyWhere(rows(), select.where, params);
          if (isCount) return { count: filtered.length };
          return filtered[0] || undefined;
        },
        run: () => ({ changes: 0 }),
      };
    }

    return {
      all: () => [],
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  };

  return { prepare };
};

const createSqliteDbSync = () => {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const dbPath = getEnv('SQLITE_DB_PATH') || path.join(__dirname, '..', 'avtoservis.sqlite');
    return new DatabaseSync(dbPath);
  } catch (err) {
    return null;
  }
};

const ensureSchemaSqliteSync = (sqliteDb) => {
  const schemaPath = path.join(__dirname, '..', '..', 'd1_schema.sql');
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    if (sql && typeof sql === 'string') {
      const statements = splitSqlStatements(sql);
      for (const statement of statements) {
        sqliteDb.exec(statement);
      }
    }
  }

  const columns = sqliteDb.prepare('PRAGMA table_info(users)').all();
  const columnNames = new Set(columns.map((column) => column.name));
  const userColumns = ['first_name', 'last_name', 'patronymic', 'region', 'city'];
  for (const column of userColumns) {
    if (!columnNames.has(column)) {
      sqliteDb.exec(`ALTER TABLE users ADD COLUMN ${column} TEXT`);
    }
  }

  const ensureColumnsSync = (table, desired) => {
    const cols = sqliteDb.prepare(`PRAGMA table_info(${table})`).all();
    const names = new Set(cols.map((column) => column.name));
    for (const entry of desired) {
      if (!names.has(entry.name)) {
        sqliteDb.exec(`ALTER TABLE ${table} ADD COLUMN ${entry.name} ${entry.def}`);
      }
    }
  };

  ensureColumnsSync('appointments', [{ name: 'service_ids', def: 'TEXT' }]);
  ensureColumnsSync('service_records', [{ name: 'appointment_id', def: 'TEXT' }]);
  ensureColumnsSync('services', [{ name: 'is_active', def: 'INTEGER DEFAULT 1' }]);
  ensureColumnsSync('service_stations', [
    { name: 'city', def: 'TEXT' },
    { name: 'region', def: 'TEXT' },
  ]);

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      is_revoked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)');
  sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)');

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  sqliteDb.exec(
    'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)'
  );
  sqliteDb.exec(
    'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash)'
  );
};

const createSqliteAdapter = (sqliteDb) => ({
  prepare: (sql) => {
    const statement = sqliteDb.prepare(sql);
    return {
      all: (...params) => statement.all(...params),
      get: (...params) => statement.get(...params),
      run: (...params) => statement.run(...params),
    };
  },
  close: () => {
    sqliteDb.close();
  },
});

const splitSqlStatements = (sql) =>
  sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

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
  for (const column of columns) {
    if (!columnNames.has(column.name)) {
      await client.query(`ALTER TABLE users ADD COLUMN ${column.name} ${column.def}`);
    }
  }
};

const ensureTableColumns = async (client, tableName, columns) => {
  const existing = await client.query(`PRAGMA table_info(${tableName})`);
  const columnNames = new Set((existing.results || []).map((column) => column.name));
  for (const column of columns) {
    if (!columnNames.has(column.name)) {
      await client.query(`ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.def}`);
    }
  }
};

const ensureRefreshTokensTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      is_revoked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)'
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)'
  );
};

const ensurePasswordResetTokensTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)'
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash)'
  );
};

const ensureSchema = async (client) => {
  const schemaPath = path.join(__dirname, '..', '..', 'd1_schema.sql');
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    if (sql && typeof sql === 'string') {
      const statements = splitSqlStatements(sql);
      for (const statement of statements) {
        await client.query(statement);
      }
    }
  }
  await ensureUserColumns(client);
  await ensureTableColumns(client, 'appointments', [{ name: 'service_ids', def: 'TEXT' }]);
  await ensureTableColumns(client, 'service_records', [{ name: 'appointment_id', def: 'TEXT' }]);
  await ensureTableColumns(client, 'services', [{ name: 'is_active', def: 'INTEGER DEFAULT 1' }]);
  await ensureTableColumns(client, 'service_stations', [
    { name: 'city', def: 'TEXT' },
    { name: 'region', def: 'TEXT' },
  ]);
  await ensureRefreshTokensTable(client);
  await ensurePasswordResetTokensTable(client);
};

const createDbAdapter = (client, readyPromise) => {
  let fallbackAdapter = null;

  return {
    prepare: (sql) => {
      const d1Mode =
        process.env.NODE_ENV === 'production'
          ? 'strict'
          : (getEnv('D1_MODE') || 'fallback').toLowerCase();

      const shouldFallback = (err) => {
        if (d1Mode !== 'fallback') return false;
        if (!err) return true;
        const message = String(err && err.message ? err.message : err).toLowerCase();
        return (
          message.includes('fetch failed') ||
          message.includes('socket') ||
          message.includes('econnreset') ||
          message.includes('und_err_socket') ||
          message.includes('enotfound') ||
          message.includes('timed out') ||
          message.includes('timeout') ||
          message.includes('authentication') ||
          message.includes('invalid') ||
          message.includes('d1 query failed')
        );
      };

      const getFallbackAdapter = () => {
        if (fallbackAdapter) return fallbackAdapter;
        const sqliteDb = createSqliteDbSync();
        if (sqliteDb) {
          ensureSchemaSqliteSync(sqliteDb);
          fallbackAdapter = createSqliteAdapter(sqliteDb);
        } else {
          fallbackAdapter = createMemoryDb();
        }
        return fallbackAdapter;
      };

      const runWithFallback = async (method, params, mapResult) => {
        try {
          await readyPromise;
          const result = await client.query(sql, params);
          return mapResult(result);
        } catch (err) {
          if (!shouldFallback(err)) {
            throw err;
          }
          const adapter = getFallbackAdapter();
          return adapter.prepare(sql)[method](...params);
        }
      };

      return {
        all: async (...params) => runWithFallback('all', params, (result) => result.results || []),
        get: async (...params) =>
          runWithFallback('get', params, (result) => (result.results || [])[0]),
        run: async (...params) => runWithFallback('run', params, (result) => result.meta || result),
      };
    },
  };
};

const initDb = (dbId = null) => {
  const config = getD1Config(dbId);
  if (!config) {
    const sqliteDb = createSqliteDbSync();
    if (sqliteDb) {
      ensureSchemaSqliteSync(sqliteDb);
      return createSqliteAdapter(sqliteDb);
    }
    return createMemoryDb();
  }

  const client = createD1Client(config);
  const readyPromise = dbId ? Promise.resolve() : ensureSchema(client);
  return createDbAdapter(client, readyPromise);
};

const getDb = () => {
  if (!dbInstancePromise) {
    dbInstancePromise = initDb();
  }
  return dbInstancePromise;
};

const getRegistryDb = async () => {
  const registryId =
    getEnv('CLOUDFLARE_D1_DATABASE_ID_REGISTRY') || '9bfb63b3-de8e-4028-a00f-031203462c34';
  return initDb(registryId);
};

const resetDb = async () => {
  if (dbInstancePromise && typeof dbInstancePromise.close === 'function') {
    try {
      dbInstancePromise.close();
    } catch (_) {
      // ignore
    }
  }
  dbInstancePromise = null;
};

const getExistingColumn = async (tableName, candidates) => {
  if (!tableName || !Array.isArray(candidates)) {
    throw new Error('Invalid table or candidate list');
  }
  const db = await getDb();
  const columns = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  const columnNames = new Set(columns.map((column) => column.name));
  const existing = candidates.find((candidate) => columnNames.has(candidate));
  if (existing) {
    return existing;
  }
  if (candidates.length > 0) {
    return candidates[0];
  }
  return null;
};

module.exports = {
  getDb,
  getRegistryDb,
  resetDb,
  getExistingColumn,
};
