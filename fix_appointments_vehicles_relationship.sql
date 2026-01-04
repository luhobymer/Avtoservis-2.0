-- Виправлення зв'язків між appointments та vehicles
-- Спочатку створимо тестові дані, потім налаштуємо зв'язки

-- 1. Перевіримо чи існують таблиці та їх структуру
SELECT 'Перевірка таблиці vehicles:' as info;
SELECT COUNT(*) as vehicles_count FROM vehicles;

SELECT 'Перевірка таблиці appointments:' as info;
SELECT COUNT(*) as appointments_count FROM appointments;

-- 2. Створимо тестові vehicles якщо їх немає
INSERT INTO vehicles (make, model, year, vin, license_plate, user_id)
SELECT 
    'Toyota' as make,
    'Camry' as model,
    2020 as year,
    'TEST123456789VIN' as vin,
    'AA1234BB' as license_plate,
    (
        SELECT id FROM auth.users 
        ORDER BY created_at DESC
        LIMIT 1
    ) as user_id
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE make = 'Toyota' AND model = 'Camry');

INSERT INTO vehicles (make, model, year, vin, license_plate, user_id)
SELECT 
    'Honda' as make,
    'Civic' as model,
    2019 as year,
    'TEST987654321VIN' as vin,
    'BB5678CC' as license_plate,
    (
        SELECT id FROM auth.users 
        ORDER BY created_at DESC
        LIMIT 1
    ) as user_id
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE make = 'Honda' AND model = 'Civic');

-- 3. Створимо тестові appointments якщо їх немає
INSERT INTO appointments (user_id, service_id, vehicle_id, date, time, status)
SELECT 
    (
        SELECT id FROM auth.users 
        ORDER BY created_at DESC
        LIMIT 1
    ) as user_id,
    (
        SELECT id FROM services 
        LIMIT 1
    ) as service_id,
    (
        SELECT id FROM vehicles 
        WHERE make = 'Toyota'
        LIMIT 1
    ) as vehicle_id,
    CURRENT_DATE + INTERVAL '1 day' as date,
    '10:00:00' as time,
    'pending' as status
WHERE NOT EXISTS (SELECT 1 FROM appointments WHERE date = CURRENT_DATE + INTERVAL '1 day');

INSERT INTO appointments (user_id, service_id, vehicle_id, date, time, status)
SELECT 
    (
        SELECT id FROM auth.users 
        ORDER BY created_at DESC
        LIMIT 1
    ) as user_id,
    (
        SELECT id FROM services 
        OFFSET 1
        LIMIT 1
    ) as service_id,
    (
        SELECT id FROM vehicles 
        WHERE make = 'Honda'
        LIMIT 1
    ) as vehicle_id,
    CURRENT_DATE + INTERVAL '2 days' as date,
    '14:00:00' as time,
    'confirmed' as status
WHERE NOT EXISTS (SELECT 1 FROM appointments WHERE date = CURRENT_DATE + INTERVAL '2 days');

-- 4. Перевіримо що дані створилися
SELECT 'Vehicles після створення:' as info;
SELECT id, make, model, year, user_id FROM vehicles;

SELECT 'Appointments після створення:' as info;
SELECT id, user_id, service_id, vehicle_id, date, time, status FROM appointments;

-- 5. Оновимо NULL vehicle_id якщо такі є
UPDATE appointments 
SET vehicle_id = (
    SELECT id 
    FROM vehicles 
    WHERE vehicles.user_id = appointments.user_id 
    LIMIT 1
)
WHERE vehicle_id IS NULL
AND EXISTS (
    SELECT 1 
    FROM vehicles 
    WHERE vehicles.user_id = appointments.user_id
);

-- 6. Для appointments без відповідного vehicle, призначимо перший доступний
UPDATE appointments 
SET vehicle_id = (
    SELECT id 
    FROM vehicles 
    ORDER BY id 
    LIMIT 1
)
WHERE vehicle_id IS NULL;

-- 7. Видалимо існуючий constraint якщо він є
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS fk_appointments_vehicle_id;

-- 8. Створимо foreign key constraint
ALTER TABLE appointments 
ADD CONSTRAINT fk_appointments_vehicle_id 
FOREIGN KEY (vehicle_id) 
REFERENCES vehicles(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- 9. Перевіримо результат JOIN
SELECT 'Результат JOIN appointments з vehicles:' as info;
SELECT 
    a.id as appointment_id,
    a.date,
    a.time,
    a.status,
    a.vehicle_id,
    v.make,
    v.model,
    v.year,
    v.license_plate
FROM appointments a
LEFT JOIN vehicles v ON a.vehicle_id = v.id
ORDER BY a.id;

-- 10. Перевіримо створений constraint
SELECT 'Перевірка foreign key constraints:' as info;
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
AND tc.table_name = 'appointments';