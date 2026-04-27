-- Seed mappings between catalog services and maintenance schedule items

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

-- Заміна моторної оливи / масляного фільтра
INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_maint_oil', 'Заміна моторної оливи');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_maint_oil', 'Заміна масляного фільтра');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_maint_oil_filter', 'Заміна масляного фільтра');

-- Фільтри
INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_maint_air_filter', 'Заміна повітряного фільтра');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_maint_cabin_filter', 'Заміна фільтра салону');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_maint_fuel_filter', 'Заміна паливного фільтра');

-- Рідини
INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_maint_brake_fluid', 'Заміна гальмівної рідини');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_maint_coolant', 'Заміна антифризу');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_cool_flush', 'Заміна антифризу');

-- Запалювання
INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_maint_spark_plugs', 'Заміна свічок запалювання');

-- Трансмісія / рідини
INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_maint_atf', 'Заміна масла АКПП');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_maint_gear_oil', 'Заміна масла МКПП/редуктора');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_steer_fluid', 'Заміна рідини ГПК');

-- ГБО
INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_lpg_filter', 'Заміна фільтрів ГБО');

-- Гальмівні колодки (перевірка)
INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_diag_brakes', 'Перевірка гальмівних колодок');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_brake_pads', 'Перевірка гальмівних колодок');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_brake_pads_front', 'Заміна гальмівних колодок (передні)');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_brake_pads_rear', 'Заміна гальмівних колодок (задні)');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_brake_pads', 'Заміна гальмівних колодок (передні)');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_brake_pads', 'Заміна гальмівних колодок (задні)');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_brake_discs', 'Перевірка гальмівних колодок');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_brake_caliper', 'Перевірка гальмівних колодок');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_brake_discs_front', 'Заміна гальмівних дисків (передні)');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_brake_discs_rear', 'Заміна гальмівних дисків (задні)');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_brake_discs', 'Заміна гальмівних дисків (передні)');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_brake_discs', 'Заміна гальмівних дисків (задні)');

-- ГРМ
INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_timing_belt', 'Заміна комплекту ГРМ');

INSERT OR IGNORE INTO service_maintenance_map (id, service_id, service_item)
VALUES (lower(hex(randomblob(16))), 'srv_timing_chain', 'Заміна комплекту ГРМ');
