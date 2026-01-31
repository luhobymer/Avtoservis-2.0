const fs = require('fs');
const path = require('path');
const readline = require('readline');

const INPUT_FILE = path.join(__dirname, 'reestrtz31.12.2025.legkovi.min.csv');
const PARTS_COUNT = 3;

async function splitFile() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('Вхідний файл не знайдено:', INPUT_FILE);
    process.exit(1);
  }

  console.log('Підрахунок рядків у файлі...');

  let header = null;
  let totalDataLines = 0;

  const inputForCounting = fs.createReadStream(INPUT_FILE);
  const rlCount = readline.createInterface({
    input: inputForCounting,
    crlfDelay: Infinity
  });

  for await (const line of rlCount) {
    if (header === null) {
      header = line;
    } else if (line.trim().length > 0) {
      totalDataLines += 1;
    }
  }

  rlCount.close();

  if (!header) {
    console.error('Файл не містить заголовка або порожній');
    process.exit(1);
  }

  if (totalDataLines === 0) {
    console.error('Файл не містить рядків з даними');
    process.exit(1);
  }

  const linesPerPart = Math.ceil(totalDataLines / PARTS_COUNT);
  console.log(`Загальна кількість рядків з даними: ${totalDataLines}`);
  console.log(`Рядків на частину (приблизно): ${linesPerPart}`);

  const writers = [];
  for (let i = 0; i < PARTS_COUNT; i++) {
    const partPath = path.join(
      __dirname,
      `reestrtz31.12.2025.legkovi.min.part${i + 1}.csv`
    );
    const writer = fs.createWriteStream(partPath, { encoding: 'utf8' });
    writers.push(writer);
  }

  const inputForSplit = fs.createReadStream(INPUT_FILE);
  const rlSplit = readline.createInterface({
    input: inputForSplit,
    crlfDelay: Infinity
  });

  let dataLineIndex = 0;
  let isHeaderWritten = false;

  for await (const line of rlSplit) {
    if (!isHeaderWritten) {
      for (const writer of writers) {
        writer.write(line + '\n');
      }
      isHeaderWritten = true;
      continue;
    }

    if (line.trim().length === 0) continue;

    const partIndex = Math.min(
      Math.floor(dataLineIndex / linesPerPart),
      PARTS_COUNT - 1
    );

    writers[partIndex].write(line + '\n');
    dataLineIndex += 1;
  }

  rlSplit.close();

  for (const writer of writers) {
    writer.end();
  }

  console.log('Готово. Файл розділено на три частини:');
  for (let i = 0; i < PARTS_COUNT; i++) {
    const partPath = path.join(
      __dirname,
      `reestrtz31.12.2025.legkovi.min.part${i + 1}.csv`
    );
    const stats = fs.statSync(partPath);
    console.log(
      `Частина ${i + 1}: ${partPath} — ${(stats.size / (1024 * 1024)).toFixed(
        2
      )} MB`
    );
  }
}

splitFile().catch((err) => {
  console.error('Помилка при розділенні файлу:', err);
  process.exit(1);
});

