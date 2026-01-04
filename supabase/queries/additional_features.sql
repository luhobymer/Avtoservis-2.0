-- Додавання таблиці для push-повідомлень
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'appointment', 'maintenance', 'payment', etc.
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'read'
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Додавання таблиці для налаштувань сповіщень користувачів
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  telegram_notifications BOOLEAN DEFAULT false,
  viber_notifications BOOLEAN DEFAULT false,
  maintenance_reminders BOOLEAN DEFAULT true,
  appointment_reminders BOOLEAN DEFAULT true,
  payment_reminders BOOLEAN DEFAULT true,
  telegram_chat_id VARCHAR(100),
  viber_chat_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Додавання таблиці для відгуків
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_history_id UUID REFERENCES service_history(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  response TEXT,
  response_date TIMESTAMP WITH TIME ZONE,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Додавання таблиці для знижок та акцій
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL, -- 'percentage', 'fixed_amount'
  discount_value DECIMAL(10,2) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  conditions TEXT, -- JSON з умовами застосування знижки
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Додавання таблиці для документів
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_history_id UUID REFERENCES service_history(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'invoice', 'receipt', 'warranty', 'report'
  file_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Додавання індексів
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_reviews_service_history_id ON reviews(service_history_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_documents_service_history_id ON documents(service_history_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);

-- Додавання RLS політик
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Політики для сповіщень
CREATE POLICY "Користувачі бачать свої сповіщення" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Політики для налаштувань сповіщень
CREATE POLICY "Користувачі керують своїми налаштуваннями" ON notification_settings
  FOR ALL USING (auth.uid() = user_id);

-- Політики для відгуків
CREATE POLICY "Публічний перегляд відгуків" ON reviews
  FOR SELECT USING (is_public = true);

CREATE POLICY "Користувачі керують своїми відгуками" ON reviews
  FOR ALL USING (auth.uid() = user_id);

-- Політики для акцій
CREATE POLICY "Публічний перегляд активних акцій" ON promotions
  FOR SELECT USING (
    is_active = true AND 
    start_date <= CURRENT_TIMESTAMP AND 
    end_date >= CURRENT_TIMESTAMP
  );

-- Політики для документів
CREATE POLICY "Користувачі бачать свої документи" ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM service_history sh
      JOIN vehicles v ON v.id = sh.vehicle_id
      WHERE sh.id = documents.service_history_id
      AND v.user_id = auth.uid()
    )
  );

-- Функція для створення сповіщення
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title VARCHAR,
  p_message TEXT,
  p_type VARCHAR,
  p_scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    scheduled_for
  ) VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type,
    COALESCE(p_scheduled_for, CURRENT_TIMESTAMP)
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;
