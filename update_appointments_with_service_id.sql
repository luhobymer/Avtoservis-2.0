-- Оновлення таблиці appointments для додавання service_id
-- Цей скрипт додає зв'язки між appointments та services

-- ========================================
-- ОНОВЛЕННЯ ІСНУЮЧИХ ЗАПИСІВ APPOINTMENTS
-- ========================================

-- Спочатку перевіримо, чи існують послуги
SELECT id, name FROM services ORDER BY name;

-- Оновлюємо записи appointments, додаючи service_id на основі service_type
UPDATE appointments 
SET service_id = (
    SELECT s.id 
    FROM services s 
    WHERE s.name = appointments.service_type
    LIMIT 1
)
WHERE service_id IS NULL;

-- Перевіряємо результат оновлення
SELECT 
    a.id,
    a.service_type,
    a.service_id,
    s.name as service_name,
    s.base_price
FROM appointments a
LEFT JOIN services s ON a.service_id = s.id
ORDER BY a.created_at DESC;

-- Якщо деякі записи не мають service_id, створимо відповідні послуги
INSERT INTO services (id, name, description, base_price, duration_minutes, category)
SELECT 
    gen_random_uuid(),
    DISTINCT service_type,
    'Автоматично створена послуга на основі існуючих записів',
    500.00,
    60,
    'Загальні послуги'
FROM appointments 
WHERE service_type NOT IN (SELECT name FROM services)
AND service_type IS NOT NULL;

-- Повторно оновлюємо записи після створення нових послуг
UPDATE appointments 
SET service_id = (
    SELECT s.id 
    FROM services s 
    WHERE s.name = appointments.service_type
    LIMIT 1
)
WHERE service_id IS NULL AND service_type IS NOT NULL;

-- Фінальна перевірка
SELECT 
    COUNT(*) as total_appointments,
    COUNT(service_id) as appointments_with_service_id,
    COUNT(*) - COUNT(service_id) as appointments_without_service_id
FROM appointments;

-- Показати записи без service_id (якщо такі є)
SELECT id, service_type, user_id, scheduled_time
FROM appointments 
WHERE service_id IS NULL;

-- Тестовий JOIN для перевірки зв'язків
SELECT 
    a.id as appointment_id,
    u.name as user_name,
    s.name as service_name,
    s.base_price,
    a.scheduled_time,
    a.status
FROM appointments a
JOIN users u ON a.user_id = u.id
JOIN services s ON a.service_id = s.id
ORDER BY a.scheduled_time DESC
LIMIT 10;