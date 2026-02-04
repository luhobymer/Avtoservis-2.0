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
| 2026-02-04 | Об'єднано панелі майстра та клієнта в єдиний Dashboard | [Dashboard.jsx](../client/src/pages/Dashboard.jsx) |
| 2026-02-04 | Розділено записи на "Мої записи" (клієнт) та "Робочий графік" (майстер) | [Appointments.jsx](../client/src/pages/Appointments.jsx) |
| 2026-02-04 | Реалізовано завершення запису з фіксацією пробігу та запчастин | [appointmentController.js](./controllers/appointmentController.js) |
| 2026-02-04 | Додано таблицю vehicle_parts та оновлено схему БД | [d1.js](./db/d1.js) |
| 2026-02-04 | Створено сторінку "Мої запчастини" для клієнтів | [MyParts.jsx](../client/src/pages/MyParts.jsx) |
| 2026-02-04 | Інтеграція OCR (Tesseract.js) для зчитування запчастин з фото | [ocrController.js](./controllers/ocrController.js) |
| 2026-02-04 | Додано можливість завантаження фото в "Мої запчастини" та при завершенні запису | [MyParts.jsx](../client/src/pages/MyParts.jsx), [AppointmentDetails.jsx](../client/src/pages/AppointmentDetails.jsx) |
| 2026-02-04 | Додано можливість ручного додавання запчастин клієнтом при створенні запису | [AppointmentDetails.jsx](../client/src/pages/AppointmentDetails.jsx) |
