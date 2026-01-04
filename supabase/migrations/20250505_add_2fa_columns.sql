-- Додавання полів для двофакторної автентифікації до таблиці користувачів

-- Додаємо поле для зберігання секрету 2FA
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;

-- Додаємо поле для статусу 2FA (увімкнено/вимкнено)
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;

-- Додаємо поле для статусу очікування підтвердження 2FA
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_pending BOOLEAN DEFAULT FALSE;

-- Додаємо поле для резервних кодів відновлення
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_codes TEXT[];

-- Оновлюємо відображення для клієнтського доступу
CREATE OR REPLACE VIEW public.user_view AS
SELECT 
  id,
  email,
  role,
  created_at,
  updated_at,
  profile_id,
  two_factor_enabled
FROM users;

-- Оновлюємо політики безпеки для нових полів
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Політика для перегляду власних даних 2FA
CREATE POLICY "Users can view their own 2FA data" 
ON users FOR SELECT 
USING (auth.uid() = id);

-- Політика для оновлення власних даних 2FA
CREATE POLICY "Users can update their own 2FA data" 
ON users FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Додаємо індекс для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_users_two_factor_enabled ON users(two_factor_enabled);
