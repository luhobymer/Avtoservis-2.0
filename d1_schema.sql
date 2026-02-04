CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password TEXT,
  role TEXT,
  profile_id TEXT,
  two_factor_secret TEXT,
  two_factor_enabled INTEGER DEFAULT 0,
  two_factor_pending INTEGER DEFAULT 0,
  recovery_codes TEXT,
  email_verified INTEGER DEFAULT 0,
  email_verification_token_hash TEXT,
  email_verification_expires_at TEXT,
  email_verified_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  name TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  patronymic TEXT,
  region TEXT,
  city TEXT
);

CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT UNIQUE NOT NULL,
  settings TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS service_stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  region TEXT,
  phone TEXT,
  email TEXT,
  working_hours TEXT,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price REAL,
  price_text TEXT,
  duration INTEGER,
  duration_text TEXT,
  is_active INTEGER DEFAULT 1,
  service_station_id TEXT,
  category_id TEXT,
  created_by_mechanic_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS specializations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mechanics (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  specialization_id TEXT,
  service_station_id TEXT,
  experience_years INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mechanic_services (
  id TEXT PRIMARY KEY,
  mechanic_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  is_enabled INTEGER DEFAULT 1,
  price_override REAL,
  duration_override INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mechanic_services_unique ON mechanic_services(mechanic_id, service_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_services_mechanic_id ON mechanic_services(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_services_service_id ON mechanic_services(service_id);

CREATE TABLE IF NOT EXISTS mechanic_serviced_vehicles (
  id TEXT PRIMARY KEY,
  mechanic_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mechanic_serviced_vehicles_unique ON mechanic_serviced_vehicles(mechanic_id, vehicle_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_serviced_vehicles_mechanic_id ON mechanic_serviced_vehicles(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_serviced_vehicles_client_id ON mechanic_serviced_vehicles(client_id);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  service_station_id TEXT,
  rating INTEGER,
  comment TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  vin TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  color TEXT,
  license_plate TEXT,
  mileage INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  vehicle_id TEXT,
  vehicle_vin TEXT,
  service_type TEXT,
  service_id TEXT,
  service_ids TEXT,
  mechanic_id TEXT,
  scheduled_time TEXT,
  status TEXT DEFAULT 'pending',
  appointment_date TEXT,
  notes TEXT,
  car_info TEXT,
  completion_notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_records (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT,
  user_id TEXT,
  appointment_id TEXT,
  service_type TEXT,
  service_date TEXT NOT NULL,
  mileage INTEGER,
  description TEXT,
  performed_by TEXT,
  cost REAL,
  parts TEXT,
  recommendations TEXT,
  next_service_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_history (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  vehicle_id TEXT,
  vehicle_vin TEXT,
  appointment_id TEXT,
  service_type TEXT,
  mileage INTEGER,
  service_date TEXT NOT NULL,
  description TEXT,
  cost REAL,
  mechanic_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  article TEXT,
  manufacturer TEXT,
  price REAL,
  warranty_period INTEGER,
  description TEXT,
  part_number TEXT
);

CREATE TABLE IF NOT EXISTS repair_works (
  id TEXT PRIMARY KEY,
  service_history_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  labor_cost REAL NOT NULL,
  duration INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS repair_parts (
  id TEXT PRIMARY KEY,
  service_id TEXT,
  part_id INTEGER,
  quantity INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  service_history_id TEXT,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  object_id TEXT NOT NULL,
  object_type TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS insurance (
  id INTEGER PRIMARY KEY,
  vehicle_vin TEXT,
  policy_number TEXT NOT NULL,
  insurance_company TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  vehicle_vin TEXT,
  title TEXT NOT NULL,
  description TEXT,
  reminder_type TEXT NOT NULL,
  due_date TEXT,
  due_mileage INTEGER,
  is_completed INTEGER DEFAULT 0,
  is_recurring INTEGER DEFAULT 0,
  recurrence_interval INTEGER,
  priority TEXT DEFAULT 'medium',
  notification_sent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'pending',
  data TEXT,
  scheduled_for TEXT
);

CREATE TABLE IF NOT EXISTS interactions (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  sender_role TEXT,
  sender_name TEXT,
  recipient_id TEXT NOT NULL,
  recipient_role TEXT,
  recipient_name TEXT,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'message',
  status TEXT DEFAULT 'unread',
  related_entity TEXT,
  related_entity_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interactions_sender_id ON interactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_interactions_recipient_id ON interactions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_interactions_related ON interactions(related_entity, related_entity_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
