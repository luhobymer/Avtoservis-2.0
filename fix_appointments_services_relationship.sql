-- Виправлення зв'язків між таблицями appointments та services
-- Цей скрипт додає колонку service_id до таблиці appointments та створює foreign key constraint

-- 1. Перевіримо поточну структуру таблиці appointments
SELECT 'Поточна структура таблиці appointments:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'appointments' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Перевіримо існуючі foreign key constraints для appointments
SELECT 'Існуючі foreign key constraints для appointments:' as info;
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'appointments'
    AND tc.table_schema = 'public';

-- 3. Перевіримо, чи існує колонка service_id в appointments
SELECT 'Перевірка колонки service_id в appointments:' as info;
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'appointments' 
        AND column_name = 'service_id'
        AND table_schema = 'public'
) as service_id_exists;

-- 4. Додамо колонку service_id до таблиці appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_id INTEGER;

-- 5. Створимо foreign key constraint між appointments.service_id та services.id
ALTER TABLE public.appointments 
DROP CONSTRAINT IF EXISTS appointments_service_id_fkey;

ALTER TABLE public.appointments 
ADD CONSTRAINT appointments_service_id_fkey 
FOREIGN KEY (service_id) 
REFERENCES public.services(id) 
ON DELETE SET NULL;

-- 6. Створимо індекс для покращення продуктивності
CREATE INDEX IF NOT EXISTS idx_appointments_service_id 
ON public.appointments USING btree (service_id);

-- 7. Оновимо існуючі записи appointments, встановивши service_id на основі service_type
-- Це потрібно зробити вручну, оскільки ми не знаємо точного відповідності
-- Наприклад:
-- UPDATE public.appointments 
-- SET service_id = (
--     CASE 
--         WHEN service_type ILIKE '%масла%' OR service_type ILIKE '%oil%' THEN 1
--         WHEN service_type ILIKE '%діагностика%' OR service_type ILIKE '%diagnostic%' THEN 2
--         WHEN service_type ILIKE '%гальм%' OR service_type ILIKE '%brake%' THEN 3
--         ELSE 1 -- За замовчуванням
--     END
-- )
-- WHERE service_id IS NULL;

-- 8. Перевіримо результат
SELECT 'Результат після виправлень:' as info;

-- Перевіримо foreign key constraints
SELECT 'Foreign key constraints для appointments:' as info;
SELECT 
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'appointments'
    AND tc.table_schema = 'public';

-- 9. Тестовий JOIN
SELECT 'Тестовий JOIN appointments ↔ services:' as info;
SELECT 
    a.id as appointment_id,
    a.service_type,
    a.service_id,
    s.name as service_name,
    s.price
FROM public.appointments a
LEFT JOIN public.services s ON a.service_id = s.id
LIMIT 5;

SELECT 'Виправлення завершено!' as result;