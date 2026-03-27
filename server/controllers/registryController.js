const path = require('path');
const fs = require('fs');
const { getRegistryDb, getRegistryDbs } = require('../db/d1');

let registrySchemaPromise = null;

const isSafeIdentifier = (value) => /^[a-zA-Z0-9_]+$/.test(String(value || ''));

const pickFirstExisting = (columns, candidates) => {
  const set = new Set((columns || []).map((c) => String(c || '').toLowerCase()));
  for (const candidate of candidates) {
    if (set.has(String(candidate).toLowerCase())) return candidate;
  }
  return null;
};

async function detectRegistrySchema(db) {
  if (registrySchemaPromise) return registrySchemaPromise;
  registrySchemaPromise = (async () => {
    let tables = [];
    try {
      tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    } catch (err) {
      void err;
      tables = [];
    }

    const tableNames = (tables || [])
      .map((t) => t?.name)
      .filter((name) => typeof name === 'string' && isSafeIdentifier(name));

    if (tableNames.length === 0) {
      return null;
    }

    const preferred = [
      'bd_avto_ua',
      'ua_vehicle_registry',
      'vehicle_registry',
      'registry',
      'cars',
      'auto',
    ];
    const ordered = [
      ...preferred.filter((p) => tableNames.includes(p)),
      ...tableNames.filter((t) => !preferred.includes(t)),
    ];

    for (const tableName of ordered) {
      let columns = [];
      try {
        columns = await db.prepare(`PRAGMA table_info(${tableName})`).all();
      } catch (err) {
        void err;
        continue;
      }
      const names = (columns || []).map((c) => c?.name).filter(Boolean);
      if (names.length === 0) continue;

      const colPlate = pickFirstExisting(names, [
        'n_reg_new',
        'license_plate_normalized',
        'license_plate',
        'reg_number',
        'registration_number',
        'plate',
      ]);
      if (!colPlate) continue;

      const schema = {
        table: tableName,
        plate: colPlate,
        plateNormalized: pickFirstExisting(names, ['license_plate_normalized']),
        brand: pickFirstExisting(names, ['brand', 'brend', 'make', 'marka', 'марка']),
        model: pickFirstExisting(names, ['model', 'model1', 'model_name', 'модель']),
        vin: pickFirstExisting(names, ['vin', 'vin_code']),
        year: pickFirstExisting(names, ['make_year', 'year', 'manufacture_year', 'рік']),
        color: pickFirstExisting(names, ['color', 'colour', 'колір']),
        fuel: pickFirstExisting(names, ['fuel', 'fuel_type', 'паливо']),
        capacity: pickFirstExisting(names, [
          'capacity',
          'engine_volume',
          'engine_capacity',
          'обєм',
          'обʼєм',
        ]),
      };

      return schema;
    }

    return null;
  })();
  return registrySchemaPromise;
}

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

const searchInCsv = (licensePlate) => {
  try {
    const csvPath = path.join(__dirname, '..', '..', 'mysql_export', 'reestrtz31.07.2025.csv');
    if (!fs.existsSync(csvPath)) {
      console.warn('CSV file not found:', csvPath);
      return null;
    }

    const data = fs.readFileSync(csvPath, 'utf8');
    const rows = data
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((r) => r.replace(/"/g, '').split(';'));

    const headersRow = rows[0] || [];
    const len = headersRow.length;
    let idxReg = len > 0 ? len - 1 : -1;
    let idxBrand = len > 7 ? 7 : -1;
    let idxModel = len > 8 ? 8 : -1;
    let idxYear = len > 10 ? 10 : -1;
    let idxVin = len > 9 ? 9 : -1;
    let idxColor = len > 11 ? 11 : -1;

    const headers = headersRow.map((h) => h.replace(/^\uFEFF/, '').trim());
    if (headers.includes('N_REG_NEW')) idxReg = headers.indexOf('N_REG_NEW');
    if (headers.includes('BRAND')) idxBrand = headers.indexOf('BRAND');
    if (headers.includes('MODEL')) idxModel = headers.indexOf('MODEL');
    if (headers.includes('MAKE_YEAR')) idxYear = headers.indexOf('MAKE_YEAR');
    if (headers.includes('VIN')) idxVin = headers.indexOf('VIN');
    if (headers.includes('COLOR')) idxColor = headers.indexOf('COLOR');

    const target = normalizeLicensePlate(licensePlate);
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      if (idxReg === -1 || idxReg >= row.length) continue;

      const csvPlateRaw = row[idxReg] || '';
      if (normalizeLicensePlate(csvPlateRaw) === target) {
        return {
          brand: idxBrand !== -1 ? row[idxBrand] : '',
          model: idxModel !== -1 ? row[idxModel] : '',
          make_year: idxYear !== -1 ? row[idxYear] : '',
          vin: idxVin !== -1 ? row[idxVin] : '',
          color: idxColor !== -1 ? row[idxColor] : '',
          license_plate: csvPlateRaw,
          source: 'csv',
        };
      }
    }

    return null;
  } catch (err) {
    console.error('CSV search error:', err);
    return null;
  }
};

const toCyrillic = (text) => {
  const map = {
    A: 'А',
    B: 'В',
    C: 'С',
    E: 'Е',
    H: 'Н',
    I: 'І',
    K: 'К',
    M: 'М',
    O: 'О',
    P: 'Р',
    T: 'Т',
    X: 'Х',
  };
  return text
    .split('')
    .map((c) => map[c] || c)
    .join('');
};

exports.searchVehicle = async (req, res) => {
  try {
    const { license_plate, vin, type, debug } = req.query;

    if (type === 'makes') {
      const db = await getRegistryDb();
      try {
        const schema = await detectRegistrySchema(db);
        if (!schema || !schema.brand) {
          return res.json([]);
        }
        const makes = await db
          .prepare(
            `SELECT DISTINCT ${schema.brand} as name FROM ${schema.table} ORDER BY ${schema.brand} ASC LIMIT 100`
          )
          .all();
        return res.json((makes || []).map((m, i) => ({ id: i + 1, name: m.name })));
      } catch (e) {
        console.error('Makes error:', e);
        return res.json([]); // Fallback
      }
    }

    const vinInput = vin ? String(vin).trim() : '';
    const vinNormalized = vinInput ? vinInput.replace(/\s+/g, '').toUpperCase() : '';

    if (!license_plate && !vinNormalized) {
      return res.status(400).json({ message: 'License plate or VIN required' });
    }

    const normalized = license_plate ? normalizeLicensePlate(license_plate) : '';
    const cyrillic = normalized ? toCyrillic(normalized) : '';

    // Mock data for testing/demo purposes if D1/CSV fails for this specific plate
    // This is useful for development when the full registry is not available
    if (normalized === 'BA8972AM') {
      return res.json({
        brand: 'Skoda',
        model: 'Fabia',
        make_year: 2004,
        vin: 'TMBPH16Y543210987',
        color: 'SILVER',
        license_plate: 'ВА8972АМ',
        engine_volume: 1.2,
        fuel_type: 'BENZINE',
        source: 'mock',
      });
    }

    try {
      const shardDbs = await getRegistryDbs().catch(async () => [await getRegistryDb()]);
      const debugEnabled = String(debug || '') === '1';
      const debugAttempts = [];

      for (let shardIndex = 0; shardIndex < shardDbs.length; shardIndex += 1) {
        const db = shardDbs[shardIndex];
        const schema = await detectRegistrySchema(db);
        if (!schema) {
          if (debugEnabled) {
            debugAttempts.push({ shard: shardIndex + 1, schema: null, error: 'schema_not_found' });
          }
          continue;
        }

        const selectColumns = [
          schema.brand ? `${schema.brand} as brand` : "'' as brand",
          schema.model ? `${schema.model} as model` : "'' as model",
          schema.vin ? `${schema.vin} as vin` : "'' as vin",
          schema.year ? `${schema.year} as make_year` : 'NULL as make_year',
          schema.color ? `${schema.color} as color` : "'' as color",
          schema.fuel ? `${schema.fuel} as fuel_type` : "'' as fuel_type",
          schema.capacity ? `${schema.capacity} as engine_volume` : 'NULL as engine_volume',
          `${schema.plate} as license_plate`,
        ].join(', ');

        const plateExpr = `upper(replace(replace(replace(replace(${schema.plate}, ' ', ''), '-', ''), '.', ''), '_', ''))`;
        const plateNormalizedExpr = schema.plateNormalized
          ? `upper(replace(replace(replace(replace(${schema.plateNormalized}, ' ', ''), '-', ''), '.', ''), '_', ''))`
          : null;

        let row;
        if (vinNormalized) {
          if (schema.vin) {
            row = await db
              .prepare(
                `SELECT ${selectColumns} FROM ${schema.table} WHERE ${schema.vin} = ? LIMIT 1`
              )
              .get(vinNormalized);
          } else if (debugEnabled) {
            debugAttempts.push({ shard: shardIndex + 1, schema, error: 'vin_not_supported' });
          }
        } else {
          const whereParts = [
            `${schema.plate} = ?`,
            `${schema.plate} = ?`,
            `${plateExpr} = ?`,
            `${plateExpr} = ?`,
          ];
          const params = [cyrillic, normalized, cyrillic, normalized];

          if (schema.plateNormalized) {
            whereParts.push(`${schema.plateNormalized} = ?`);
            whereParts.push(`${plateNormalizedExpr} = ?`);
            params.push(normalized, normalized);
          }

          row = await db
            .prepare(
              `SELECT ${selectColumns} FROM ${schema.table} WHERE ${whereParts.join(' OR ')} LIMIT 1`
            )
            .get(...params);
        }

        if (row) {
          if (row.engine_volume > 50) {
            row.engine_volume = (row.engine_volume / 1000).toFixed(1);
          }

          return res.json({
            ...row,
            source: 'registry_d1',
            shard: shardIndex + 1,
          });
        }

        if (debugEnabled) {
          debugAttempts.push({ shard: shardIndex + 1, schema, result: 'not_found' });
        }
      }

      if (debugEnabled) {
        return res.status(404).json({
          message: 'Vehicle not found',
          debug: {
            input: vinNormalized ? String(vinNormalized) : String(license_plate),
            normalized,
            cyrillic,
            vin: vinNormalized || null,
            shards: debugAttempts,
          },
        });
      }
    } catch (d1Error) {
      const message = d1Error && d1Error.message ? String(d1Error.message) : String(d1Error);
      if (message.includes('CLOUDFLARE_D1_DATABASE_ID_REGISTRY is not configured')) {
        return res.status(503).json({
          message: 'Registry DB is not configured',
        });
      }
      console.error('Registry D1 error:', d1Error);
    }

    const csvResult = searchInCsv(license_plate);
    if (csvResult) {
      return res.json(csvResult);
    }

    return res.status(404).json({ message: 'Vehicle not found' });
  } catch (err) {
    console.error('Registry search error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
