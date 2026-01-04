-- Додавання тестових запчастин
INSERT INTO parts (name, description, manufacturer, part_number, price, quantity, min_quantity) VALUES
('Масляний фільтр', 'Фільтр моторного масла', 'Bosch', 'P7029', 150.00, 20, 5),
('Повітряний фільтр', 'Фільтр повітря двигуна', 'Mann', 'C2295', 200.00, 15, 3),
('Гальмівні колодки передні', 'Комплект передніх гальмівних колодок', 'TRW', 'GDB1550', 800.00, 10, 2),
('Гальмівні диски передні', 'Пара передніх гальмівних дисків', 'Brembo', '09.9772.10', 2500.00, 4, 2),
('Свічки запалювання', 'Комплект свічок запалювання', 'NGK', 'LZKAR6AP-11', 120.00, 40, 8);

-- Додавання тестових ремонтних робіт для існуючих записів історії обслуговування
INSERT INTO repair_works (service_history_id, name, description, labor_cost, duration)
SELECT 
  sh.id,
  'Заміна масла та фільтрів',
  'Заміна моторного масла, масляного та повітряного фільтрів',
  500.00,
  60
FROM service_history sh
LIMIT 1;

INSERT INTO repair_works (service_history_id, name, description, labor_cost, duration)
SELECT 
  sh.id,
  'Заміна гальмівних колодок',
  'Заміна передніх гальмівних колодок та перевірка гальмівної системи',
  400.00,
  90
FROM service_history sh
LIMIT 1;

-- Додавання використаних запчастин до ремонтних робіт
INSERT INTO repair_parts (repair_work_id, part_id, quantity, price_per_unit)
SELECT 
  rw.id,
  p.id,
  1,
  p.price
FROM repair_works rw
CROSS JOIN parts p
WHERE p.name = 'Масляний фільтр'
LIMIT 1;

INSERT INTO repair_parts (repair_work_id, part_id, quantity, price_per_unit)
SELECT 
  rw.id,
  p.id,
  1,
  p.price
FROM repair_works rw
CROSS JOIN parts p
WHERE p.name = 'Повітряний фільтр'
LIMIT 1;

-- Додавання тестових платежів
INSERT INTO payments (service_history_id, amount, payment_method, status, payment_date)
SELECT 
  sh.id,
  (
    SELECT SUM(rw.labor_cost + (rp.quantity * rp.price_per_unit))
    FROM repair_works rw
    LEFT JOIN repair_parts rp ON rp.repair_work_id = rw.id
    WHERE rw.service_history_id = sh.id
  ),
  'card',
  'completed',
  NOW()
FROM service_history sh
LIMIT 1;
