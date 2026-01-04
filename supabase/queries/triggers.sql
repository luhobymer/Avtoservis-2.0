-- Тригер для оновлення кількості запчастин при використанні
CREATE OR REPLACE FUNCTION update_parts_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- Зменшуємо кількість при додаванні нової repair_part
  IF TG_OP = 'INSERT' THEN
    UPDATE parts
    SET quantity = quantity - NEW.quantity
    WHERE id = NEW.part_id;
    
    -- Перевіряємо чи не досягнуто мінімальної кількості
    IF (
      SELECT quantity <= min_quantity
      FROM parts
      WHERE id = NEW.part_id
    ) THEN
      -- Тут можна додати логіку сповіщення про низький рівень запасів
      RAISE NOTICE 'Low stock alert for part_id: %', NEW.part_id;
    END IF;
  
  -- Оновлюємо кількість при зміні repair_part
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE parts
    SET quantity = quantity + OLD.quantity - NEW.quantity
    WHERE id = NEW.part_id;
    
  -- Повертаємо кількість при видаленні repair_part
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE parts
    SET quantity = quantity + OLD.quantity
    WHERE id = OLD.part_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_parts_quantity
AFTER INSERT OR UPDATE OR DELETE ON repair_parts
FOR EACH ROW EXECUTE FUNCTION update_parts_quantity();

-- Тригер для автоматичного розрахунку вартості ремонту
CREATE OR REPLACE FUNCTION calculate_repair_cost()
RETURNS TRIGGER AS $$
DECLARE
  total_cost DECIMAL;
  parts_cost DECIMAL;
BEGIN
  -- Розраховуємо вартість запчастин
  SELECT COALESCE(SUM(quantity * price_per_unit), 0)
  INTO parts_cost
  FROM repair_parts
  WHERE repair_work_id = NEW.id;
  
  -- Загальна вартість = вартість роботи + вартість запчастин
  total_cost := NEW.labor_cost + parts_cost;
  
  -- Створюємо або оновлюємо платіж
  INSERT INTO payments (
    service_history_id,
    amount,
    payment_method,
    status
  )
  VALUES (
    NEW.service_history_id,
    total_cost,
    'pending',
    'pending'
  )
  ON CONFLICT (service_history_id) 
  DO UPDATE SET
    amount = total_cost,
    updated_at = CURRENT_TIMESTAMP;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_repair_cost
AFTER INSERT OR UPDATE ON repair_works
FOR EACH ROW EXECUTE FUNCTION calculate_repair_cost();

-- Функція для автоматичного планування технічного обслуговування
CREATE OR REPLACE FUNCTION schedule_maintenance(
  vehicle_id UUID,
  last_mileage INTEGER,
  service_interval INTEGER DEFAULT 10000
)
RETURNS TABLE (
  service_type VARCHAR,
  recommended_date DATE,
  estimated_mileage INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH last_service AS (
    SELECT 
      sh.service_date,
      sh.mileage,
      COALESCE(
        (last_mileage - sh.mileage)::DECIMAL / 
        GREATEST(
          DATE_PART('day', NOW() - sh.service_date)::DECIMAL,
          1
        ),
        0
      ) as daily_mileage
    FROM service_history sh
    WHERE sh.vehicle_id = schedule_maintenance.vehicle_id
    ORDER BY sh.service_date DESC
    LIMIT 1
  )
  SELECT 
    CASE 
      WHEN next_service_mileage - last_mileage <= 1000 THEN 'Терміновий сервіс'
      WHEN next_service_mileage - last_mileage <= 3000 THEN 'Плановий сервіс'
      ELSE 'Майбутній сервіс'
    END as service_type,
    (
      ls.service_date + 
      ((next_service_mileage - last_mileage) / GREATEST(ls.daily_mileage, 1))::INTEGER * INTERVAL '1 day'
    )::DATE as recommended_date,
    next_service_mileage as estimated_mileage
  FROM last_service ls
  CROSS JOIN (
    SELECT 
      CEIL(last_mileage::DECIMAL / service_interval) * service_interval as next_service_mileage
  ) next_service
  WHERE next_service_mileage > last_mileage;
END;
$$ LANGUAGE plpgsql;

-- Функція для розрахунку знижок
CREATE OR REPLACE FUNCTION calculate_customer_discount(customer_id UUID)
RETURNS TABLE (
  discount_percent INTEGER,
  reason TEXT
) AS $$
DECLARE
  total_spent DECIMAL;
  visit_count INTEGER;
  last_visit_date DATE;
BEGIN
  -- Отримуємо статистику клієнта
  SELECT 
    COALESCE(SUM(p.amount), 0),
    COUNT(DISTINCT sh.id),
    MAX(sh.service_date)::DATE
  INTO total_spent, visit_count, last_visit_date
  FROM vehicles v
  JOIN service_history sh ON sh.vehicle_id = v.id
  JOIN payments p ON p.service_history_id = sh.id
  WHERE v.user_id = customer_id;
  
  RETURN QUERY
  SELECT
    CASE
      WHEN total_spent > 50000 THEN 15
      WHEN total_spent > 25000 THEN 10
      WHEN total_spent > 10000 THEN 5
      WHEN visit_count >= 10 THEN 5
      WHEN last_visit_date < (CURRENT_DATE - INTERVAL '1 year') THEN 10
      ELSE 0
    END as discount_percent,
    CASE
      WHEN total_spent > 50000 THEN 'VIP клієнт'
      WHEN total_spent > 25000 THEN 'Золотий клієнт'
      WHEN total_spent > 10000 THEN 'Срібний клієнт'
      WHEN visit_count >= 10 THEN 'Постійний клієнт'
      WHEN last_visit_date < (CURRENT_DATE - INTERVAL '1 year') THEN 'Повернення клієнта'
      ELSE 'Стандартний тариф'
    END as reason;
END;
$$ LANGUAGE plpgsql;
