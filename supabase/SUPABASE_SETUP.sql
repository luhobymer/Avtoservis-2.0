-- SQL скрипт для налаштування Supabase
-- Виконати в Supabase SQL Editor

-- 1. Створення таблиці користувачів з правильною структурою
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'client' CHECK (role IN ('client', 'mechanic', 'admin')),
    "twoFactorEnabled" BOOLEAN DEFAULT false,
    "twoFactorSecret" VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Створення індексів для оптимізації
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 3. Створення функції для автоматичного оновлення updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Створення тригера для автоматичного оновлення updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Налаштування RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 6. Створення політик безпеки
-- Дозволити service_role повний доступ
CREATE POLICY "Service role can do everything" ON public.users
    FOR ALL USING (auth.role() = 'service_role');

-- Дозволити користувачам читати свої дані
CREATE POLICY "Users can read own data" ON public.users
    FOR SELECT USING (auth.uid()::text = id::text);

-- Дозволити користувачам оновлювати свої дані (крім ролі)
CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid()::text = id::text)
    WITH CHECK (auth.uid()::text = id::text AND role = OLD.role);

-- 7. Створення таблиці автомобілів
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER,
    license_plate VARCHAR(20),
    vin VARCHAR(17),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Індекси для таблиці автомобілів
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON public.vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_license_plate ON public.vehicles(license_plate);

-- 9. Тригер для updated_at в таблиці автомобілів
DROP TRIGGER IF EXISTS update_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER update_vehicles_updated_at
    BEFORE UPDATE ON public.vehicles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 10. RLS для таблиці автомобілів
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Політики для автомобілів
CREATE POLICY "Service role can do everything on vehicles" ON public.vehicles
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can manage own vehicles" ON public.vehicles
    FOR ALL USING (auth.uid()::text = user_id::text);

-- 11. Створення таблиці заявок на пробіг
CREATE TABLE IF NOT EXISTS public.mileage_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    current_mileage INTEGER NOT NULL,
    previous_mileage INTEGER,
    mileage_difference INTEGER,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Індекси для заявок на пробіг
CREATE INDEX IF NOT EXISTS idx_mileage_requests_user_id ON public.mileage_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_mileage_requests_vehicle_id ON public.mileage_requests(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_mileage_requests_status ON public.mileage_requests(status);

-- 13. Тригер для updated_at в заявках на пробіг
DROP TRIGGER IF EXISTS update_mileage_requests_updated_at ON public.mileage_requests;
CREATE TRIGGER update_mileage_requests_updated_at
    BEFORE UPDATE ON public.mileage_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 14. RLS для заявок на пробіг
ALTER TABLE public.mileage_requests ENABLE ROW LEVEL SECURITY;

-- Політики для заявок на пробіг
CREATE POLICY "Service role can do everything on mileage_requests" ON public.mileage_requests
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can manage own mileage_requests" ON public.mileage_requests
    FOR ALL USING (auth.uid()::text = user_id::text);

-- 15. Створення тестового користувача
-- Пароль: test123
INSERT INTO public.users (email, password, name, role) 
VALUES (
    'test@example.com', 
    '$2a$10$b7vwZ1ZCNpEGmj9hmkY7VeclhyH.D7hQA.a9XVGqlkpNxk/ahl32q', -- bcrypt хеш для 'test123'
    'Тестовий Користувач',
    'client'
) ON CONFLICT (email) DO NOTHING;

-- 16. Перевірка створених таблиць
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name IN ('users', 'vehicles', 'mileage_requests')
ORDER BY table_name, ordinal_position;

-- 17. Перевірка політик безпеки
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public';

-- Примітки:
-- 1. Виконайте цей скрипт в Supabase SQL Editor
-- 2. Замініть хеш пароля для тестового користувача на реальний
-- 3. Перевірте, що всі таблиці створені правильно
-- 4. Переконайтеся, що RLS політики працюють коректно