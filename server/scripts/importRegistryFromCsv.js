const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { getRegistryDb } = require('../db/d1');

try {
  // eslint-disable-next-line global-require
  const dotenv = require('dotenv');
  const rootEnv = path.join(__dirname, '..', '..', '.env');
  const serverEnv = path.join(__dirname, '..', '.env');
  if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
  if (fs.existsSync(serverEnv)) dotenv.config({ path: serverEnv, override: false });
} catch (err) {
  void err;
}

const DEFAULT_CSV_PATH = path.join(__dirname, '..', '..', 'reestrtz31.12.2025.legkovi.min.csv');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = {
    csv: DEFAULT_CSV_PATH,
    dryRun: false,
    batchSize: 500,
    limit: 0,
    table: 'ua_vehicle_registry',
    selectChunkSize: 80,
  };

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--csv' && args[i + 1]) {
      out.csv = args[i + 1];
      i += 1;
      continue;
    }
    if (a === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (a === '--batch' && args[i + 1]) {
      out.batchSize = Math.max(50, Number(args[i + 1]) || 500);
      i += 1;
      continue;
    }
    if (a === '--limit' && args[i + 1]) {
      out.limit = Math.max(0, Number(args[i + 1]) || 0);
      i += 1;
      continue;
    }
    if (a === '--table' && args[i + 1]) {
      out.table = String(args[i + 1] || '').trim() || out.table;
      i += 1;
      continue;
    }
    if (a === '--select-chunk' && args[i + 1]) {
      out.selectChunkSize = Math.max(10, Math.min(200, Number(args[i + 1]) || 80));
      i += 1;
      continue;
    }
  }

  return out;
};

const normalizeLicensePlate = (input) => {
  if (!input) return '';
  const raw = String(input)
    .replace(/[\s\-_.]/g, '')
    .toUpperCase();
  const map = {
    А: 'A',
    В: 'B',
    С: 'C',
    Е: 'E',
    Н: 'H',
    І: 'I',
    К: 'K',
    М: 'M',
    О: 'O',
    Р: 'P',
    Т: 'T',
    Х: 'X',
  };
  return raw
    .split('')
    .map((ch) => map[ch] || ch)
    .join('');
};

const parseCsvLine = (line) => {
  const cells = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === ';') {
      i += 1;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      let value = '';
      while (j < line.length) {
        const c = line[j];
        if (c === '"') {
          break;
        }
        value += c;
        j += 1;
      }
      cells.push(value);
      i = j + 1;
      continue;
    }

    let j = i;
    while (j < line.length && line[j] !== ';') j += 1;
    cells.push(line.slice(i, j));
    i = j + 1;
  }

  return cells;
};

const log = (...args) => {
  if (process.env.SILENT === '1') return;
  // eslint-disable-next-line no-console
  console.log(...args);
};

const detectTableAndColumns = async (db, forcedTable) => {
  const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const names = (tables || []).map((t) => t?.name).filter(Boolean);
  const safeForced = forcedTable ? String(forcedTable).trim() : '';
  if (safeForced && !names.includes(safeForced)) {
    throw new Error(`Requested table not found in registry DB: ${safeForced}`);
  }

  const preferred = ['ua_vehicle_registry', 'bd_avto_ua'];
  const table = safeForced || preferred.find((t) => names.includes(t)) || names[0];
  if (!table) throw new Error('No tables found in registry DB');

  const columns = await db.prepare(`PRAGMA table_info(${table})`).all();
  const colNames = new Set((columns || []).map((c) => c?.name).filter(Boolean));

  const pick = (...candidates) => candidates.find((c) => colNames.has(c)) || null;

  return {
    table,
    cols: {
      d_reg: pick('d_reg', 'D_REG'),
      brand: pick('brand', 'BRAND'),
      model: pick('model1', 'model', 'MODEL'),
      vin: pick('vin', 'VIN'),
      make_year: pick('make_year', 'MAKE_YEAR'),
      color: pick('color', 'COLOR'),
      fuel: pick('fuel', 'FUEL'),
      capacity: pick('capacity', 'CAPACITY'),
      n_reg_new: pick('n_reg_new', 'N_REG_NEW', 'license_plate'),
      license_plate_normalized: pick('license_plate_normalized'),
    },
  };
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function main() {
  const opts = parseArgs();
  if (!fs.existsSync(opts.csv)) {
    throw new Error(`CSV file not found: ${opts.csv}`);
  }

  const db = await getRegistryDb();
  const schema = await detectTableAndColumns(db, opts.table);
  if (!schema?.cols?.n_reg_new) {
    throw new Error(`Registry table ${schema.table} does not have n_reg_new/license plate column`);
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(opts.csv, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let headers = null;
  let processed = 0;
  let inserted = 0;

  const batchRows = [];

  const flush = async () => {
    if (batchRows.length === 0) return;

    const plates = batchRows.map((r) => r.n_reg_new).filter(Boolean);
    const uniquePlates = Array.from(new Set(plates));

    const existing = new Set();
    for (const group of chunk(uniquePlates, opts.selectChunkSize)) {
      const placeholders = group.map(() => '?').join(',');
      const rows = await db
        .prepare(
          `SELECT ${schema.cols.n_reg_new} as n_reg_new FROM ${schema.table} WHERE ${schema.cols.n_reg_new} IN (${placeholders})`
        )
        .all(...group);
      (rows || []).forEach((r) => {
        if (r?.n_reg_new) existing.add(String(r.n_reg_new));
      });
    }

    const missing = batchRows.filter((r) => r.n_reg_new && !existing.has(String(r.n_reg_new)));

    const insertColumns = [];
    const insertValues = [];
    const pushCol = (col, value) => {
      if (!col) return;
      insertColumns.push(col);
      insertValues.push(value);
    };

    if (!opts.dryRun) {
      for (const r of missing) {
        try {
          insertColumns.length = 0;
          insertValues.length = 0;

          pushCol(schema.cols.d_reg, r.d_reg);
          pushCol(schema.cols.brand, r.brand);
          pushCol(schema.cols.model, r.model);
          pushCol(schema.cols.vin, r.vin);
          pushCol(schema.cols.make_year, r.make_year);
          pushCol(schema.cols.color, r.color);
          pushCol(schema.cols.fuel, r.fuel);
          pushCol(schema.cols.capacity, r.capacity);
          pushCol(schema.cols.n_reg_new, r.n_reg_new);
          pushCol(schema.cols.license_plate_normalized, r.license_plate_normalized);

          const placeholders = insertColumns.map(() => '?').join(', ');
          await db
            .prepare(
              `INSERT OR IGNORE INTO ${schema.table}
              (${insertColumns.join(', ')})
              VALUES (${placeholders})`
            )
            .run(...insertValues);
          inserted += 1;
        } catch (err) {
          // Keep import running; duplicates are expected sometimes.
          void err;
        }
      }
    } else {
      inserted += missing.length;
    }

    batchRows.length = 0;

    log(
      `[registry-import] table=${schema.table} processed=${processed} would_insert/inserted=${inserted} (dryRun=${opts.dryRun})`
    );
  };

  for await (const line of rl) {
    if (!line) continue;

    if (!headers) {
      headers = parseCsvLine(line).map((h) => String(h || '').trim());
      continue;
    }

    const cells = parseCsvLine(line);
    if (!cells || cells.length === 0) continue;

    const row = {};
    for (let i = 0; i < headers.length && i < cells.length; i += 1) {
      row[headers[i]] = cells[i];
    }

    const plateRaw = String(row.N_REG_NEW || '').trim();
    if (!plateRaw) continue;

    const item = {
      d_reg: String(row.D_REG || '').trim(),
      brand: String(row.BRAND || '').trim(),
      model: String(row.MODEL || '').trim(),
      vin: String(row.VIN || '')
        .trim()
        .toUpperCase(),
      make_year: String(row.MAKE_YEAR || '').trim(),
      color: String(row.COLOR || '').trim(),
      fuel: String(row.FUEL || '').trim(),
      capacity: String(row.CAPACITY || '').trim(),
      n_reg_new: plateRaw,
      license_plate_normalized: normalizeLicensePlate(plateRaw),
    };

    batchRows.push(item);
    processed += 1;

    if (opts.limit > 0 && processed >= opts.limit) {
      break;
    }

    if (batchRows.length >= opts.batchSize) {
      await flush();
    }
  }

  await flush();

  log(`[registry-import] DONE processed=${processed} inserted=${inserted} dryRun=${opts.dryRun}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[registry-import] FAILED:', err);
  process.exitCode = 1;
});
