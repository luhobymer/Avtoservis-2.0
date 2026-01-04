-- Загальна статистика по ремонтах за період
CREATE OR REPLACE FUNCTION get_repair_statistics(start_date DATE, end_date DATE)
RETURNS TABLE (
  total_repairs BIGINT,
  total_revenue DECIMAL,
  avg_repair_cost DECIMAL,
  most_common_service VARCHAR,
  most_used_part VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT sh.id) as total_repairs,
    SUM(p.amount) as total_revenue,
    AVG(p.amount) as avg_repair_cost,
    (
      SELECT rw.name
      FROM repair_works rw
      GROUP BY rw.name
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as most_common_service,
    (
      SELECT parts.name
      FROM repair_parts rp
      JOIN parts ON parts.id = rp.part_id
      GROUP BY parts.name
      ORDER BY SUM(rp.quantity) DESC
      LIMIT 1
    ) as most_used_part
  FROM service_history sh
  JOIN payments p ON p.service_history_id = sh.id
  WHERE sh.service_date BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

-- Статистика по запчастинах
CREATE OR REPLACE FUNCTION get_parts_statistics()
RETURNS TABLE (
  part_name VARCHAR,
  total_used BIGINT,
  revenue DECIMAL,
  current_stock INTEGER,
  needs_restock BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name as part_name,
    COALESCE(SUM(rp.quantity), 0) as total_used,
    COALESCE(SUM(rp.quantity * rp.price_per_unit), 0) as revenue,
    p.quantity as current_stock,
    p.quantity <= p.min_quantity as needs_restock
  FROM parts p
  LEFT JOIN repair_parts rp ON rp.part_id = p.id
  GROUP BY p.id, p.name, p.quantity, p.min_quantity
  ORDER BY needs_restock DESC, total_used DESC;
END;
$$ LANGUAGE plpgsql;

-- Статистика по механіках
CREATE OR REPLACE FUNCTION get_mechanics_statistics(start_date DATE, end_date DATE)
RETURNS TABLE (
  mechanic_name TEXT,
  repairs_completed BIGINT,
  total_hours DECIMAL,
  total_revenue DECIMAL,
  avg_repair_time DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.first_name || ' ' || m.last_name as mechanic_name,
    COUNT(DISTINCT sh.id) as repairs_completed,
    SUM(rw.duration) / 60.0 as total_hours,
    SUM(p.amount) as total_revenue,
    AVG(rw.duration) as avg_repair_time
  FROM mechanics m
  JOIN service_history sh ON sh.mechanic_id = m.id
  JOIN repair_works rw ON rw.service_history_id = sh.id
  JOIN payments p ON p.service_history_id = sh.id
  WHERE sh.service_date BETWEEN start_date AND end_date
  GROUP BY m.id, m.first_name, m.last_name
  ORDER BY total_revenue DESC;
END;
$$ LANGUAGE plpgsql;

-- Статистика по клієнтах
CREATE OR REPLACE FUNCTION get_customer_statistics(start_date DATE, end_date DATE)
RETURNS TABLE (
  customer_email VARCHAR,
  total_visits BIGINT,
  total_spent DECIMAL,
  favorite_service VARCHAR,
  last_visit TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.email as customer_email,
    COUNT(DISTINCT sh.id) as total_visits,
    SUM(p.amount) as total_spent,
    (
      SELECT rw.name
      FROM repair_works rw
      WHERE rw.service_history_id IN (
        SELECT id FROM service_history 
        WHERE vehicle_id IN (SELECT id FROM vehicles WHERE user_id = u.id)
      )
      GROUP BY rw.name
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as favorite_service,
    MAX(sh.service_date) as last_visit
  FROM users u
  JOIN vehicles v ON v.user_id = u.id
  JOIN service_history sh ON sh.vehicle_id = v.id
  JOIN payments p ON p.service_history_id = sh.id
  WHERE sh.service_date BETWEEN start_date AND end_date
  GROUP BY u.id, u.email
  ORDER BY total_spent DESC;
END;
$$ LANGUAGE plpgsql;

-- Прогноз потреби в запчастинах
CREATE OR REPLACE FUNCTION predict_parts_demand(days_ahead INTEGER)
RETURNS TABLE (
  part_name VARCHAR,
  current_stock INTEGER,
  predicted_demand INTEGER,
  suggested_order INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_usage AS (
    SELECT 
      p.id,
      p.name,
      p.quantity as current_stock,
      p.min_quantity,
      COALESCE(
        CEIL(
          SUM(rp.quantity)::DECIMAL / 
          GREATEST(
            DATE_PART('day', NOW() - MIN(sh.service_date))::DECIMAL,
            1
          )
        ),
        0
      ) as daily_usage
    FROM parts p
    LEFT JOIN repair_parts rp ON rp.part_id = p.id
    LEFT JOIN repair_works rw ON rw.id = rp.repair_work_id
    LEFT JOIN service_history sh ON sh.id = rw.service_history_id
    GROUP BY p.id, p.name, p.quantity, p.min_quantity
  )
  SELECT 
    du.name as part_name,
    du.current_stock,
    (du.daily_usage * days_ahead)::INTEGER as predicted_demand,
    GREATEST(
      0,
      (du.daily_usage * days_ahead)::INTEGER - du.current_stock + du.min_quantity
    ) as suggested_order
  FROM daily_usage du
  ORDER BY suggested_order DESC;
END;
$$ LANGUAGE plpgsql;
