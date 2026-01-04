-- ========================================
-- СТВОРЕННЯ ТАБЛИЦІ REMINDERS
-- ========================================

-- Перевіряємо чи існує таблиця
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'reminders'
) as table_exists;

-- Створюємо таблицю reminders
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    reminder_type VARCHAR(50) NOT NULL DEFAULT 'maintenance',
    due_date DATE NOT NULL,
    due_mileage INTEGER,
    is_completed BOOLEAN DEFAULT FALSE,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_interval INTEGER, -- в днях
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Обмеження
    CONSTRAINT valid_reminder_type CHECK (reminder_type IN (
        'maintenance', 'inspection', 'insurance', 'registration', 
        'oil_change', 'tire_rotation', 'brake_check', 'custom'
    )),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    CONSTRAINT valid_recurrence CHECK (
        (is_recurring = FALSE) OR 
        (is_recurring = TRUE AND recurrence_interval > 0)
    )
);

-- Створюємо індекси для оптимізації
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_vehicle_id ON reminders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_type ON reminders(reminder_type);
CREATE INDEX IF NOT EXISTS idx_reminders_completed ON reminders(is_completed);
CREATE INDEX IF NOT EXISTS idx_reminders_priority ON reminders(priority);
CREATE INDEX IF NOT EXISTS idx_reminders_notification ON reminders(notification_sent);

-- Створюємо тригер для оновлення updated_at
CREATE OR REPLACE FUNCTION update_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    
    -- Якщо нагадування позначається як виконане
    IF NEW.is_completed = TRUE AND OLD.is_completed = FALSE THEN
        NEW.completed_at = CURRENT_TIMESTAMP;
    END IF;
    
    -- Якщо нагадування знову стає невиконаним
    IF NEW.is_completed = FALSE AND OLD.is_completed = TRUE THEN
        NEW.completed_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reminders_updated_at
    BEFORE UPDATE ON reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_reminders_updated_at();

-- Додаємо тестові дані
INSERT INTO reminders (
    id, user_id, vehicle_id, title, description, reminder_type, 
    due_date, due_mileage, priority, is_recurring, recurrence_interval
) VALUES
-- Нагадування для користувача b07111e6-33bf-4da1-a66f-1a2fc0c3c922
(
    'rem11111-1111-1111-1111-111111111111',
    'b07111e6-33bf-4da1-a66f-1a2fc0c3c922',
    (SELECT id FROM vehicles WHERE user_id = 'b07111e6-33bf-4da1-a66f-1a2fc0c3c922' LIMIT 1),
    'Заміна моторного масла',
    'Час замінити моторне масло та масляний фільтр',
    'oil_change',
    CURRENT_DATE + INTERVAL '30 days',
    50000,
    'high',
    true,
    90
),
(
    'rem22222-2222-2222-2222-222222222222',
    'b07111e6-33bf-4da1-a66f-1a2fc0c3c922',
    (SELECT id FROM vehicles WHERE user_id = 'b07111e6-33bf-4da1-a66f-1a2fc0c3c922' LIMIT 1),
    'Технічний огляд',
    'Пройти щорічний технічний огляд автомобіля',
    'inspection',
    CURRENT_DATE + INTERVAL '60 days',
    NULL,
    'medium',
    true,
    365
),

-- Нагадування для користувача f1c5fd82-e044-4cca-8bfe-ed15e8856f23
(
    'rem33333-3333-3333-3333-333333333333',
    'f1c5fd82-e044-4cca-8bfe-ed15e8856f23',
    (SELECT id FROM vehicles WHERE user_id = 'f1c5fd82-e044-4cca-8bfe-ed15e8856f23' LIMIT 1),
    'Страхування КАСКО',
    'Продовжити страхування КАСКО',
    'insurance',
    CURRENT_DATE + INTERVAL '45 days',
    NULL,
    'high',
    true,
    365
),
(
    'rem44444-4444-4444-4444-444444444444',
    'f1c5fd82-e044-4cca-8bfe-ed15e8856f23',
    (SELECT id FROM vehicles WHERE user_id = 'f1c5fd82-e044-4cca-8bfe-ed15e8856f23' LIMIT 1),
    'Заміна гальмівних колодок',
    'Перевірити стан гальмівних колодок',
    'brake_check',
    CURRENT_DATE + INTERVAL '15 days',
    65000,
    'urgent',
    false,
    NULL
),

-- Нагадування для користувача 5dd96427-f0e8-4c0e-bb49-3bf504889897
(
    'rem55555-5555-5555-5555-555555555555',
    '5dd96427-f0e8-4c0e-bb49-3bf504889897',
    (SELECT id FROM vehicles WHERE user_id = '5dd96427-f0e8-4c0e-bb49-3bf504889897' LIMIT 1),
    'Ротація шин',
    'Час для ротації шин для рівномірного зношування',
    'tire_rotation',
    CURRENT_DATE + INTERVAL '20 days',
    30000,
    'medium',
    true,
    180
)

ON CONFLICT (id) DO NOTHING;

-- Перевіряємо результат
SELECT 
    r.title,
    r.reminder_type,
    r.due_date,
    r.priority,
    r.is_recurring,
    u.email as user_email,
    v.make || ' ' || v.model as vehicle
FROM reminders r
JOIN users u ON r.user_id = u.id
LEFT JOIN vehicles v ON r.vehicle_id = v.id
ORDER BY r.due_date;

-- Статистика по типах нагадувань
SELECT 
    reminder_type,
    COUNT(*) as count,
    COUNT(CASE WHEN is_completed = false THEN 1 END) as active_count,
    COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_count
FROM reminders
GROUP BY reminder_type
ORDER BY count DESC;

-- Нагадування що потребують уваги (прострочені або скоро настануть)
SELECT 
    r.title,
    r.due_date,
    r.priority,
    u.email,
    CASE 
        WHEN r.due_date < CURRENT_DATE THEN 'ПРОСТРОЧЕНО'
        WHEN r.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'СКОРО'
        ELSE 'МАЙБУТНЄ'
    END as urgency_status
FROM reminders r
JOIN users u ON r.user_id = u.id
WHERE r.is_completed = false
AND r.due_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY r.due_date;