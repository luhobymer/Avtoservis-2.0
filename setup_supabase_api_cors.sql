-- ========================================
-- НАЛАШТУВАННЯ SUPABASE API ТА CORS
-- ========================================

-- 1. Створення функцій для API ендпоінтів

-- Функція для отримання профілю користувача
CREATE OR REPLACE FUNCTION get_user_profile(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
    id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        u.created_at,
        u.updated_at
    FROM users u
    WHERE u.id = user_uuid;
END;
$$;

-- Функція для отримання автомобілів користувача
CREATE OR REPLACE FUNCTION get_user_vehicles(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
    id UUID,
    make TEXT,
    model TEXT,
    year INTEGER,
    vin TEXT,
    license_plate TEXT,
    mileage INTEGER,
    created_at TIMESTAMPTZ
) 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        v.make,
        v.model,
        v.year,
        v.vin,
        v.license_plate,
        v.mileage,
        v.created_at
    FROM vehicles v
    WHERE v.user_id = user_uuid;
END;
$$;

-- Функція для отримання записів на обслуговування
CREATE OR REPLACE FUNCTION get_user_appointments(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
    id UUID,
    service_station_name TEXT,
    service_type TEXT,
    appointment_date TIMESTAMPTZ,
    status TEXT,
    notes TEXT,
    vehicle_info TEXT,
    created_at TIMESTAMPTZ
) 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        ss.name as service_station_name,
        a.service_type,
        a.appointment_date,
        a.status,
        a.notes,
        v.make || ' ' || v.model || ' (' || v.year || ')' as vehicle_info,
        a.created_at
    FROM appointments a
    JOIN service_stations ss ON a.service_station_id = ss.id
    JOIN vehicles v ON a.vehicle_id = v.id
    WHERE a.user_id = user_uuid
    ORDER BY a.appointment_date DESC;
END;
$$;

-- Функція для отримання нагадувань користувача
CREATE OR REPLACE FUNCTION get_user_reminders(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    reminder_type TEXT,
    due_date DATE,
    due_mileage INTEGER,
    is_completed BOOLEAN,
    priority TEXT,
    vehicle_info TEXT,
    created_at TIMESTAMPTZ
) 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.title,
        r.description,
        r.reminder_type,
        r.due_date,
        r.due_mileage,
        r.is_completed,
        r.priority,
        CASE 
            WHEN r.vehicle_id IS NOT NULL THEN v.make || ' ' || v.model || ' (' || v.year || ')'
            ELSE 'Загальне'
        END as vehicle_info,
        r.created_at
    FROM reminders r
    LEFT JOIN vehicles v ON r.vehicle_id = v.id
    WHERE r.user_id = user_uuid
    ORDER BY r.due_date ASC;
END;
$$;

-- Функція для отримання повідомлень користувача
CREATE OR REPLACE FUNCTION get_user_notifications(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
    id UUID,
    title TEXT,
    message TEXT,
    notification_type TEXT,
    priority TEXT,
    is_read BOOLEAN,
    created_at TIMESTAMPTZ
) 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.title,
        n.message,
        n.notification_type,
        n.priority,
        n.is_read,
        n.created_at
    FROM notifications n
    WHERE n.user_id = user_uuid
    ORDER BY n.created_at DESC;
END;
$$;

-- Функція для отримання історії обслуговування
CREATE OR REPLACE FUNCTION get_user_service_history(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
    id UUID,
    service_type TEXT,
    service_date DATE,
    mileage INTEGER,
    cost DECIMAL,
    notes TEXT,
    vehicle_info TEXT,
    service_station_name TEXT,
    mechanic_name TEXT
) 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sh.id,
        sh.service_type,
        sh.service_date,
        sh.mileage,
        sh.cost,
        sh.notes,
        v.make || ' ' || v.model || ' (' || v.year || ')' as vehicle_info,
        ss.name as service_station_name,
        m.first_name || ' ' || m.last_name as mechanic_name
    FROM service_history sh
    JOIN vehicles v ON sh.vehicle_id = v.id
    LEFT JOIN service_stations ss ON sh.service_station_id = ss.id
    LEFT JOIN mechanics m ON sh.mechanic_id = m.id
    WHERE sh.user_id = user_uuid
    ORDER BY sh.service_date DESC;
END;
$$;

-- 2. Створення функцій для створення/оновлення записів

-- Функція для створення нового запису на обслуговування
CREATE OR REPLACE FUNCTION create_appointment(
    p_service_station_id UUID,
    p_vehicle_id UUID,
    p_service_type TEXT,
    p_appointment_date TIMESTAMPTZ,
    p_notes TEXT DEFAULT NULL,
    user_uuid UUID DEFAULT auth.uid()
)
RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    new_appointment_id UUID;
BEGIN
    -- Перевіряємо, що автомобіль належить користувачу
    IF NOT EXISTS (
        SELECT 1 FROM vehicles 
        WHERE id = p_vehicle_id AND user_id = user_uuid
    ) THEN
        RAISE EXCEPTION 'Vehicle does not belong to user';
    END IF;
    
    INSERT INTO appointments (
        user_id, service_station_id, vehicle_id, 
        service_type, appointment_date, notes, status
    ) VALUES (
        user_uuid, p_service_station_id, p_vehicle_id,
        p_service_type, p_appointment_date, p_notes, 'scheduled'
    ) RETURNING id INTO new_appointment_id;
    
    RETURN new_appointment_id;
END;
$$;

-- Функція для створення нового нагадування
CREATE OR REPLACE FUNCTION create_reminder(
    p_title TEXT,
    p_description TEXT,
    p_reminder_type TEXT,
    p_due_date DATE,
    p_vehicle_id UUID DEFAULT NULL,
    p_due_mileage INTEGER DEFAULT NULL,
    p_priority TEXT DEFAULT 'medium',
    user_uuid UUID DEFAULT auth.uid()
)
RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    new_reminder_id UUID;
BEGIN
    -- Перевіряємо, що автомобіль належить користувачу (якщо вказано)
    IF p_vehicle_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM vehicles 
        WHERE id = p_vehicle_id AND user_id = user_uuid
    ) THEN
        RAISE EXCEPTION 'Vehicle does not belong to user';
    END IF;
    
    INSERT INTO reminders (
        user_id, vehicle_id, title, description, 
        reminder_type, due_date, due_mileage, priority
    ) VALUES (
        user_uuid, p_vehicle_id, p_title, p_description,
        p_reminder_type, p_due_date, p_due_mileage, p_priority
    ) RETURNING id INTO new_reminder_id;
    
    RETURN new_reminder_id;
END;
$$;

-- Функція для позначення повідомлення як прочитаного
CREATE OR REPLACE FUNCTION mark_notification_read(
    p_notification_id UUID,
    user_uuid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE notifications 
    SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
    WHERE id = p_notification_id AND user_id = user_uuid;
    
    RETURN FOUND;
END;
$$;

-- 3. Створення представлень (Views) для API

-- Представлення для доступних сервісних станцій
CREATE OR REPLACE VIEW api_service_stations AS
SELECT 
    id,
    name,
    address,
    phone,
    email,
    working_hours,
    rating,
    created_at
FROM service_stations
WHERE is_active = TRUE;

-- Представлення для доступних послуг
CREATE OR REPLACE VIEW api_services AS
SELECT 
    id,
    name,
    description,
    category,
    base_price,
    estimated_duration,
    created_at
FROM services
WHERE is_active = TRUE;

-- Представлення для механіків
CREATE OR REPLACE VIEW api_mechanics AS
SELECT 
    id,
    first_name,
    last_name,
    specialization,
    experience_years,
    rating,
    service_station_id
FROM mechanics
WHERE is_active = TRUE;

-- 4. Налаштування RLS для API функцій

-- Дозволяємо виконання функцій автентифікованим користувачам
GRANT EXECUTE ON FUNCTION get_user_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_vehicles(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_appointments(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_reminders(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_notifications(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_service_history(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_appointment(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_reminder(TEXT, TEXT, TEXT, DATE, UUID, INTEGER, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read(UUID, UUID) TO authenticated;

-- Дозволяємо читання представлень
GRANT SELECT ON api_service_stations TO authenticated, anon;
GRANT SELECT ON api_services TO authenticated, anon;
GRANT SELECT ON api_mechanics TO authenticated, anon;

-- 5. Створення тригерів для автоматичних повідомлень

-- Тригер для створення повідомлення при новому записі
CREATE OR REPLACE FUNCTION notify_new_appointment()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (
        user_id, title, message, notification_type, priority
    ) VALUES (
        NEW.user_id,
        'Новий запис створено',
        'Ваш запис на ' || NEW.service_type || ' створено на ' || 
        to_char(NEW.appointment_date, 'DD.MM.YYYY HH24:MI'),
        'appointment',
        'medium'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_appointment
    AFTER INSERT ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_appointment();

-- Тригер для повідомлення про зміну статусу запису
CREATE OR REPLACE FUNCTION notify_appointment_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO notifications (
            user_id, title, message, notification_type, priority,
            related_entity_type, related_entity_id
        ) VALUES (
            NEW.user_id,
            'Статус запису змінено',
            'Статус вашого запису на ' || NEW.service_type || 
            ' змінено на "' || NEW.status || '"',
            'appointment',
            CASE 
                WHEN NEW.status = 'confirmed' THEN 'high'
                WHEN NEW.status = 'cancelled' THEN 'medium'
                ELSE 'low'
            END,
            'appointment',
            NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_appointment_status_change
    AFTER UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION notify_appointment_status_change();

-- 6. Функція для очищення старих даних
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    deleted_count INTEGER;
BEGIN
    -- Очищення старих повідомлень
    SELECT cleanup_old_notifications() INTO deleted_count;
    result := result || 'Видалено повідомлень: ' || deleted_count || E'\n';
    
    -- Видалення скасованих записів старше 6 місяців
    DELETE FROM appointments 
    WHERE status = 'cancelled' 
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '6 months';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    result := result || 'Видалено скасованих записів: ' || deleted_count || E'\n';
    
    -- Видалення виконаних нагадувань старше 1 року
    DELETE FROM reminders 
    WHERE is_completed = TRUE 
    AND completed_at < CURRENT_TIMESTAMP - INTERVAL '1 year';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    result := result || 'Видалено старих нагадувань: ' || deleted_count || E'\n';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 7. Створення індексів для API оптимізації
CREATE INDEX IF NOT EXISTS idx_appointments_user_date ON appointments(user_id, appointment_date DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_user_due ON reminders(user_id, due_date ASC) WHERE is_completed = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_service_history_user_date ON service_history(user_id, service_date DESC);

-- Перевіряємо створені функції
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE 'get_user_%' 
OR routine_name LIKE 'create_%'
OR routine_name = 'mark_notification_read'
ORDER BY routine_name;

-- Перевіряємо створені представлення
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'api_%'
ORDER BY table_name;

SELECT 'Supabase API функції та CORS налаштування створено успішно!' as result;