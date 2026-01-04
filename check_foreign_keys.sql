-- Перевірка зовнішніх ключів між appointments та vehicles
-- Проблема: "Could not embed because more than one relationship was found for 'vehicles' and 'appointments'"

-- 1. Перевірити всі зовнішні ключі для таблиці appointments
SELECT 
    tc.constraint_name,
    tc.table_name,
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
ORDER BY tc.constraint_name;

-- 2. Перевірити зовнішні ключі між appointments та vehicles
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as foreign_table_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE contype = 'f' 
    AND (conrelid::regclass::text = 'appointments' AND confrelid::regclass::text = 'vehicles')
ORDER BY conname;

-- 3. Перевірити структуру таблиці appointments
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'appointments' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Перевірити структуру таблиці vehicles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'vehicles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Перевірити які колонки в appointments посилаються на vehicles
SELECT 
    a.attname as column_name,
    format_type(a.atttypid, a.atttypmod) as data_type
FROM pg_attribute a
JOIN pg_class t on a.attrelid = t.oid
JOIN pg_namespace s on t.relnamespace = s.oid
WHERE s.nspname = 'public'
    AND t.relname = 'appointments'
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.attname LIKE '%vehicle%'
ORDER BY a.attnum;