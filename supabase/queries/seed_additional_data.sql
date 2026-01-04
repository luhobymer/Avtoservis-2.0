-- Додавання тестових налаштувань сповіщень
INSERT INTO notification_settings (
  user_id,
  email_notifications,
  push_notifications,
  telegram_notifications,
  maintenance_reminders,
  appointment_reminders,
  payment_reminders
)
SELECT 
  id,
  true,
  true,
  true,
  true,
  true,
  true
FROM users;

-- Додавання тестових сповіщень
INSERT INTO notifications (
  user_id,
  title,
  message,
  type,
  status,
  scheduled_for
)
SELECT 
  u.id,
  'Нагадування про ТО',
  'Рекомендуємо провести планове ТО вашого автомобіля',
  'maintenance',
  'pending',
  CURRENT_TIMESTAMP + INTERVAL '1 day'
FROM users u
WHERE u.role = 'client'
LIMIT 5;

INSERT INTO notifications (
  user_id,
  title,
  message,
  type,
  status,
  scheduled_for
)
SELECT 
  u.id,
  'Спеціальна пропозиція',
  'Знижка 15% на заміну масла до кінця місяця',
  'promotion',
  'pending',
  CURRENT_TIMESTAMP
FROM users u
WHERE u.role = 'client'
LIMIT 5;

-- Додавання тестових відгуків
INSERT INTO reviews (
  service_history_id,
  user_id,
  rating,
  comment,
  is_public
)
SELECT 
  sh.id,
  v.user_id,
  5,
  'Відмінний сервіс! Швидко та якісно виконали роботу.',
  true
FROM service_history sh
JOIN vehicles v ON v.id = sh.vehicle_id
LIMIT 3;

INSERT INTO reviews (
  service_history_id,
  user_id,
  rating,
  comment,
  is_public
)
SELECT 
  sh.id,
  v.user_id,
  4,
  'Добре виконана робота, але можна покращити час очікування.',
  true
FROM service_history sh
JOIN vehicles v ON v.id = sh.vehicle_id
OFFSET 3
LIMIT 2;

-- Додавання тестових акцій
INSERT INTO promotions (
  name,
  description,
  discount_type,
  discount_value,
  start_date,
  end_date,
  conditions,
  is_active
) VALUES
(
  'Весняна акція',
  'Знижка на комплексне ТО',
  'percentage',
  15.00,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '30 days',
  '{"min_service_cost": 2000, "services": ["oil_change", "filters_replacement"]}',
  true
),
(
  'Приведи друга',
  'Знижка за рекомендацію нового клієнта',
  'fixed_amount',
  500.00,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '90 days',
  '{"requires_new_customer": true}',
  true
),
(
  'Перше ТО',
  'Спеціальна ціна на перше ТО',
  'percentage',
  20.00,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '60 days',
  '{"first_service_only": true}',
  true
);

-- Додавання тестових документів
INSERT INTO documents (
  service_history_id,
  type,
  file_path,
  file_name,
  mime_type,
  size
)
SELECT 
  sh.id,
  'invoice',
  '/documents/invoices/' || sh.id || '.pdf',
  'invoice_' || sh.id || '.pdf',
  'application/pdf',
  1024 * 10 -- 10KB
FROM service_history sh
LIMIT 5;

INSERT INTO documents (
  service_history_id,
  type,
  file_path,
  file_name,
  mime_type,
  size
)
SELECT 
  sh.id,
  'report',
  '/documents/reports/' || sh.id || '.pdf',
  'report_' || sh.id || '.pdf',
  'application/pdf',
  1024 * 15 -- 15KB
FROM service_history sh
LIMIT 5;
