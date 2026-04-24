DELETE FROM mechanic_services;
DELETE FROM services;
DELETE FROM service_categories;

INSERT INTO service_categories (id, name, description, created_at, updated_at) VALUES
  ('cat_diagnostics', 'Діагностика', 'Комп''ютерна та інструментальна діагностика', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_maintenance', 'Технічне обслуговування', 'Регламентні роботи та заміна витратних матеріалів', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_engine', 'Двигун', 'Обслуговування та ремонт ДВЗ', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_timing', 'ГРМ', 'Ремінь/ланцюг ГРМ та супутні роботи', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_transmission', 'Трансмісія', 'Зчеплення, КПП, приводи', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_suspension', 'Підвіска', 'Ходова частина та амортизація', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_steering', 'Рульове керування', 'Рейка, наконечники, ГПК/ЕПК', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_brakes', 'Гальмівна система', 'Гальма, супорти, рідина, магістралі', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_electrics', 'Електрика', 'Електрообладнання та освітлення', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_ac', 'Кондиціонер/клімат', 'Заправка, діагностика, ремонт клімат-системи', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_cooling', 'Охолодження', 'Радіатори, термостат, помпа, антифриз', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_fuel', 'Паливна система', 'Форсунки, паливний насос, фільтри, магістралі', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_exhaust', 'Вихлоп', 'Каталізатор, глушник, резонатор, кріплення', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_body', 'Кузов/скло', 'Кузовні елементи та скло', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_lpg', 'ГБО', 'Газобалонне обладнання (діагностика, сервіс, ремонт)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_tires', 'Шини/диски', 'Шиномонтаж та балансування', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_alignment', 'Розвал-сходження', 'Регулювання кутів установки коліс', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_other', 'Інше', 'Додаткові роботи', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO services (id, name, description, price, price_text, duration, duration_text, is_active, service_station_id, category_id, created_by_mechanic_id, created_at, updated_at) VALUES
  ('srv_diag_basic', 'Діагностика ходової', 'Перевірка підвіски на підйомнику', NULL, NULL, NULL, NULL, 1, NULL, 'cat_diagnostics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_diag_obd', 'Комп''ютерна діагностика (OBD)', 'Зчитування помилок та базові параметри', NULL, NULL, NULL, NULL, 1, NULL, 'cat_diagnostics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_diag_engine', 'Діагностика двигуна', 'Комплексна перевірка систем ДВЗ', NULL, NULL, NULL, NULL, 1, NULL, 'cat_diagnostics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_diag_brakes', 'Діагностика гальм', 'Огляд колодок/дисків/супортів', NULL, NULL, NULL, NULL, 1, NULL, 'cat_diagnostics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_diag_electrics', 'Діагностика електрики', 'Пошук несправностей електрообладнання', NULL, NULL, NULL, NULL, 1, NULL, 'cat_diagnostics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_diag_leak', 'Діагностика витоків', 'Пошук витоків мастила/антифризу/палива', NULL, NULL, NULL, NULL, 1, NULL, 'cat_diagnostics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_maint_oil', 'Заміна масла двигуна', 'Заміна моторного масла та масляного фільтра', NULL, NULL, NULL, NULL, 1, NULL, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_oil_filter', 'Заміна масляного фільтра', NULL, NULL, NULL, NULL, 1, NULL, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_air_filter', 'Заміна повітряного фільтра', NULL, NULL, NULL, NULL, 1, NULL, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_cabin_filter', 'Заміна салонного фільтра', NULL, NULL, NULL, NULL, 1, NULL, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_fuel_filter', 'Заміна паливного фільтра', NULL, NULL, NULL, NULL, 1, NULL, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_spark_plugs', 'Заміна свічок запалювання', NULL, NULL, NULL, NULL, 1, NULL, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_glow_plugs', 'Заміна свічок розжарювання', NULL, NULL, NULL, NULL, 1, NULL, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_brake_fluid', 'Заміна гальмівної рідини', 'Прокачування системи та заміна рідини', NULL, NULL, NULL, NULL, 1, NULL, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_coolant', 'Заміна антифризу', 'Злив/промивка/заміна охолоджуючої рідини', NULL, NULL, NULL, NULL, 1, NULL, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_atf', 'Заміна масла АКПП (часткова)', NULL, NULL, NULL, NULL, 1, NULL, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_gear_oil', 'Заміна масла МКПП/редуктора', NULL, NULL, NULL, NULL, 1, NULL, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_engine_mounts', 'Заміна подушок двигуна', NULL, NULL, NULL, NULL, 1, NULL, 'cat_engine', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_engine_gaskets', 'Заміна прокладок (клапанна/піддон)', 'Усунення підтікання масла', NULL, NULL, NULL, NULL, 1, NULL, 'cat_engine', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_engine_intake_clean', 'Чистка впуску/дроселя', 'Чистка дросельної заслінки та впускного тракту', NULL, NULL, NULL, NULL, 1, NULL, 'cat_engine', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_engine_egr', 'Чистка/ремонт EGR', NULL, NULL, NULL, NULL, 1, NULL, 'cat_engine', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_engine_turbo', 'Діагностика турбіни', NULL, NULL, NULL, NULL, 1, NULL, 'cat_engine', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_timing_belt', 'Заміна ременя ГРМ (комплект)', 'Ремінь, ролики, натягувач (за потреби помпа)', NULL, NULL, NULL, NULL, 1, NULL, 'cat_timing', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_timing_chain', 'Заміна ланцюга ГРМ', NULL, NULL, NULL, NULL, 1, NULL, 'cat_timing', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_timing_accessory', 'Заміна ременя навісного', NULL, NULL, NULL, NULL, 1, NULL, 'cat_timing', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_trans_clutch', 'Заміна зчеплення', NULL, NULL, NULL, NULL, 1, NULL, 'cat_transmission', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_trans_cv_joint', 'Заміна ШРУС/пильника', 'Внутрішній/зовнішній ШРУС або пильник', NULL, NULL, NULL, NULL, 1, NULL, 'cat_transmission', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_trans_driveshaft', 'Ремонт/заміна приводу', NULL, NULL, NULL, NULL, 1, NULL, 'cat_transmission', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_trans_mounts', 'Заміна подушок КПП', NULL, NULL, NULL, NULL, 1, NULL, 'cat_transmission', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_susp_shock', 'Заміна амортизаторів', NULL, NULL, NULL, NULL, 1, NULL, 'cat_suspension', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_susp_springs', 'Заміна пружин', NULL, NULL, NULL, NULL, 1, NULL, 'cat_suspension', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_susp_bushings', 'Заміна сайлентблоків', NULL, NULL, NULL, NULL, 1, NULL, 'cat_suspension', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_susp_ball_joint', 'Заміна кульової опори', NULL, NULL, NULL, NULL, 1, NULL, 'cat_suspension', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_susp_stab_links', 'Заміна стійок/втулок стабілізатора', NULL, NULL, NULL, NULL, 1, NULL, 'cat_suspension', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_susp_bearing', 'Заміна ступичного підшипника', NULL, NULL, NULL, NULL, 1, NULL, 'cat_suspension', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_steer_tie_rods', 'Заміна рульових тяг/наконечників', NULL, NULL, NULL, NULL, 1, NULL, 'cat_steering', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_steer_rack', 'Ремонт/заміна рульової рейки', NULL, NULL, NULL, NULL, 1, NULL, 'cat_steering', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_steer_pump', 'Ремонт/заміна насоса ГПК', NULL, NULL, NULL, NULL, 1, NULL, 'cat_steering', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_brake_pads', 'Заміна гальмівних колодок', NULL, NULL, NULL, NULL, 1, NULL, 'cat_brakes', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_brake_discs', 'Заміна гальмівних дисків', NULL, NULL, NULL, NULL, 1, NULL, 'cat_brakes', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_brake_caliper', 'Ремонт/обслуговування супорта', NULL, NULL, NULL, NULL, 1, NULL, 'cat_brakes', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_brake_hoses', 'Заміна гальмівних шлангів/магістралей', NULL, NULL, NULL, NULL, 1, NULL, 'cat_brakes', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_elec_battery', 'Заміна/перевірка акумулятора', NULL, NULL, NULL, NULL, 1, NULL, 'cat_electrics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_elec_alternator', 'Діагностика генератора', NULL, NULL, NULL, NULL, 1, NULL, 'cat_electrics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_elec_starter', 'Діагностика стартера', NULL, NULL, NULL, NULL, 1, NULL, 'cat_electrics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_elec_lights', 'Ремонт освітлення/заміна ламп', NULL, NULL, NULL, NULL, 1, NULL, 'cat_electrics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_ac_refill', 'Заправка кондиціонера', NULL, NULL, NULL, NULL, 1, NULL, 'cat_ac', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_ac_leak', 'Пошук витоків фреону', NULL, NULL, NULL, NULL, 1, NULL, 'cat_ac', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_ac_compressor', 'Ремонт/заміна компресора кондиціонера', NULL, NULL, NULL, NULL, 1, NULL, 'cat_ac', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_cool_radiator', 'Заміна радіатора', NULL, NULL, NULL, NULL, 1, NULL, 'cat_cooling', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_cool_thermostat', 'Заміна термостата', NULL, NULL, NULL, NULL, 1, NULL, 'cat_cooling', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_cool_pump', 'Заміна помпи', NULL, NULL, NULL, NULL, 1, NULL, 'cat_cooling', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_cool_hoses', 'Заміна патрубків охолодження', NULL, NULL, NULL, NULL, 1, NULL, 'cat_cooling', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_fuel_injectors', 'Діагностика/чистка форсунок', NULL, NULL, NULL, NULL, 1, NULL, 'cat_fuel', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_fuel_pump', 'Заміна паливного насоса', NULL, NULL, NULL, NULL, 1, NULL, 'cat_fuel', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_lpg_diag', 'Діагностика ГБО', 'Перевірка налаштувань, помилок, параметрів та герметичності', NULL, NULL, NULL, NULL, 1, NULL, 'cat_lpg', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_lpg_tune', 'Налаштування/калібрування ГБО', 'Калібрування карти впорску та корекцій', NULL, NULL, NULL, NULL, 1, NULL, 'cat_lpg', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_lpg_filter', 'Заміна фільтрів ГБО', 'Заміна фільтра рідкої та/або парової фази', NULL, NULL, NULL, NULL, 1, NULL, 'cat_lpg', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_lpg_injectors', 'Ремонт/заміна форсунок ГБО', NULL, NULL, NULL, NULL, 1, NULL, 'cat_lpg', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_lpg_reducer', 'Обслуговування/ремонт редуктора ГБО', NULL, NULL, NULL, NULL, 1, NULL, 'cat_lpg', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_lpg_leak', 'Перевірка герметичності ГБО', 'Пошук витоків газу та перевірка з''єднань', NULL, NULL, NULL, NULL, 1, NULL, 'cat_lpg', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_lpg_multivalve', 'Обслуговування мультиклапана/балона', NULL, NULL, NULL, NULL, 1, NULL, 'cat_lpg', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_exhaust_muffler', 'Ремонт/заміна глушника', NULL, NULL, NULL, NULL, 1, NULL, 'cat_exhaust', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_exhaust_cat', 'Діагностика каталізатора/DPF', NULL, NULL, NULL, NULL, 1, NULL, 'cat_exhaust', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_body_glass', 'Заміна скла (лобове/бокове/заднє)', NULL, NULL, NULL, NULL, 1, NULL, 'cat_body', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_body_bumper', 'Зняття/встановлення бампера', NULL, NULL, NULL, NULL, 1, NULL, 'cat_body', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_tires_mount', 'Шиномонтаж (комплект)', NULL, NULL, NULL, NULL, 1, NULL, 'cat_tires', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_tires_balance', 'Балансування коліс', NULL, NULL, NULL, NULL, 1, NULL, 'cat_tires', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_tires_repair', 'Ремонт проколу', NULL, NULL, NULL, NULL, 1, NULL, 'cat_tires', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_align', 'Розвал-сходження', NULL, NULL, NULL, NULL, 1, NULL, 'cat_alignment', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_other_wash', 'Мийка двигуна (за погодженням)', NULL, NULL, NULL, NULL, 1, NULL, 'cat_other', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_other_prepurchase', 'Передпродажна діагностика', NULL, NULL, NULL, NULL, 1, NULL, 'cat_other', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
