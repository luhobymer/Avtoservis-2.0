-- ========================================
-- СТВОРЕННЯ ТАБЛИЦІ NOTIFICATIONS
-- ========================================

-- Перевіряємо чи існує таблиця
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
) as table_exists;

-- Створюємо таблицю notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL DEFAULT 'info',
    priority VARCHAR(20) DEFAULT 'medium',
    is_read BOOLEAN DEFAULT FALSE,
    is_sent BOOLEAN DEFAULT FALSE,
    send_method VARCHAR(20) DEFAULT 'in_app', -- in_app, email, sms, push
    related_entity_type VARCHAR(50), -- appointment, reminder, service_history, etc.
    related_entity_id UUID,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Обмеження
    CONSTRAINT valid_notification_type CHECK (notification_type IN (
        'info', 'warning', 'error', 'success', 'reminder', 
        'appointment', 'service_complete', 'payment_due', 'system'
    )),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    CONSTRAINT valid_send_method CHECK (send_method IN ('in_app', 'email', 'sms', 'push')),
    CONSTRAINT valid_entity_type CHECK (related_entity_type IN (
        'appointment', 'reminder', 'service_history', 'vehicle', 
        'user', 'payment', 'system', 'promotion'
    ))
);

-- Створюємо індекси для оптимізації
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_sent ON notifications(is_sent);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- Створюємо тригер для оновлення updated_at
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    
    -- Якщо повідомлення позначається як прочитане
    IF NEW.is_read = TRUE AND OLD.is_read = FALSE THEN
        NEW.read_at = CURRENT_TIMESTAMP;
    END IF;
    
    -- Якщо повідомлення позначається як відправлене
    IF NEW.is_sent = TRUE AND OLD.is_sent = FALSE THEN
        NEW.sent_at = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- Функція для автоматичного видалення старих повідомлень
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Видаляємо прочитані повідомлення старше 30 днів
    DELETE FROM notifications 
    WHERE is_read = TRUE 
    AND read_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Видаляємо непрочитані повідомлення старше 90 днів
    DELETE FROM notifications 
    WHERE is_read = FALSE 
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    -- Видаляємо прострочені повідомлення
    DELETE FROM notifications 
    WHERE expires_at IS NOT NULL 
    AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Додаємо тестові дані
INSERT INTO notifications (
    id, user_id, title, message, notification_type, priority, 
    send_method, related_entity_type, related_entity_id, is_read
) VALUES
-- Повідомлення для користувача b07111e6-33bf-4da1-a66f-1a2fc0c3c922
(
    'not11111-1111-1111-1111-111111111111',
    'b07111e6-33bf-4da1-a66f-1a2fc0c3c922',
    'Нагадування про технічне обслуговування',
    'Ваш автомобіль потребує планового технічного обслуговування. Рекомендуємо записатися на найближчий час.',
    'reminder',
    'medium',
    'in_app',
    'reminder',
    'rem11111-1111-1111-1111-111111111111',
    false
),
(
    'not22222-2222-2222-2222-222222222222',
    'b07111e6-33bf-4da1-a66f-1a2fc0c3c922',
    'Запис підтверджено',
    'Ваш запис на діагностику двигуна підтверджено на завтра о 10:00. Адреса: вул. Центральна, 1.',
    'appointment',
    'high',
    'in_app',
    'appointment',
    (SELECT id FROM appointments WHERE user_id = 'b07111e6-33bf-4da1-a66f-1a2fc0c3c922' LIMIT 1),
    false
),
(
    'not33333-3333-3333-3333-333333333333',
    'b07111e6-33bf-4da1-a66f-1a2fc0c3c922',
    'Обслуговування завершено',
    'Заміна масла для вашого автомобіля успішно завершена. Наступне обслуговування рекомендується через 10,000 км.',
    'service_complete',
    'info',
    'in_app',
    'service_history',
    (SELECT id FROM service_history WHERE user_id = 'b07111e6-33bf-4da1-a66f-1a2fc0c3c922' LIMIT 1),
    true
),

-- Повідомлення для користувача f1c5fd82-e044-4cca-8bfe-ed15e8856f23
(
    'not44444-4444-4444-4444-444444444444',
    'f1c5fd82-e044-4cca-8bfe-ed15e8856f23',
    'Термінове нагадування',
    'Увага! Термін дії вашого страхування КАСКО закінчується через 15 днів. Рекомендуємо продовжити поліс.',
    'warning',
    'urgent',
    'email',
    'reminder',
    'rem33333-3333-3333-3333-333333333333',
    false
),
(
    'not55555-5555-5555-5555-555555555555',
    'f1c5fd82-e044-4cca-8bfe-ed15e8856f23',
    'Знижка на обслуговування',
    'Спеціальна пропозиція! Знижка 20% на заміну гальмівних колодок до кінця місяця.',
    'info',
    'low',
    'in_app',
    'promotion',
    NULL,
    false
),

-- Повідомлення для користувача 5dd96427-f0e8-4c0e-bb49-3bf504889897
(
    'not66666-6666-6666-6666-666666666666',
    '5dd96427-f0e8-4c0e-bb49-3bf504889897',
    'Нагадування про ротацію шин',
    'Час для ротації шин вашого автомобіля. Це допоможе забезпечити рівномірне зношування.',
    'reminder',
    'medium',
    'in_app',
    'reminder',
    'rem55555-5555-5555-5555-555555555555',
    false
),
(
    'not77777-7777-7777-7777-777777777777',
    '5dd96427-f0e8-4c0e-bb49-3bf504889897',
    'Системне повідомлення',
    'Оновлення системи заплановано на завтра з 02:00 до 04:00. Можливі тимчасові перебої в роботі.',
    'system',
    'medium',
    'in_app',
    'system',
    NULL,
    true
)

ON CONFLICT (id) DO NOTHING;

-- Перевіряємо результат
SELECT 
    n.title,
    n.notification_type,
    n.priority,
    n.is_read,
    n.is_sent,
    u.email as user_email,
    n.created_at
FROM notifications n
JOIN users u ON n.user_id = u.id
ORDER BY n.created_at DESC;

-- Статистика по типах повідомлень
SELECT 
    notification_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count,
    COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_count,
    COUNT(CASE WHEN is_sent = true THEN 1 END) as sent_count
FROM notifications
GROUP BY notification_type
ORDER BY total_count DESC;

-- Непрочитані повідомлення по користувачах
SELECT 
    u.email,
    COUNT(*) as unread_count,
    COUNT(CASE WHEN n.priority = 'urgent' THEN 1 END) as urgent_unread
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.is_read = false
GROUP BY u.id, u.email
ORDER BY urgent_unread DESC, unread_count DESC;

-- Повідомлення що потребують відправки
SELECT 
    n.title,
    n.send_method,
    n.priority,
    u.email,
    n.scheduled_for
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.is_sent = false
AND (n.scheduled_for IS NULL OR n.scheduled_for <= CURRENT_TIMESTAMP)
ORDER BY n.priority DESC, n.created_at;