-- SQL-запит для створення таблиці налаштувань користувача в Supabase

-- Створення таблиці user_settings
CREATE TABLE IF NOT EXISTS public.user_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id)
);

-- Додаємо коментарі до таблиці та колонок
COMMENT ON TABLE public.user_settings IS 'Таблиця для зберігання налаштувань користувачів';
COMMENT ON COLUMN public.user_settings.id IS 'Унікальний ідентифікатор запису';
COMMENT ON COLUMN public.user_settings.user_id IS 'Ідентифікатор користувача (зовнішній ключ до auth.users)';
COMMENT ON COLUMN public.user_settings.settings IS 'Налаштування користувача у форматі JSON';
COMMENT ON COLUMN public.user_settings.created_at IS 'Дата та час створення запису';
COMMENT ON COLUMN public.user_settings.updated_at IS 'Дата та час останнього оновлення запису';

-- Створення індексу для швидкого пошуку за user_id
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- Створення тригера для автоматичного оновлення updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- Налаштування RLS (Row Level Security) для таблиці
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Політика для читання власних налаштувань
CREATE POLICY "Users can read their own settings"
ON public.user_settings
FOR SELECT
USING (auth.uid() = user_id);

-- Політика для вставки власних налаштувань
CREATE POLICY "Users can insert their own settings"
ON public.user_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Політика для оновлення власних налаштувань
CREATE POLICY "Users can update their own settings"
ON public.user_settings
FOR UPDATE
USING (auth.uid() = user_id);

-- Політика для видалення власних налаштувань
CREATE POLICY "Users can delete their own settings"
ON public.user_settings
FOR DELETE
USING (auth.uid() = user_id);

-- Надання прав доступу для authenticated ролі
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.user_settings_id_seq TO authenticated;
