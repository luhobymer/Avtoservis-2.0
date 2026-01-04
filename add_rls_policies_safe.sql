-- ========================================
-- БЕЗПЕЧНЕ ДОДАВАННЯ RLS ПОЛІТИК
-- ========================================
-- Цей скрипт можна виконувати повторно без помилок

-- Перевіряємо поточні політики
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ========================================
-- УВІМКНЕННЯ RLS ДЛЯ ВСІХ ТАБЛИЦЬ
-- ========================================

-- Увімкнути RLS для всіх основних таблиць
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mechanics ENABLE ROW LEVEL SECURITY;

-- ========================================
-- ПОЛІТИКИ ДЛЯ ТАБЛИЦІ NOTIFICATIONS
-- ========================================

-- Користувачі можуть переглядати тільки свої сповіщення
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename = 'notifications' 
    AND policyname = 'Users can view their own notifications'
  ) THEN
    CREATE POLICY "Users can view their own notifications" ON public.notifications
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Користувачі можуть оновлювати тільки свої сповіщення
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename = 'notifications' 
    AND policyname = 'Users can update their own notifications'
  ) THEN
    CREATE POLICY "Users can update their own notifications" ON public.notifications
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Система може створювати сповіщення
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename = 'notifications' 
    AND policyname = 'System can create notifications'
  ) THEN
    CREATE POLICY "System can create notifications" ON public.notifications
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- ========================================
-- ПОЛІТИКИ ДЛЯ ТАБЛИЦІ REMINDERS
-- ========================================

-- Користувачі можуть переглядати тільки свої нагадування
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename = 'reminders' 
    AND policyname = 'Users can view their own reminders'
  ) THEN
    CREATE POLICY "Users can view their own reminders" ON public.reminders
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Користувачі можуть створювати нагадування
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename = 'reminders' 
    AND policyname = 'Users can create reminders'
  ) THEN
    CREATE POLICY "Users can create reminders" ON public.reminders
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Користувачі можуть оновлювати свої нагадування
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename = 'reminders' 
    AND policyname = 'Users can update their own reminders'
  ) THEN
    CREATE POLICY "Users can update their own reminders" ON public.reminders
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Користувачі можуть видаляти свої нагадування
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'reminders' 
    AND policyname = 'Users can delete their own reminders'
  ) THEN
    CREATE POLICY "Users can delete their own reminders" ON reminders
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ========================================
-- ПОЛІТИКИ ДЛЯ ТАБЛИЦІ SERVICE_RECORDS
-- ========================================

-- Користувачі можуть переглядати записи обслуговування своїх автомобілів
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename = 'service_records' 
    AND policyname = 'Users can view their vehicles service records'
  ) THEN
    CREATE POLICY "Users can view their vehicles service records" ON public.service_records
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.vehicles
          WHERE vehicles.id = service_records.vehicle_id
          AND vehicles.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Механіки можуть створювати записи обслуговування
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'service_records' 
    AND policyname = 'Mechanics can create service records'
  ) THEN
    CREATE POLICY "Mechanics can create service records" ON service_records
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('mechanic', 'admin')
        )
      );
  END IF;
END $$;

-- Механіки можуть оновлювати записи обслуговування
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'service_records' 
    AND policyname = 'Mechanics can update service records'
  ) THEN
    CREATE POLICY "Mechanics can update service records" ON service_records
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('mechanic', 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('mechanic', 'admin')
        )
      );
  END IF;
END $$;

-- ========================================
-- ПОЛІТИКИ ДЛЯ ТАБЛИЦІ PARTS
-- ========================================

-- Всі можуть переглядати запчастини
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'parts' 
    AND policyname = 'Anyone can view parts'
  ) THEN
    CREATE POLICY "Anyone can view parts" ON parts
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Тільки адміністратори можуть керувати запчастинами
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'parts' 
    AND policyname = 'Admins can manage parts'
  ) THEN
    CREATE POLICY "Admins can manage parts" ON parts
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;

-- ========================================
-- ДОДАТКОВІ ПОЛІТИКИ ДЛЯ ІСНУЮЧИХ ТАБЛИЦЬ
-- ========================================

-- Користувачі можуть видаляти свої записи
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'appointments' 
    AND policyname = 'Users can delete their own appointments'
  ) THEN
    CREATE POLICY "Users can delete their own appointments" ON appointments
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Механіки можуть оновлювати статус записів
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'appointments' 
    AND policyname = 'Mechanics can update appointment status'
  ) THEN
    CREATE POLICY "Mechanics can update appointment status" ON appointments
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('mechanic', 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('mechanic', 'admin')
        )
      );
  END IF;
END $$;

-- Адміністратори можуть керувати СТО
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'service_stations' 
    AND policyname = 'Admins can manage service stations'
  ) THEN
    CREATE POLICY "Admins can manage service stations" ON service_stations
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;

-- Адміністратори можуть керувати послугами
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'services' 
    AND policyname = 'Admins can manage services'
  ) THEN
    CREATE POLICY "Admins can manage services" ON services
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;

-- Адміністратори можуть керувати механіками
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'mechanics' 
    AND policyname = 'Admins can manage mechanics'
  ) THEN
    CREATE POLICY "Admins can manage mechanics" ON mechanics
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;

-- ========================================
-- ПЕРЕВІРКА РЕЗУЛЬТАТІВ
-- ========================================

-- Перевіряємо всі політики після додавання
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Перевіряємо які таблиці мають увімкнений RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Підрахунок політик по таблицях
SELECT 
    tablename,
    COUNT(*) as policies_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY policies_count DESC;