const fs = require('fs');
const readline = require('readline');
const path = require('path');

const inputPath = path.join(__dirname, 'reestrtz31.12.2025.legkovi.csv');
const outputPath = path.join(__dirname, 'reestrtz31.12.2025.legkovi.min.csv');

const rl = readline.createInterface({
  input: fs.createReadStream(inputPath, { encoding: 'utf8' })
});

const out = fs.createWriteStream(outputPath, { encoding: 'utf8' });

// Залишаємо тільки: D_REG, BRAND, MODEL, VIN, MAKE_YEAR, COLOR, FUEL, CAPACITY, N_REG_NEW
const keepIndices = [4, 7, 8, 9, 10, 11, 15, 16, 19];

let lineNo = 0;

rl.on('line', line => {
  lineNo += 1;

  if (!line.trim()) {
    return;
  }

  const rawParts = line.split(';');
  if (rawParts.length < 20) {
    if (lineNo === 1) {
      out.write(line + '\n');
    }
    return;
  }

  const cleaned = rawParts.map(v => v.replace(/^"|"$/g, ''));
  const selected = keepIndices.map(i => cleaned[i] ?? '');
  const csvLine = selected.map(v => `"${v}"`).join(';');
  out.write(csvLine + '\n');
});

rl.on('close', () => {
  out.end(() => {
    console.log('Готово. Вихідний файл:', inputPath);
    console.log('Файл з мінімальними колонками:', outputPath);
  });
});
