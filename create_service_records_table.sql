-- ========================================
-- СТВОРЕННЯ ТАБЛИЦІ SERVICE_RECORDS
-- ========================================

-- Перевіряємо чи існує таблиця
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'service_records'
) as table_exists;

-- Створюємо таблицю service_records (детальні записи про виконані роботи)
CREATE TABLE IF NOT EXISTS public.service_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_history_id UUID NOT NULL REFERENCES service_history(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    mechanic_id UUID REFERENCES mechanics(id) ON DELETE SET NULL,
    part_id UUID REFERENCES parts(id) ON DELETE SET NULL,
    
    -- Деталі роботи
    work_description TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1.0,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_price DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    
    -- Час виконання
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    
    -- Статус роботи
    status VARCHAR(20) DEFAULT 'pending',
    
    -- Додаткова інформація
    notes TEXT,
    warranty_period_days INTEGER DEFAULT 0,
    warranty_mileage INTEGER DEFAULT 0,
    
    -- Технічні дані
    before_condition TEXT,
    after_condition TEXT,
    quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
    
    -- Часові мітки
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Обмеження
    CONSTRAINT valid_status CHECK (status IN (
        'pending', 'in_progress', 'completed', 'cancelled', 
        'on_hold', 'quality_check', 'warranty_claim'
    )),
    CONSTRAINT valid_quantity CHECK (quantity > 0),
    CONSTRAINT valid_price CHECK (unit_price >= 0),
    CONSTRAINT valid_hours CHECK (
        (estimated_hours IS NULL OR estimated_hours >= 0) AND
        (actual_hours IS NULL OR actual_hours >= 0)
    ),
    CONSTRAINT valid_warranty CHECK (
        warranty_period_days >= 0 AND warranty_mileage >= 0
    )
);

-- Створюємо індекси для оптимізації
CREATE INDEX IF NOT EXISTS idx_service_records_history_id ON service_records(service_history_id);
CREATE INDEX IF NOT EXISTS idx_service_records_service_id ON service_records(service_id);
CREATE INDEX IF NOT EXISTS idx_service_records_mechanic_id ON service_records(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_service_records_part_id ON service_records(part_id);
CREATE INDEX IF NOT EXISTS idx_service_records_status ON service_records(status);
CREATE INDEX IF NOT EXISTS idx_service_records_completed ON service_records(completed_at);
CREATE INDEX IF NOT EXISTS idx_service_records_price ON service_records(total_price);
CREATE INDEX IF NOT EXISTS idx_service_records_rating ON service_records(quality_rating);

-- Створюємо тригер для оновлення updated_at
CREATE OR REPLACE FUNCTION update_service_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    
    -- Автоматично встановлюємо completed_at при зміні статусу на completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = CURRENT_TIMESTAMP;
    END IF;
    
    -- Автоматично встановлюємо started_at при зміні статусу на in_progress
    IF NEW.status = 'in_progress' AND OLD.status = 'pending' THEN
        NEW.started_at = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_service_records_updated_at
    BEFORE UPDATE ON service_records
    FOR EACH ROW
    EXECUTE FUNCTION update_service_records_updated_at();

-- Функція для розрахунку загальної вартості обслуговування
CREATE OR REPLACE FUNCTION calculate_service_total(service_history_uuid UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    total_amount DECIMAL(10,2);
BEGIN
    SELECT COALESCE(SUM(total_price), 0.00)
    INTO total_amount
    FROM service_records
    WHERE service_history_id = service_history_uuid
    AND status = 'completed';
    
    RETURN total_amount;
END;
$$ language 'plpgsql';

-- Додаємо тестові дані
INSERT INTO service_records (
    id, service_history_id, service_id, mechanic_id, part_id,
    work_description, quantity, unit_price, estimated_hours, actual_hours,
    status, notes, warranty_period_days, warranty_mileage,
    before_condition, after_condition, quality_rating,
    started_at, completed_at
) VALUES
-- Записи для першого обслуговування (заміна масла)
(
    'rec11111-1111-1111-1111-111111111111',
    (SELECT id FROM service_history WHERE service_type = 'Заміна масла' LIMIT 1),
    (SELECT id FROM services WHERE name = 'Заміна масла' LIMIT 1),
    (SELECT id FROM mechanics LIMIT 1),
    (SELECT id FROM parts WHERE name LIKE '%масло%' LIMIT 1),
    'Заміна моторного масла 5W-30',
    4.5,
    350.00,
    0.5,
    0.4,
    'completed',
    'Використано синтетичне масло преміум класу',
    180,
    15000,
    'Старе масло темне, в\'язке',
    'Нове масло чисте, прозоре',
    5,
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    CURRENT_TIMESTAMP - INTERVAL '1.5 hours'
),
(
    'rec22222-2222-2222-2222-222222222222',
    (SELECT id FROM service_history WHERE service_type = 'Заміна масла' LIMIT 1),
    (SELECT id FROM services WHERE name = 'Заміна масла' LIMIT 1),
    (SELECT id FROM mechanics LIMIT 1),
    (SELECT id FROM parts WHERE name LIKE '%фільтр%' LIMIT 1),
    'Заміна масляного фільтра',
    1.0,
    120.00,
    0.2,
    0.15,
    'completed',
    'Встановлено оригінальний фільтр',
    180,
    15000,
    'Старий фільтр забруднений',
    'Новий фільтр встановлено',
    5,
    CURRENT_TIMESTAMP - INTERVAL '1.5 hours',
    CURRENT_TIMESTAMP - INTERVAL '1.3 hours'
),

-- Записи для діагностики двигуна
(
    'rec33333-3333-3333-3333-333333333333',
    (SELECT id FROM service_history WHERE service_type = 'Діагностика двигуна' LIMIT 1),
    (SELECT id FROM services WHERE name = 'Діагностика двигуна' LIMIT 1),
    (SELECT id FROM mechanics OFFSET 1 LIMIT 1),
    NULL,
    'Комп\'ютерна діагностика двигуна',
    1.0,
    500.00,
    1.0,
    0.8,
    'completed',
    'Виявлено помилку P0171 - збіднена суміш',
    30,
    0,
    'Нестабільна робота на холостому ходу',
    'Виявлено причину нестабільної роботи',
    4,
    CURRENT_TIMESTAMP - INTERVAL '3 days 2 hours',
    CURRENT_TIMESTAMP - INTERVAL '3 days 1 hour'
),

-- Записи для заміни гальмівних колодок
(
    'rec44444-4444-4444-4444-444444444444',
    (SELECT id FROM service_history WHERE service_type = 'Заміна гальмівних колодок' LIMIT 1),
    (SELECT id FROM services WHERE name = 'Заміна гальмівних колодок' LIMIT 1),
    (SELECT id FROM mechanics OFFSET 2 LIMIT 1),
    (SELECT id FROM parts WHERE name LIKE '%колодки%' LIMIT 1),
    'Заміна передніх гальмівних колодок',
    1.0,
    800.00,
    2.0,
    1.8,
    'completed',
    'Встановлено керамічні колодки',
    365,
    30000,
    'Колодки зношені до 2мм',
    'Нові колодки встановлено, система перевірена',
    5,
    CURRENT_TIMESTAMP - INTERVAL '1 week 3 hours',
    CURRENT_TIMESTAMP - INTERVAL '1 week 1 hour'
),
(
    'rec55555-5555-5555-5555-555555555555',
    (SELECT id FROM service_history WHERE service_type = 'Заміна гальмівних колодок' LIMIT 1),
    (SELECT id FROM services WHERE name = 'Заміна гальмівних колодок' LIMIT 1),
    (SELECT id FROM mechanics OFFSET 2 LIMIT 1),
    NULL,
    'Прокачування гальмівної системи',
    1.0,
    200.00,
    0.5,
    0.4,
    'completed',
    'Заміна гальмівної рідини DOT 4',
    180,
    0,
    'Стара рідина темна',
    'Нова рідина прозора, система герметична',
    5,
    CURRENT_TIMESTAMP - INTERVAL '1 week 1.5 hours',
    CURRENT_TIMESTAMP - INTERVAL '1 week 1 hour'
),

-- Записи для розвал-схождення
(
    'rec66666-6666-6666-6666-666666666666',
    (SELECT id FROM service_history WHERE service_type = 'Розвал-схождення' LIMIT 1),
    (SELECT id FROM services WHERE name = 'Розвал-схождення' LIMIT 1),
    (SELECT id FROM mechanics OFFSET 3 LIMIT 1),
    NULL,
    'Регулювання кутів установки коліс',
    1.0,
    600.00,
    1.5,
    1.3,
    'completed',
    'Відрегульовано схождення та розвал',
    90,
    10000,
    'Схождення: +2мм/-1мм, Розвал: -0.5°/+0.3°',
    'Схождення: 0мм/0мм, Розвал: -0.2°/-0.2°',
    4,
    CURRENT_TIMESTAMP - INTERVAL '2 weeks 2 hours',
    CURRENT_TIMESTAMP - INTERVAL '2 weeks 0.5 hours'
)

ON CONFLICT (id) DO NOTHING;

-- Перевіряємо результат
SELECT 
    sr.work_description,
    sr.quantity,
    sr.unit_price,
    sr.total_price,
    sr.status,
    sr.quality_rating,
    s.name as service_name,
    m.first_name || ' ' || m.last_name as mechanic_name,
    p.name as part_name
FROM service_records sr
LEFT JOIN services s ON sr.service_id = s.id
LEFT JOIN mechanics m ON sr.mechanic_id = m.id
LEFT JOIN parts p ON sr.part_id = p.id
ORDER BY sr.created_at DESC;

-- Статистика по статусах робіт
SELECT 
    status,
    COUNT(*) as count,
    AVG(total_price) as avg_price,
    SUM(total_price) as total_revenue,
    AVG(quality_rating) as avg_rating
FROM service_records
GROUP BY status
ORDER BY count DESC;

-- Статистика по механіках
SELECT 
    m.first_name || ' ' || m.last_name as mechanic_name,
    COUNT(sr.id) as jobs_completed,
    AVG(sr.total_price) as avg_job_price,
    SUM(sr.total_price) as total_revenue,
    AVG(sr.quality_rating) as avg_rating,
    AVG(sr.actual_hours) as avg_hours_per_job
FROM service_records sr
JOIN mechanics m ON sr.mechanic_id = m.id
WHERE sr.status = 'completed'
GROUP BY m.id, m.first_name, m.last_name
ORDER BY total_revenue DESC;

-- Найпопулярніші послуги
SELECT 
    s.name as service_name,
    COUNT(sr.id) as times_performed,
    AVG(sr.total_price) as avg_price,
    SUM(sr.total_price) as total_revenue,
    AVG(sr.quality_rating) as avg_rating
FROM service_records sr
JOIN services s ON sr.service_id = s.id
WHERE sr.status = 'completed'
GROUP BY s.id, s.name
ORDER BY times_performed DESC;

-- Загальна вартість по кожному обслуговуванню
SELECT 
    sh.service_type,
    sh.service_date,
    u.email as customer_email,
    v.make || ' ' || v.model as vehicle,
    calculate_service_total(sh.id) as total_cost,
    COUNT(sr.id) as number_of_works,
    AVG(sr.quality_rating) as avg_rating
FROM service_history sh
JOIN users u ON sh.user_id = u.id
JOIN vehicles v ON sh.vehicle_id = v.id
LEFT JOIN service_records sr ON sh.id = sr.service_history_id
GROUP BY sh.id, sh.service_type, sh.service_date, u.email, v.make, v.model
ORDER BY sh.service_date DESC;