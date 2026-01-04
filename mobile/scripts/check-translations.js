const fs = require('fs');
const path = require('path');

// Шляхи до файлів локалізації
const localesPath = path.join(__dirname, '..', 'locales');
const languages = ['uk', 'ru', 'en'];

// Функція для отримання всіх ключів з об'єкта (рекурсивно)
function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const newPrefix = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = [...keys, ...getAllKeys(obj[key], newPrefix)];
    } else {
      keys.push(newPrefix);
    }
  }
  return keys;
}

// Функція для порівняння перекладів
function compareTranslations() {
  const translations = {};
  const issues = [];

  // Завантаження всіх файлів перекладів
  for (const lang of languages) {
    const filePath = path.join(localesPath, lang, 'translation.json');
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      translations[lang] = JSON.parse(content);
    } catch (error) {
      console.error(`Помилка читання файлу ${filePath}:`, error);
      process.exit(1);
    }
  }

  // Отримання всіх ключів для кожної мови
  const allKeys = {};
  for (const lang of languages) {
    allKeys[lang] = getAllKeys(translations[lang]);
  }

  // Перевірка наявності всіх ключів у всіх мовах
  const uniqueKeys = [...new Set(Object.values(allKeys).flat())];

  for (const key of uniqueKeys) {
    for (const lang of languages) {
      const keyParts = key.split('.');
      let current = translations[lang];
      let isMissing = false;

      // Перевірка наявності ключа
      for (const part of keyParts) {
        if (current && current.hasOwnProperty(part)) {
          current = current[part];
        } else {
          isMissing = true;
          break;
        }
      }

      if (isMissing) {
        issues.push(`Відсутній переклад для ключа "${key}" в мові ${lang}`);
      } else if (typeof current !== 'string') {
        issues.push(`Некоректний тип значення для ключа "${key}" в мові ${lang}`);
      } else if (!current.trim()) {
        issues.push(`Порожній переклад для ключа "${key}" в мові ${lang}`);
      }
    }
  }

  // Виведення результатів
  if (issues.length > 0) {
    console.log('\nЗнайдено проблеми з перекладами:');
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
    process.exit(1);
  } else {
    console.log('\nПеревірку перекладів завершено успішно! Проблем не знайдено.');
  }
}

// Запуск перевірки
console.log('Початок перевірки перекладів...');
compareTranslations();