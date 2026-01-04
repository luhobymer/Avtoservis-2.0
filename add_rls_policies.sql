-- ========================================
-- ДОДАВАННЯ RLS ПОЛІТИК ДЛЯ БЕЗПЕКИ
-- ========================================

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
-- ПОЛІТИКИ ДЛЯ ТАБЛИЦІ NOTIFICATIONS
-- ========================================

-- Увімкнути RLS для notifications якщо не увімкнено
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Користувачі можуть переглядати тільки свої сповіщення
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' 
    AND policyname = 'Users can view their own notifications'
  ) THEN
    CREATE POLICY "Users can view their own notifications" ON notifications
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Користувачі можуть оновлювати тільки свої сповіщення (позначати як прочитані)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' 
    AND policyname = 'Users can update their own notifications'
  ) THEN
    CREATE POLICY "Users can update their own notifications" ON notifications
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Система може створювати сповіщення для будь-якого користувача
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' 
    AND policyname = 'System can create notifications'
  ) THEN
    CREATE POLICY "System can create notifications" ON notifications
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- ========================================
-- ПОЛІТИКИ ДЛЯ ТАБЛИЦІ REMINDERS
-- ========================================

-- Увімкнути RLS для reminders якщо не увімкнено
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Користувачі можуть переглядати тільки свої нагадування
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'reminders' 
    AND policyname = 'Users can view their own reminders'
  ) THEN
    CREATE POLICY "Users can view their own reminders" ON reminders
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Користувачі можуть створювати нагадування
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'reminders' 
    AND policyname = 'Users can create reminders'
  ) THEN
    CREATE POLICY "Users can create reminders" ON reminders
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Користувачі можуть оновлювати свої нагадування
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'reminders' 
    AND policyname = 'Users can update their own reminders'
  ) THEN
    CREATE POLICY "Users can update their own reminders" ON reminders
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

-- Увімкнути RLS для service_records якщо не увімкнено
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;

-- Користувачі можуть переглядати записи обслуговування своїх автомобілів
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'service_records' 
    AND policyname = 'Users can view their vehicles service records'
  ) THEN
    CREATE POLICY "Users can view their vehicles service records" ON service_records
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM vehicles
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

-- ========================================
-- ПОЛІТИКИ ДЛЯ ТАБЛИЦІ PARTS
-- ========================================

-- Увімкнути RLS для parts якщо не увімкнено
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;

-- Всі можуть переглядати запчастини
CREATE POLICY "Anyone can view parts" ON parts
  FOR SELECT
  USING (true);

-- Тільки адміністратори можуть керувати запчастинами
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

-- ========================================
-- ДОДАТКОВІ ПОЛІТИКИ ДЛЯ ІСНУЮЧИХ ТАБЛИЦЬ
-- ========================================

-- Додаткові політики для appointments (видалення)
CREATE POLICY "Users can delete their own appointments" ON appointments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Механіки можуть оновлювати статус записів
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

-- Адміністратори можуть керувати СТО
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

-- Адміністратори можуть керувати послугами
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

-- Адміністратори можуть керувати механіками
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
    cmd,
    qual
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