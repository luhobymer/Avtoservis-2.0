const fs = require('fs');
const path = require('path');
const readline = require('readline');

try {
  const dotenv = require('dotenv');
  const rootEnv = path.join(__dirname, '..', '..', '.env');
  const serverEnv = path.join(__dirname, '..', '.env');
  if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
  if (fs.existsSync(serverEnv)) dotenv.config({ path: serverEnv, override: false });
} catch (err) {
  void err;
}

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = {
    dir: path.join(__dirname, '..', '..', 'reestr'),
    outDir: path.join(__dirname, '..', '..', 'exports'),
    outPrefix: 'ua_vehicle_registry',
    limit: 0,
    insertBatch: 200,
    shards: 4,
    maxRowsPerFile: 200000,
    withTransaction: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--dir' && args[i + 1]) {
      out.dir = args[i + 1];
      i += 1;
      continue;
    }
    if (a === '--out' && args[i + 1]) {
      out.outDir = args[i + 1];
      i += 1;
      continue;
    }
    if (a === '--out-prefix' && args[i + 1]) {
      out.outPrefix = String(args[i + 1] || '').trim() || out.outPrefix;
      i += 1;
      continue;
    }
    if (a === '--limit' && args[i + 1]) {
      out.limit = Math.max(0, Number(args[i + 1]) || 0);
      i += 1;
      continue;
    }
    if (a === '--insert-batch' && args[i + 1]) {
      out.insertBatch = Math.max(1, Math.min(500, Number(args[i + 1]) || 200));
      i += 1;
      continue;
    }
    if (a === '--max-rows-per-file' && args[i + 1]) {
      out.maxRowsPerFile = Math.max(1000, Number(args[i + 1]) || 200000);
      i += 1;
      continue;
    }
    if (a === '--with-transaction') {
      out.withTransaction = true;
      continue;
    }
    if (a === '--shards' && args[i + 1]) {
      out.shards = Math.max(1, Math.min(16, Number(args[i + 1]) || 4));
      i += 1;
      continue;
    }
  }

  return out;
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

const sqlString = (value) => {
  if (value === null || value === undefined) return 'NULL';
  const s = String(value);
  if (!s) return 'NULL';
  return `'${s.replace(/'/g, "''")}'`;
};

const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
};

const ensureDirectory = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const listCsvFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => name.toLowerCase().endsWith('.csv') || name.toLowerCase().endsWith('.сsv'))
    .map((name) => path.join(dir, name))
    .sort((a, b) => a.localeCompare(b));
};

const fnv1a32 = (input) => {
  let hash = 0x811c9dc5;
  const s = String(input || '');
  for (let i = 0; i < s.length; i += 1) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const shardIndexForPlate = (plateNormalized, shards) => {
  const h = fnv1a32(plateNormalized);
  const mod = Number(shards) > 0 ? Number(shards) : 1;
  return h % mod;
};

const writePreamble = (stream, withTransaction) => {
  if (withTransaction) {
    stream.write('BEGIN TRANSACTION;\n');
  }
  stream.write(
    'CREATE TABLE IF NOT EXISTS ua_vehicle_registry (\n' +
      '  n_reg_new TEXT PRIMARY KEY,\n' +
      '  d_reg TEXT,\n' +
      '  brand TEXT,\n' +
      '  model1 TEXT,\n' +
      '  vin TEXT,\n' +
      '  make_year TEXT,\n' +
      '  color TEXT,\n' +
      '  fuel TEXT,\n' +
      '  capacity TEXT,\n' +
      '  license_plate_normalized TEXT\n' +
      ');\n'
  );
  stream.write(
    'CREATE INDEX IF NOT EXISTS idx_ua_vehicle_registry_plate_norm ON ua_vehicle_registry(license_plate_normalized);\n'
  );
  stream.write(
    'CREATE INDEX IF NOT EXISTS idx_ua_vehicle_registry_vin ON ua_vehicle_registry(vin);\n'
  );
};

const writeCommit = (stream, withTransaction) => {
  if (withTransaction) {
    stream.write('COMMIT;\n');
  }
};

async function main() {
  const opts = parseArgs();
  if (!fs.existsSync(opts.dir)) {
    throw new Error(`Directory not found: ${opts.dir}`);
  }

  const files = listCsvFiles(opts.dir);
  if (files.length === 0) {
    throw new Error(`No CSV files found in: ${opts.dir}`);
  }

  ensureDirectory(opts.outDir);

  const shardCount = Number(opts.shards) > 0 ? Number(opts.shards) : 1;
  const pad3 = (n) => String(n).padStart(3, '0');

  const outs = Array.from({ length: shardCount }, (_, idx) => {
    const shardNo = idx + 1;
    const partNo = 1;
    const outFile = path.join(opts.outDir, `${opts.outPrefix}_part${shardNo}_${pad3(partNo)}.sql`);
    ensureDir(outFile);
    const stream = fs.createWriteStream(outFile, { encoding: 'utf8' });
    writePreamble(stream, opts.withTransaction);
    return {
      idx,
      shardNo,
      partNo,
      outFile,
      stream,
      batch: [],
      emitted: 0,
      emittedInFile: 0,
      files: [outFile],
    };
  });

  let total = 0;

  const flushShard = (shard) => {
    if (!shard || shard.batch.length === 0) return;
    shard.stream.write(
      'INSERT OR IGNORE INTO ua_vehicle_registry (n_reg_new, d_reg, brand, model1, vin, make_year, color, fuel, capacity, license_plate_normalized) VALUES\n'
    );
    shard.stream.write(`${shard.batch.join(',\n')};\n`);
    shard.emitted += shard.batch.length;
    shard.emittedInFile += shard.batch.length;
    shard.batch.length = 0;
  };

  const rotateShardFileIfNeeded = (shard) => {
    if (!shard) return;
    const maxRows = Number(opts.maxRowsPerFile) > 0 ? Number(opts.maxRowsPerFile) : 0;
    if (!maxRows) return;

    if (shard.emittedInFile < maxRows) return;

    flushShard(shard);
    writeCommit(shard.stream, opts.withTransaction);
    shard.stream.end();

    shard.partNo += 1;
    shard.emittedInFile = 0;
    shard.outFile = path.join(
      opts.outDir,
      `${opts.outPrefix}_part${shard.shardNo}_${pad3(shard.partNo)}.sql`
    );
    ensureDir(shard.outFile);
    shard.stream = fs.createWriteStream(shard.outFile, { encoding: 'utf8' });
    writePreamble(shard.stream, opts.withTransaction);
    shard.files.push(shard.outFile);
  };

  const flushAll = () => {
    for (const shard of outs) flushShard(shard);
  };

  for (const filePath of files) {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    let headers = null;
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

      const record = {
        n_reg_new: plateRaw,
        d_reg: String(row.D_REG || '').trim(),
        brand: String(row.BRAND || '').trim(),
        model1: String(row.MODEL || '').trim(),
        vin: String(row.VIN || '')
          .trim()
          .toUpperCase(),
        make_year: String(row.MAKE_YEAR || '').trim(),
        color: String(row.COLOR || '').trim(),
        fuel: String(row.FUEL || '').trim(),
        capacity: String(row.CAPACITY || '').trim(),
        license_plate_normalized: normalizeLicensePlate(plateRaw),
      };

      const shardIdx = shardIndexForPlate(record.license_plate_normalized, shardCount);
      const shard = outs[shardIdx];
      shard.batch.push(
        `(${sqlString(record.n_reg_new)}, ${sqlString(record.d_reg)}, ${sqlString(record.brand)}, ${sqlString(record.model1)}, ${sqlString(record.vin)}, ${sqlString(record.make_year)}, ${sqlString(record.color)}, ${sqlString(record.fuel)}, ${sqlString(record.capacity)}, ${sqlString(record.license_plate_normalized)})`
      );

      total += 1;
      if (opts.limit > 0 && total >= opts.limit) {
        break;
      }

      if (shard.batch.length >= opts.insertBatch) {
        flushShard(shard);
        rotateShardFileIfNeeded(shard);
      }
    }

    if (opts.limit > 0 && total >= opts.limit) {
      break;
    }
  }

  flushAll();

  for (const shard of outs) {
    writeCommit(shard.stream, opts.withTransaction);
    shard.stream.end();
  }

  const emittedTotal = outs.reduce((acc, s) => acc + (s.emitted || 0), 0);
  const outFiles = outs.flatMap((s) => s.files || []);
  // eslint-disable-next-line no-console
  console.log(
    `[registry-sql] DONE shards=${shardCount} files=${files.length} rows_read=${total} rows_emitted=${emittedTotal} out=${outFiles.join(', ')}`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[registry-sql] FAILED:', err);
  process.exitCode = 1;
});
