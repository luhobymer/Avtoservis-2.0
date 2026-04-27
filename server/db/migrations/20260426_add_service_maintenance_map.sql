-- Map services to maintenance schedule items (regulations)

CREATE TABLE IF NOT EXISTS service_maintenance_map (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  service_item TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_maintenance_map_service_id ON service_maintenance_map(service_id);
CREATE INDEX IF NOT EXISTS idx_service_maintenance_map_service_item ON service_maintenance_map(service_item);
CREATE UNIQUE INDEX IF NOT EXISTS ux_service_maintenance_map_service_item ON service_maintenance_map(service_id, service_item);

-- Seed baseline mappings for common services (if those services exist)
INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
SELECT lower(hex(randomblob(16))) AS id, s.id AS service_id, 'Заміна моторної оливи' AS service_item
FROM services s
WHERE lower(s.name) IN (
  'заміна масла двигуна',
  'заміна моторного масла'
);

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
SELECT lower(hex(randomblob(16))) AS id, s.id AS service_id, 'Заміна масляного фільтра' AS service_item
FROM services s
WHERE lower(s.name) IN (
  'заміна масла двигуна',
  'заміна моторного масла',
  'заміна масляного фільтра'
);

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
SELECT lower(hex(randomblob(16))) AS id, s.id AS service_id, 'Заміна повітряного фільтра' AS service_item
FROM services s
WHERE lower(s.name) IN ('заміна повітряного фільтра');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
SELECT lower(hex(randomblob(16))) AS id, s.id AS service_id, 'Заміна фільтра салону' AS service_item
FROM services s
WHERE lower(s.name) IN (
  'заміна салонного фільтра',
  'заміна фільтра салону'
);

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
SELECT lower(hex(randomblob(16))) AS id, s.id AS service_id, 'Заміна паливного фільтра' AS service_item
FROM services s
WHERE lower(s.name) IN ('заміна паливного фільтра');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
SELECT lower(hex(randomblob(16))) AS id, s.id AS service_id, 'Заміна гальмівної рідини' AS service_item
FROM services s
WHERE lower(s.name) IN ('заміна гальмівної рідини');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
SELECT lower(hex(randomblob(16))) AS id, s.id AS service_id, 'Заміна антифризу' AS service_item
FROM services s
WHERE lower(s.name) IN ('заміна антифризу');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
SELECT lower(hex(randomblob(16))) AS id, s.id AS service_id, 'Заміна свічок запалювання' AS service_item
FROM services s
WHERE lower(s.name) IN ('заміна свічок запалювання');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
SELECT lower(hex(randomblob(16))) AS id, s.id AS service_id, 'Перевірка гальмівних колодок' AS service_item
FROM services s
WHERE lower(s.name) IN (
  'діагностика гальмівної системи',
  'перевірка гальм'
);

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
SELECT lower(hex(randomblob(16))) AS id, s.id AS service_id, 'Заміна комплекту ГРМ' AS service_item
FROM services s
WHERE lower(s.name) IN (
  'заміна ременя грм',
  'заміна комплекту грм'
);
