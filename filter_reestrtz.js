const fs = require('fs');
const path = require('path');
const readline = require('readline');

const inputPath = path.join(__dirname, 'reestrtz31.12.2025.csv');
const outputPath = path.join(__dirname, 'reestrtz31.12.2025.legkovi.csv');

const rl = readline.createInterface({
  input: fs.createReadStream(inputPath, { encoding: 'utf8' })
});

const out = fs.createWriteStream(outputPath, { encoding: 'utf8' });

let lineNo = 0;
let kept = 0;
let removed = 0;

rl.on('line', line => {
  lineNo += 1;

  if (lineNo === 1) {
    out.write(line + '\n');
    return;
  }

  if (!line.trim()) {
    return;
  }

  if (!line.includes(';"ЛЕГКОВИЙ";')) {
    removed += 1;
    return;
  }

  kept += 1;
  out.write(line + '\n');
});

rl.on('close', () => {
  out.end(() => {
    console.log('Фільтрація завершена. Залишено легкових записів:', kept, 'Видалено інших записів:', removed);
    console.log('Вихідний файл:', inputPath);
    console.log('Відфільтрований файл:', outputPath);
  });
});
