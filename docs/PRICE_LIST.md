# Прайс послуг (ціна/час)

Цей проєкт зберігає базовий прайс у таблиці `services`:

- `price` (грн, опційно)
- `duration` (хв, опційно)
- `price_text` (TEXT, опційно) — ціна як текст (діапазони, погодинно, примітки)
- `duration_text` (TEXT, опційно) — час/умови як текст

Для механіків також є можливість задавати оверрайди для конкретного механіка в `mechanic_services`:

- `price_override`
- `duration_override`

## Імпорт прайсу з фото

Скрипт: `server/scripts/seed_price_list.js`

Запуск:

```bash
cd server
node scripts/seed_price_list.js
```

Що робить:

- створює категорії в `service_categories` (якщо їх нема)
- додає/оновлює послуги в `services` (ідемпотентно за назвою + категорією)
- заповнює `price_text`/`duration_text` і (де можливо) `price`/`duration`

Примітки:

- Діапазони типу "від 250-600" зберігаються у `price_text` (щоб не губити сенс).
- Для погодинних робіт використовується `price_text` з `грн/год` + `duration_text`.
