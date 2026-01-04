-- Видалення дублікату зовнішніх ключів між appointments та services
-- Виконайте ці команди по одній в Supabase Dashboard -> SQL Editor

-- 1. Спочатку перевіримо існуючі зовнішні ключі
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE 
    tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'appointments'
    AND ccu.table_name = 'services';

-- 2. Видалити один з дублікатів (залишити appointments_service_id_fkey)
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS fk_appointments_service_id;

-- 3. Перевірити, що залишився тільки один зовнішній ключ
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE 
    tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'appointments'
    AND ccu.table_name = 'services';

-- 4. Аналогічно перевіримо та виправимо інші можливі дублікати

-- Перевірка зовнішніх ключів для mechanics
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE 
    tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'appointments'
    AND ccu.table_name = 'mechanics';

-- Видалити дублікат для mechanics якщо є
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS fk_appointments_mechanic_id;

-- Перевірка зовнішніх ключів для service_stations
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE 
    tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'appointments'
    AND ccu.table_name = 'service_stations';

-- Видалити дублікат для service_stations якщо є
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS fk_appointments_station_id;

-- Перевірка зовнішніх ключів для vehicles
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE 
    tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'appointments'
    AND ccu.table_name = 'vehicles';

-- Видалити дублікат для vehicles якщо є
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS fk_appointments_vehicle_id;