-- Створення таблиці запчастин
CREATE TABLE IF NOT EXISTS parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  manufacturer VARCHAR(100),
  part_number VARCHAR(50),
  price DECIMAL(10,2) NOT NULL,
  quantity INTEGER DEFAULT 0,
  min_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Створення таблиці ремонтних робіт
CREATE TABLE IF NOT EXISTS repair_works (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_history_id UUID REFERENCES service_history(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  labor_cost DECIMAL(10,2) NOT NULL,
  duration INTEGER NOT NULL, -- тривалість у хвилинах
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Створення таблиці використаних запчастин
CREATE TABLE IF NOT EXISTS repair_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repair_work_id UUID REFERENCES repair_works(id) ON DELETE CASCADE,
  part_id UUID REFERENCES parts(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  price_per_unit DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Створення таблиці платежів
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_history_id UUID REFERENCES service_history(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payment_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Створення індексів
CREATE INDEX IF NOT EXISTS idx_parts_part_number ON parts(part_number);
CREATE INDEX IF NOT EXISTS idx_repair_works_service_history_id ON repair_works(service_history_id);
CREATE INDEX IF NOT EXISTS idx_repair_parts_repair_work_id ON repair_parts(repair_work_id);
CREATE INDEX IF NOT EXISTS idx_repair_parts_part_id ON repair_parts(part_id);
CREATE INDEX IF NOT EXISTS idx_payments_service_history_id ON payments(service_history_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Додавання RLS політик
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Політики для запчастин
CREATE POLICY "Публічний перегляд запчастин" ON parts
  FOR SELECT USING (true);

CREATE POLICY "Тільки адміністратори можуть керувати запчастинами" ON parts
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'admin'
    )
  );

-- Політики для ремонтних робіт
CREATE POLICY "Клієнти можуть переглядати свої ремонтні роботи" ON repair_works
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM service_history sh
      JOIN vehicles v ON v.id = sh.vehicle_id
      WHERE sh.id = repair_works.service_history_id
      AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Механіки можуть керувати ремонтними роботами" ON repair_works
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role IN ('admin', 'mechanic')
    )
  );

-- Політики для використаних запчастин
CREATE POLICY "Клієнти можуть переглядати використані запчастини" ON repair_parts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM repair_works rw
      JOIN service_history sh ON sh.id = rw.service_history_id
      JOIN vehicles v ON v.id = sh.vehicle_id
      WHERE rw.id = repair_parts.repair_work_id
      AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Механіки можуть керувати використаними запчастинами" ON repair_parts
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role IN ('admin', 'mechanic')
    )
  );

-- Політики для платежів
CREATE POLICY "Клієнти можуть переглядати свої платежі" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM service_history sh
      JOIN vehicles v ON v.id = sh.vehicle_id
      WHERE sh.id = payments.service_history_id
      AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Адміністратори можуть керувати платежами" ON payments
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'admin'
    )
  );
