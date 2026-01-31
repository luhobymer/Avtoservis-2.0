const path = require('path');
const fs = require('fs');
const { getRegistryDb } = require('../db/d1');

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

exports.searchVehicle = async (req, res) => {
  try {
    const { license_plate, type } = req.query;

    if (type === 'makes') {
      const db = await getRegistryDb();
      try {
        const makes = await db
          .prepare(
            'SELECT DISTINCT BRAND as name FROM ua_vehicle_registry ORDER BY BRAND ASC LIMIT 100'
          )
          .all();
        return res.json(makes.map((m, i) => ({ id: i + 1, name: m.name })));
      } catch (e) {
        return res.json([]); // Fallback
      }
    }

    if (!license_plate) {
      return res.status(400).json({ message: 'License plate required' });
    }

    const normalized = normalizeLicensePlate(license_plate);

    try {
      const db = await getRegistryDb();
      const row = await db
        .prepare(
          'SELECT "BRAND" as brand, "MODEL" as model, "VIN" as vin, "MAKE_YEAR" as make_year, "COLOR" as color, "N_REG_NEW" as n_reg_new, license_plate_normalized FROM ua_vehicle_registry WHERE license_plate_normalized = ? LIMIT 1'
        )
        .get(normalized);

      if (row) {
        return res.json({
          ...row,
          source: 'registry_d1',
        });
      }
    } catch (d1Error) {
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
