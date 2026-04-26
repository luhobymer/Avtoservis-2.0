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

INSERT INTO services (id, name, description, price, price_text, duration, duration_text, is_active, category_id, created_by_mechanic_id, created_at, updated_at) VALUES
  ('srv_diag_basic', 'Діагностика ходової', 'Перевірка підвіски на підйомнику, люфти, опори, сайлентблоки', NULL, 'від 300 грн', NULL, '20-40 хв', 1, 'cat_diagnostics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_diag_obd', 'Комп''ютерна діагностика (OBD)', 'Зчитування помилок, live-data, базові тести систем', NULL, 'від 400 грн', NULL, '20-40 хв', 1, 'cat_diagnostics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_diag_engine', 'Діагностика двигуна', 'Перевірка систем ДВЗ, підсосу повітря, параметрів, стану датчиків', NULL, 'від 500 грн', NULL, '30-60 хв', 1, 'cat_diagnostics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_diag_brakes', 'Діагностика гальм', 'Огляд колодок/дисків/супортів, перевірка витоків та магістралей', NULL, 'від 300 грн', NULL, '20-40 хв', 1, 'cat_diagnostics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_diag_electrics', 'Діагностика електрики', 'Пошук несправностей електрообладнання, перевірка запобіжників/ланцюгів', NULL, 'від 500 грн', NULL, '30-90 хв', 1, 'cat_diagnostics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_diag_leak', 'Діагностика витоків', 'Пошук витоків мастила/антифризу/палива, огляд ущільнень', NULL, 'від 400 грн', NULL, '30-60 хв', 1, 'cat_diagnostics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_diag_compression', 'Перевірка компресії', 'Вимір компресії в циліндрах (бензин/дизель за погодженням)', NULL, 'від 800 грн', NULL, '40-90 хв', 1, 'cat_diagnostics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_diag_smoke', 'Димогенератор (підсос/вакуум)', 'Перевірка підсосу повітря, вакуумних витоків димогенератором', NULL, 'від 700 грн', NULL, '30-60 хв', 1, 'cat_diagnostics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_maint_oil', 'Заміна масла двигуна', 'Заміна моторного масла та масляного фільтра', NULL, 'від 400 грн', NULL, '30-60 хв', 1, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_oil_filter', 'Заміна масляного фільтра', 'Заміна масляного фільтра (за наявності доступу)', NULL, 'від 150 грн', NULL, '10-30 хв', 1, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_air_filter', 'Заміна повітряного фільтра', 'Заміна повітряного фільтра двигуна', NULL, 'від 150 грн', NULL, '10-20 хв', 1, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_cabin_filter', 'Заміна салонного фільтра', 'Заміна фільтра салону (в т.ч. з розбором панелі за потреби)', NULL, 'від 200 грн', NULL, '15-45 хв', 1, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_fuel_filter', 'Заміна паливного фільтра', 'Заміна паливного фільтра (бензин/дизель)', NULL, 'від 300 грн', NULL, '20-60 хв', 1, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_spark_plugs', 'Заміна свічок запалювання', 'Заміна комплекту свічок запалювання', NULL, 'від 400 грн', NULL, '30-90 хв', 1, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_glow_plugs', 'Заміна свічок розжарювання', 'Заміна свічок розжарювання (дизель)', NULL, 'від 800 грн', NULL, '60-180 хв', 1, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_brake_fluid', 'Заміна гальмівної рідини', 'Прокачування системи та заміна рідини', NULL, 'від 600 грн', NULL, '40-90 хв', 1, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_coolant', 'Заміна антифризу', 'Злив/промивка/заміна охолоджуючої рідини', NULL, 'від 700 грн', NULL, '60-120 хв', 1, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_atf', 'Заміна масла АКПП (часткова)', 'Часткова заміна ATF (без апарату) за регламентом', NULL, 'від 1200 грн', NULL, '60-120 хв', 1, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_gear_oil', 'Заміна масла МКПП/редуктора', 'Заміна трансмісійного масла МКПП/редуктора', NULL, 'від 700 грн', NULL, '40-90 хв', 1, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_wipers', 'Заміна щіток склоочисника', 'Підбір та заміна щіток склоочисника', NULL, 'від 100 грн', NULL, '5-15 хв', 1, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_maint_lights_check', 'Перевірка/налаштування світла', 'Перевірка роботи ламп/фар, базове налаштування світла', NULL, 'від 200 грн', NULL, '15-30 хв', 1, 'cat_maintenance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_engine_mounts', 'Заміна подушок двигуна', 'Заміна опор/подушок двигуна, усунення вібрацій', NULL, 'від 900 грн', NULL, '60-180 хв', 1, 'cat_engine', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_engine_gaskets', 'Заміна прокладок (клапанна/піддон)', 'Усунення підтікання масла, заміна прокладок та герметика', NULL, 'від 1200 грн', NULL, '120-360 хв', 1, 'cat_engine', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_engine_intake_clean', 'Чистка впуску/дроселя', 'Чистка дросельної заслінки та впускного тракту', NULL, 'від 800 грн', NULL, '60-120 хв', 1, 'cat_engine', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_engine_egr', 'Чистка/ремонт EGR', 'Діагностика та очищення/ремонт клапана EGR', NULL, 'від 1200 грн', NULL, '120-240 хв', 1, 'cat_engine', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_engine_turbo', 'Діагностика турбіни', 'Перевірка наддуву, актуатора, патрубків, помилок', NULL, 'від 700 грн', NULL, '60-120 хв', 1, 'cat_engine', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_engine_pcV', 'Заміна/діагностика вентиляції картера', 'Перевірка та заміна клапана PCV/сапуна', NULL, 'від 600 грн', NULL, '40-90 хв', 1, 'cat_engine', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_engine_carb_clean', 'Розкоксування/чистка камер згоряння', 'Профілактична чистка нагару (метод узгоджується)', NULL, 'від 1500 грн', NULL, '120-240 хв', 1, 'cat_engine', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_timing_belt', 'Заміна ременя ГРМ (комплект)', 'Ремінь, ролики, натягувач (за потреби помпа)', NULL, 'від 3000 грн', NULL, '240-480 хв', 1, 'cat_timing', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_timing_chain', 'Заміна ланцюга ГРМ', 'Заміна комплекту ланцюга ГРМ з направляючими/натягувачем', NULL, 'від 5000 грн', NULL, '360-900 хв', 1, 'cat_timing', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_timing_accessory', 'Заміна ременя навісного', 'Заміна приводного ременя навісного обладнання', NULL, 'від 500 грн', NULL, '40-120 хв', 1, 'cat_timing', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_timing_water_pump', 'Заміна помпи (при заміні ГРМ)', 'Заміна водяної помпи разом із роботою по ГРМ (як рекомендовано)', NULL, 'від 800 грн', NULL, '60-180 хв', 1, 'cat_timing', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_trans_clutch', 'Заміна зчеплення', 'Заміна комплекту зчеплення (диск/кошик/вичавний)', NULL, 'від 4500 грн', NULL, '360-720 хв', 1, 'cat_transmission', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_trans_cv_joint', 'Заміна ШРУС/пильника', 'Внутрішній/зовнішній ШРУС або пильник', NULL, 'від 1200 грн', NULL, '120-240 хв', 1, 'cat_transmission', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_trans_driveshaft', 'Ремонт/заміна приводу', 'Заміна приводного валу або ремонт (за погодженням)', NULL, 'від 1500 грн', NULL, '120-240 хв', 1, 'cat_transmission', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_trans_mounts', 'Заміна подушок КПП', 'Заміна опор/подушок КПП', NULL, 'від 900 грн', NULL, '60-180 хв', 1, 'cat_transmission', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_trans_oil_seal', 'Заміна сальника приводу/КПП', 'Заміна сальників півосей/КПП при підтіканнях', NULL, 'від 900 грн', NULL, '90-180 хв', 1, 'cat_transmission', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_susp_shock', 'Заміна амортизаторів', 'Заміна амортизаторів (вісь/сторона залежить від авто)', NULL, 'від 1200 грн', NULL, '120-240 хв', 1, 'cat_suspension', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_susp_springs', 'Заміна пружин', 'Заміна пружин підвіски', NULL, 'від 1200 грн', NULL, '120-300 хв', 1, 'cat_suspension', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_susp_bushings', 'Заміна сайлентблоків', 'Заміна сайлентблоків важелів/балки (за узгодженням)', NULL, 'від 900 грн', NULL, '120-360 хв', 1, 'cat_suspension', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_susp_ball_joint', 'Заміна кульової опори', 'Заміна кульової опори (прес/важіль залежно від конструкції)', NULL, 'від 700 грн', NULL, '60-180 хв', 1, 'cat_suspension', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_susp_stab_links', 'Заміна стійок/втулок стабілізатора', 'Заміна стійок стабілізатора та/або втулок', NULL, 'від 500 грн', NULL, '40-120 хв', 1, 'cat_suspension', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_susp_bearing', 'Заміна ступичного підшипника', 'Заміна підшипника маточини (прес/ступиця залежно від авто)', NULL, 'від 1200 грн', NULL, '120-240 хв', 1, 'cat_suspension', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_susp_arm', 'Заміна важеля підвіски', 'Заміна важеля/тяги підвіски в зборі', NULL, 'від 900 грн', NULL, '60-180 хв', 1, 'cat_suspension', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_steer_tie_rods', 'Заміна рульових тяг/наконечників', 'Заміна рульових тяг та/або наконечників', NULL, 'від 600 грн', NULL, '60-120 хв', 1, 'cat_steering', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_steer_rack', 'Ремонт/заміна рульової рейки', 'Діагностика та ремонт/заміна рейки (за погодженням)', NULL, 'від 5000 грн', NULL, '360-900 хв', 1, 'cat_steering', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_steer_pump', 'Ремонт/заміна насоса ГПК', 'Заміна/ремонт насоса гідропідсилювача керма', NULL, 'від 2500 грн', NULL, '180-360 хв', 1, 'cat_steering', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_steer_fluid', 'Заміна рідини ГПК', 'Заміна/промивка рідини ГПК', NULL, 'від 700 грн', NULL, '40-90 хв', 1, 'cat_steering', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_brake_pads', 'Заміна гальмівних колодок', 'Заміна колодок (перед/зад), огляд супортів', NULL, 'від 600 грн', NULL, '40-90 хв', 1, 'cat_brakes', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_brake_discs', 'Заміна гальмівних дисків', 'Заміна гальмівних дисків (вісь), перевірка биття', NULL, 'від 1200 грн', NULL, '90-180 хв', 1, 'cat_brakes', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_brake_caliper', 'Ремонт/обслуговування супорта', 'Чистка напрямних, ремкомплект, профілактика клину', NULL, 'від 900 грн', NULL, '90-180 хв', 1, 'cat_brakes', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_brake_hoses', 'Заміна гальмівних шлангів/магістралей', 'Заміна шлангів/ділянок магістралей з прокачуванням', NULL, 'від 800 грн', NULL, '60-180 хв', 1, 'cat_brakes', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_brake_hand', 'Обслуговування ручного гальма', 'Діагностика та регулювання/ремонт стояночного гальма', NULL, 'від 600 грн', NULL, '60-180 хв', 1, 'cat_brakes', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_elec_battery', 'Заміна/перевірка акумулятора', 'Перевірка АКБ, пускового струму, зарядки, заміна за потреби', NULL, 'від 200 грн', NULL, '15-30 хв', 1, 'cat_electrics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_elec_alternator', 'Діагностика генератора', 'Перевірка зарядної напруги, регулятора, ременя, навантаження', NULL, 'від 500 грн', NULL, '30-60 хв', 1, 'cat_electrics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_elec_starter', 'Діагностика стартера', 'Перевірка стартера, втягуючого, проводки', NULL, 'від 500 грн', NULL, '30-60 хв', 1, 'cat_electrics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_elec_lights', 'Ремонт освітлення/заміна ламп', 'Заміна ламп/ремонт контактів, перевірка проводки', NULL, 'від 200 грн', NULL, '15-60 хв', 1, 'cat_electrics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_elec_wiring', 'Пошук обриву/короткого замикання', 'Діагностика електропроводки, пошук обривів/КЗ', NULL, 'від 800 грн', NULL, '60-180 хв', 1, 'cat_electrics', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_ac_refill', 'Заправка кондиціонера', 'Вакуумування, перевірка тиску, заправка холодоагентом', NULL, 'від 1200 грн', NULL, '40-90 хв', 1, 'cat_ac', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_ac_leak', 'Пошук витоків фреону', 'Пошук витоків (УФ/азот/електронний), рекомендації ремонту', NULL, 'від 800 грн', NULL, '40-120 хв', 1, 'cat_ac', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_ac_compressor', 'Ремонт/заміна компресора кондиціонера', 'Заміна компресора/муфти, промивка системи (за потреби)', NULL, 'від 3500 грн', NULL, '180-420 хв', 1, 'cat_ac', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_ac_clean', 'Антибактеріальна чистка кондиціонера', 'Очищення випарника, усунення запахів, дезінфекція', NULL, 'від 600 грн', NULL, '30-60 хв', 1, 'cat_ac', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_cool_radiator', 'Заміна радіатора', 'Заміна радіатора охолодження/печі (за узгодженням)', NULL, 'від 1800 грн', NULL, '180-420 хв', 1, 'cat_cooling', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_cool_thermostat', 'Заміна термостата', 'Заміна термостата, перевірка температурного режиму', NULL, 'від 1200 грн', NULL, '120-240 хв', 1, 'cat_cooling', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_cool_pump', 'Заміна помпи', 'Заміна водяної помпи (окремо від робіт по ГРМ)', NULL, 'від 1500 грн', NULL, '180-360 хв', 1, 'cat_cooling', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_cool_hoses', 'Заміна патрубків охолодження', 'Заміна патрубків/хомутів, перевірка на герметичність', NULL, 'від 700 грн', NULL, '60-180 хв', 1, 'cat_cooling', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_cool_flush', 'Промивка системи охолодження', 'Промивка системи та заміна антифризу (за потреби)', NULL, 'від 1200 грн', NULL, '120-240 хв', 1, 'cat_cooling', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_fuel_injectors', 'Діагностика/чистка форсунок', 'Діагностика, ультразвук/промивка (метод узгоджується)', NULL, 'від 1500 грн', NULL, '120-240 хв', 1, 'cat_fuel', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_fuel_pump', 'Заміна паливного насоса', 'Заміна насоса/модуля в баку, перевірка тиску', NULL, 'від 1800 грн', NULL, '120-240 хв', 1, 'cat_fuel', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_fuel_pressure', 'Перевірка тиску палива', 'Вимір тиску в паливній рампі, діагностика регулятора', NULL, 'від 600 грн', NULL, '30-60 хв', 1, 'cat_fuel', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_lpg_diag', 'Діагностика ГБО', 'Перевірка налаштувань, помилок, параметрів та герметичності', NULL, 'від 600 грн', NULL, '30-60 хв', 1, 'cat_lpg', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_lpg_tune', 'Налаштування/калібрування ГБО', 'Калібрування карти впорску, корекцій, адаптації', NULL, 'від 800 грн', NULL, '60-120 хв', 1, 'cat_lpg', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_lpg_filter', 'Заміна фільтрів ГБО', 'Заміна фільтра рідкої та/або парової фази', NULL, 'від 300 грн', NULL, '20-40 хв', 1, 'cat_lpg', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_lpg_injectors', 'Ремонт/заміна форсунок ГБО', 'Діагностика та заміна/ремонт форсунок ГБО', NULL, 'від 1200 грн', NULL, '60-180 хв', 1, 'cat_lpg', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_lpg_reducer', 'Обслуговування/ремонт редуктора ГБО', 'Ремкомплект/обслуговування редуктора, налаштування', NULL, 'від 1500 грн', NULL, '120-240 хв', 1, 'cat_lpg', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_lpg_leak', 'Перевірка герметичності ГБО', 'Пошук витоків газу та перевірка з''єднань', NULL, 'від 400 грн', NULL, '20-40 хв', 1, 'cat_lpg', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_lpg_multivalve', 'Обслуговування мультиклапана/балона', 'Перевірка/обслуговування мультиклапана, арматури балона', NULL, 'від 600 грн', NULL, '40-90 хв', 1, 'cat_lpg', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_lpg_docs', 'Перевірка/підготовка ГБО до огляду', 'Базова перевірка вузлів та рекомендації перед техоглядом', NULL, 'від 500 грн', NULL, '30-60 хв', 1, 'cat_lpg', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_exhaust_muffler', 'Ремонт/заміна глушника', 'Ремонт/заміна глушника, підварювання, кріплення', NULL, 'від 900 грн', NULL, '60-180 хв', 1, 'cat_exhaust', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_exhaust_cat', 'Діагностика каталізатора/DPF', 'Діагностика ефективності, помилок, перепаду тиску (за можливості)', NULL, 'від 800 грн', NULL, '60-120 хв', 1, 'cat_exhaust', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_exhaust_leak', 'Усунення підсосу/витоку вихлопу', 'Пошук та усунення прогарів/негерметичності вихлопної системи', NULL, 'від 700 грн', NULL, '60-180 хв', 1, 'cat_exhaust', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_body_glass', 'Заміна скла (лобове/бокове/заднє)', 'Демонтаж/монтаж скла (матеріали та клей за погодженням)', NULL, 'від 2500 грн', NULL, '180-420 хв', 1, 'cat_body', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_body_bumper', 'Зняття/встановлення бампера', 'Демонтаж/монтаж бампера для ремонту/фарбування/доступу', NULL, 'від 800 грн', NULL, '60-180 хв', 1, 'cat_body', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_body_headlight', 'Зняття/встановлення фари', 'Демонтаж/монтаж фари, перевірка кріплень/роз''ємів', NULL, 'від 500 грн', NULL, '30-120 хв', 1, 'cat_body', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_tires_mount', 'Шиномонтаж (комплект)', 'Зняття/встановлення, розбортовка/забортовка 4 коліс', NULL, 'від 900 грн', NULL, '40-90 хв', 1, 'cat_tires', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_tires_balance', 'Балансування коліс', 'Балансування 4 коліс', NULL, 'від 600 грн', NULL, '30-60 хв', 1, 'cat_tires', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_tires_repair', 'Ремонт проколу', 'Ремонт проколу/грижі (за можливості) з балансуванням', NULL, 'від 250 грн', NULL, '20-40 хв', 1, 'cat_tires', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_tires_season', 'Сезонна заміна коліс (перевзування)', 'Заміна комплекту коліс з балансуванням (за потреби)', NULL, 'від 900 грн', NULL, '40-90 хв', 1, 'cat_tires', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_align', 'Розвал-сходження', 'Регулювання кутів установки коліс, базова перевірка ходової', NULL, 'від 900 грн', NULL, '40-90 хв', 1, 'cat_alignment', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('srv_other_wash', 'Мийка двигуна (за погодженням)', 'Мийка двигуна/підкапотного простору з урахуванням безпеки електрики', NULL, 'від 800 грн', NULL, '60-120 хв', 1, 'cat_other', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('srv_other_prepurchase', 'Передпродажна діагностика', 'Комплексна перевірка авто перед купівлею (ходова/двигун/помилки)', NULL, 'від 1500 грн', NULL, '60-120 хв', 1, 'cat_other', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
