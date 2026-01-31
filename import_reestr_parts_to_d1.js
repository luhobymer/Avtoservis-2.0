const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DB_NAME = 'bd_avto_ua';
const DEFAULT_BASE_NAME = 'reestrtz31.12.2025.legkovi.min';

function getBaseDir() {
  const arg = process.argv[2];
  if (arg && arg.trim().length > 0) {
    return path.resolve(arg);
  }
  return process.cwd();
}

function findPartFiles(dir) {
  const base = DEFAULT_BASE_NAME;
  const partFiles = [];

  for (let i = 1; i <= 3; i += 1) {
    const filePath = path.join(dir, `${base}.part${i}.sql`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Файл не знайдено: ${filePath}`);
    }
    partFiles.push(filePath);
  }

  return partFiles;
}

function executeSqlFile(filePath) {
  console.log(`Імпорт файлу: ${filePath}`);

  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--yes', '--file', filePath],
    {
      stdio: 'pipe',
      shell: false,
      encoding: 'utf8',
    }
  );

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    throw new Error(`Помилка імпорту файлу: ${filePath}`);
  }
}

function main() {
  try {
    const dir = getBaseDir();
    const files = findPartFiles(dir);

    files.forEach((filePath, index) => {
      console.log(`Початок імпорту частини ${index + 1} з ${files.length}`);
      executeSqlFile(filePath);
      console.log(`Частина ${index + 1} успішно імпортована`);
    });

    console.log('Імпорт усіх частин завершено успішно');
    process.exit(0);
  } catch (err) {
    console.error('Помилка імпорту в D1:', err.message || err);
    process.exit(1);
  }
}

main();
