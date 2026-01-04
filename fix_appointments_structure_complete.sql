-- Виправлення структури таблиці appointments
-- Додавання відсутніх колонок та покращення структури

-- 1. Перевіримо поточну структуру таблиці appointments
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Додамо колонку date якщо вона не існує
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'date'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE appointments ADD COLUMN date DATE;
        RAISE NOTICE 'Колонка date додана до таблиці appointments';
    ELSE
        RAISE NOTICE 'Колонка date вже існує в таблиці appointments';
    END IF;
END $$;

-- 3. Додамо колонку time якщо вона не існує
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'time'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE appointments ADD COLUMN time TIME;
        RAISE NOTICE 'Колонка time додана до таблиці appointments';
    ELSE
        RAISE NOTICE 'Колонка time вже існує в таблиці appointments';
    END IF;
END $$;

-- 4. Додамо колонку status якщо вона не існує
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'status'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE appointments ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
        RAISE NOTICE 'Колонка status додана до таблиці appointments';
    ELSE
        RAISE NOTICE 'Колонка status вже існує в таблиці appointments';
    END IF;
END $$;

-- 5. Заповнимо відсутні дати та час для існуючих записів
UPDATE appointments 
SET 
    date = CURRENT_DATE + INTERVAL '1 day',
    time = '10:00:00'
WHERE date IS NULL OR time IS NULL;

-- 6. Додамо NOT NULL constraint для важливих колонок
ALTER TABLE appointments 
ALTER COLUMN date SET NOT NULL,
ALTER COLUMN time SET NOT NULL,
ALTER COLUMN status SET NOT NULL;

-- 7. Створимо індекси для покращення продуктивності
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_vehicle_id ON appointments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments(service_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- 8. Перевіримо оновлену структуру
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 9. Перевіримо приклад даних
SELECT 
    id,
    user_id,
    vehicle_id,
    service_id,
    date,
    time,
    status,
    created_at
FROM appointments
LIMIT 5;

-- 10. Перевіримо створені індекси
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'appointments'
AND schemaname = 'public';