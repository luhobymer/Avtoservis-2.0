-- Створення таблиці refresh_tokens для зберігання токенів оновлення
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Зовнішній ключ до таблиці users
  CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Створення індексів для оптимізації запитів
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON public.refresh_tokens USING btree (token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_is_revoked ON public.refresh_tokens USING btree (is_revoked);

-- Створення функції для автоматичного оновлення updated_at
CREATE OR REPLACE FUNCTION update_refresh_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Створення тригера для автоматичного оновлення updated_at
CREATE TRIGGER refresh_tokens_updated_at_trigger
  BEFORE UPDATE ON public.refresh_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_refresh_tokens_updated_at();

-- Налаштування RLS (Row Level Security) політик
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Політика: користувачі можуть читати тільки свої токени
CREATE POLICY "Users can view own refresh tokens" ON public.refresh_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Політика: користувачі можуть оновлювати тільки свої токени
CREATE POLICY "Users can update own refresh tokens" ON public.refresh_tokens
  FOR UPDATE USING (auth.uid() = user_id);

-- Політика: користувачі можуть видаляти тільки свої токени
CREATE POLICY "Users can delete own refresh tokens" ON public.refresh_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Політика: дозволити вставку токенів (для сервера)
CREATE POLICY "Allow insert refresh tokens" ON public.refresh_tokens
  FOR INSERT WITH CHECK (true);

-- Коментарі до таблиці та полів
COMMENT ON TABLE public.refresh_tokens IS 'Таблиця для зберігання refresh токенів користувачів';
COMMENT ON COLUMN public.refresh_tokens.id IS 'Унікальний ідентифікатор токена';
COMMENT ON COLUMN public.refresh_tokens.user_id IS 'Ідентифікатор користувача';
COMMENT ON COLUMN public.refresh_tokens.token IS 'Refresh токен (JWT)';
COMMENT ON COLUMN public.refresh_tokens.expires_at IS 'Дата та час закінчення дії токена';
COMMENT ON COLUMN public.refresh_tokens.is_revoked IS 'Чи був токен відкликаний';
COMMENT ON COLUMN public.refresh_tokens.created_at IS 'Дата та час створення токена';
COMMENT ON COLUMN public.refresh_tokens.updated_at IS 'Дата та час останнього оновлення';

-- Функція для очищення застарілих токенів (можна викликати через cron)
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.refresh_tokens 
  WHERE expires_at < CURRENT_TIMESTAMP OR is_revoked = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_refresh_tokens() IS 'Функція для очищення застарілих та відкликаних refresh токенів';