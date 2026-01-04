-- Виправлення проблеми з колонкою duration в таблиці services
-- Проблема: в коді використовується services.duration, але в БД колонка називається duration_minutes

-- Варіант 1: Перейменувати колонку duration_minutes на duration
ALTER TABLE services RENAME COLUMN duration_minutes TO duration;

-- Перевірити результат
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'services' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Перевірити дані після зміни
SELECT id, name, duration FROM services LIMIT 5;