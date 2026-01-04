-- SQL-запит для створення таблиць сповіщень у Supabase

-- Створення таблиці для сповіщень
CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT valid_notification_type CHECK (type IN ('appointment_reminder', 'appointment_status', 'mileage_request', 'maintenance_reminder', 'system', 'chat'))
);

-- Створення таблиці для запланованих сповіщень
CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    is_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT valid_scheduled_notification_type CHECK (type IN ('appointment_reminder', 'maintenance_reminder', 'mileage_request'))
);

-- Створення таблиці для push-токенів
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL,
    device_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(token)
);

-- Додаємо коментарі до таблиць та колонок
COMMENT ON TABLE public.notifications IS 'Таблиця для зберігання сповіщень користувачів';
COMMENT ON COLUMN public.notifications.id IS 'Унікальний ідентифікатор сповіщення';
COMMENT ON COLUMN public.notifications.user_id IS 'Ідентифікатор користувача (зовнішній ключ до auth.users)';
COMMENT ON COLUMN public.notifications.title IS 'Заголовок сповіщення';
COMMENT ON COLUMN public.notifications.message IS 'Текст сповіщення';
COMMENT ON COLUMN public.notifications.type IS 'Тип сповіщення (appointment_reminder, appointment_status, mileage_request, maintenance_reminder, system, chat)';
COMMENT ON COLUMN public.notifications.data IS 'Додаткові дані сповіщення у форматі JSON';
COMMENT ON COLUMN public.notifications.is_read IS 'Прапорець, що вказує, чи прочитане сповіщення';
COMMENT ON COLUMN public.notifications.created_at IS 'Дата та час створення сповіщення';

COMMENT ON TABLE public.scheduled_notifications IS 'Таблиця для зберігання запланованих сповіщень';
COMMENT ON COLUMN public.scheduled_notifications.id IS 'Унікальний ідентифікатор запланованого сповіщення';
COMMENT ON COLUMN public.scheduled_notifications.user_id IS 'Ідентифікатор користувача (зовнішній ключ до auth.users)';
COMMENT ON COLUMN public.scheduled_notifications.title IS 'Заголовок запланованого сповіщення';
COMMENT ON COLUMN public.scheduled_notifications.message IS 'Текст запланованого сповіщення';
COMMENT ON COLUMN public.scheduled_notifications.type IS 'Тип запланованого сповіщення (appointment_reminder, maintenance_reminder, mileage_request)';
COMMENT ON COLUMN public.scheduled_notifications.data IS 'Додаткові дані запланованого сповіщення у форматі JSON';
COMMENT ON COLUMN public.scheduled_notifications.scheduled_for IS 'Дата та час, на який заплановано сповіщення';
COMMENT ON COLUMN public.scheduled_notifications.is_sent IS 'Прапорець, що вказує, чи було відправлено сповіщення';
COMMENT ON COLUMN public.scheduled_notifications.created_at IS 'Дата та час створення запланованого сповіщення';

COMMENT ON TABLE public.push_tokens IS 'Таблиця для зберігання push-токенів користувачів';
COMMENT ON COLUMN public.push_tokens.id IS 'Унікальний ідентифікатор push-токена';
COMMENT ON COLUMN public.push_tokens.user_id IS 'Ідентифікатор користувача (зовнішній ключ до auth.users)';
COMMENT ON COLUMN public.push_tokens.token IS 'Push-токен пристрою';
COMMENT ON COLUMN public.push_tokens.platform IS 'Платформа пристрою (ios, android, web)';
COMMENT ON COLUMN public.push_tokens.device_name IS 'Назва пристрою';
COMMENT ON COLUMN public.push_tokens.created_at IS 'Дата та час створення запису';
COMMENT ON COLUMN public.push_tokens.updated_at IS 'Дата та час останнього оновлення запису';

-- Створення індексів для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user_id ON public.scheduled_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_for ON public.scheduled_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_is_sent ON public.scheduled_notifications(is_sent);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_platform ON public.push_tokens(platform);

-- Створення тригера для автоматичного оновлення updated_at у таблиці push_tokens
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_push_tokens_updated_at
BEFORE UPDATE ON public.push_tokens
FOR EACH ROW
EXECUTE PROCEDURE update_push_tokens_updated_at_column();

-- Налаштування RLS (Row Level Security) для таблиць
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Політики для таблиці notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Політики для таблиці scheduled_notifications
CREATE POLICY "Users can view their own scheduled notifications"
ON public.scheduled_notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scheduled notifications"
ON public.scheduled_notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled notifications"
ON public.scheduled_notifications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled notifications"
ON public.scheduled_notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Політики для таблиці push_tokens
CREATE POLICY "Users can view their own push tokens"
ON public.push_tokens
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push tokens"
ON public.push_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens"
ON public.push_tokens
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens"
ON public.push_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Надання прав доступу для authenticated ролі
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.notifications_id_seq TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_notifications TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.scheduled_notifications_id_seq TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.push_tokens_id_seq TO authenticated;

-- Створення функції для відправки сповіщень з запланованих
CREATE OR REPLACE FUNCTION process_scheduled_notifications()
RETURNS void AS $$
DECLARE
    scheduled_notification RECORD;
BEGIN
    -- Вибираємо всі заплановані сповіщення, які потрібно відправити
    FOR scheduled_notification IN
        SELECT * FROM public.scheduled_notifications
        WHERE scheduled_for <= NOW() AND is_sent = false
    LOOP
        -- Створюємо нове сповіщення
        INSERT INTO public.notifications (
            user_id, title, message, type, data, created_at
        ) VALUES (
            scheduled_notification.user_id,
            scheduled_notification.title,
            scheduled_notification.message,
            scheduled_notification.type,
            scheduled_notification.data,
            NOW()
        );
        
        -- Позначаємо заплановане сповіщення як відправлене
        UPDATE public.scheduled_notifications
        SET is_sent = true
        WHERE id = scheduled_notification.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Створення cron-завдання для обробки запланованих сповіщень
-- Примітка: для роботи cron-завдань потрібно встановити розширення pg_cron
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('*/5 * * * *', 'SELECT process_scheduled_notifications()');
