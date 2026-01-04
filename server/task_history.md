# Історія змін проекту

| Дата       | Зміни                                                                 | Посилання                                     |
|------------|-----------------------------------------------------------------------|-----------------------------------------------|
| 2025-04-04 | Створення файлу історії задач                                        | [task_history.md](./task_history.md)          |
| 2025-04-04 | Додано тестові дані для автентифікації                               | [testdata.json](./testdata.json)              |
| 2025-04-04 | Реалізовано скрипти для перевірки даних у Supabase                   | [checkSupabaseData.js](./scripts/checkSupabaseData.js) |
| 2025-04-04 | Додано генерацію випадкових тестових записів користувачів та транспорту | [checkSupabaseData.js](./scripts/checkSupabaseData.js) |
| 2025-04-04 | Реалізовано контроль доступу за ролями на рівні додатку | [auth.js](./middleware/auth.js), [checkSupabaseData.js](./scripts/checkSupabaseData.js) |
| 2025-04-04 | Налаштовано підключення до бази даних                                | [db.js](./config/db.js)                       |
| 2025-04-05 | Впроваджено систему контрольних сум для оптимізації тестування          | [checksumGenerator.cjs](./scripts/checksumGenerator.cjs) |
| 2025-04-05 | Інтеграція перевірки змін файлів у головний тестовий скрипт             | [checkSupabaseData.cjs](./scripts/checkSupabaseData.cjs) |