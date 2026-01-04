-- Відновлення foreign key constraints для appointments

-- 1. Спочатку видаляємо існуючі constraints якщо вони є
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS fk_appointments_mechanic_id;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_mechanic_id_fkey;

-- 2. Перевіряємо чи існують некоректні значення mechanic_id
SELECT 
    a.id as appointment_id,
    a.mechanic_id,
    m.id as mechanic_exists
FROM appointments a
LEFT JOIN mechanics m ON a.mechanic_id = m.id
WHERE a.mechanic_id IS NOT NULL AND m.id IS NULL;

-- 3. Очищаємо некоректні значення mechanic_id (якщо такі є)
UPDATE appointments 
SET mechanic_id = NULL 
WHERE mechanic_id IS NOT NULL 
AND mechanic_id NOT IN (SELECT id FROM mechanics WHERE id IS NOT NULL);

-- 4. Додаємо foreign key constraint
ALTER TABLE appointments 
ADD CONSTRAINT fk_appointments_mechanic_id 
FOREIGN KEY (mechanic_id) 
REFERENCES mechanics(id) 
ON DELETE SET NULL;

-- 5. Створюємо індекс для покращення продуктивності
CREATE INDEX IF NOT EXISTS idx_appointments_mechanic_id ON appointments(mechanic_id);

-- 6. Перевіряємо результат
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
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'appointments'
AND kcu.column_name = 'mechanic_id';

-- 7. Тестовий запит для перевірки зв'язку
SELECT 
    a.id,
    a.scheduled_time,
    a.status,
    m.name as mechanic_name,
    m.specialization
FROM appointments a
LEFT JOIN mechanics m ON a.mechanic_id = m.id
LIMIT 5;