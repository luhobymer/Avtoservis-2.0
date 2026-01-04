select 'expected_tables' as section;
select t.table_name
from (
  values
    ('users'),
    ('vehicles'),
    ('appointments'),
    ('service_history'),
    ('service_records'),
    ('reminders'),
    ('notifications'),
    ('parts'),
    ('services'),
    ('service_stations'),
    ('mechanics'),
    ('push_tokens'),
    ('scheduled_notifications'),
    ('user_settings')
) as t(table_name)
order by t.table_name;

select 'missing_tables' as section;
select t.table_name
from (
  values
    ('users'),
    ('vehicles'),
    ('appointments'),
    ('service_history'),
    ('service_records'),
    ('reminders'),
    ('notifications'),
    ('parts'),
    ('services'),
    ('service_stations'),
    ('mechanics'),
    ('push_tokens'),
    ('scheduled_notifications'),
    ('user_settings')
) as t(table_name)
left join information_schema.tables it
  on it.table_schema = 'public' and it.table_name = t.table_name
where it.table_name is null
order by t.table_name;

select 'rls_status' as section;
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'users',
    'vehicles',
    'appointments',
    'service_history',
    'service_records',
    'reminders',
    'notifications',
    'parts',
    'services',
    'service_stations',
    'mechanics',
    'push_tokens',
    'scheduled_notifications',
    'user_settings'
  )
order by tablename;

select 'policies' as section;
select
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'users',
    'vehicles',
    'appointments',
    'service_history',
    'service_records',
    'reminders',
    'notifications',
    'parts',
    'services',
    'service_stations',
    'mechanics',
    'push_tokens',
    'scheduled_notifications',
    'user_settings'
  )
order by tablename, policyname;

select 'policy_coverage' as section;
select
  tablename,
  sum((cmd in ('r','SELECT'))::int) as select_policies,
  sum((cmd in ('a','INSERT'))::int) as insert_policies,
  sum((cmd in ('w','UPDATE'))::int) as update_policies,
  sum((cmd in ('d','DELETE'))::int) as delete_policies,
  sum((cmd in ('*','ALL'))::int) as all_policies
from pg_policies
where schemaname = 'public'
  and tablename in (
    'users',
    'vehicles',
    'appointments',
    'service_history',
    'service_records',
    'reminders',
    'notifications',
    'parts',
    'services',
    'service_stations',
    'mechanics',
    'push_tokens',
    'scheduled_notifications',
    'user_settings'
  )
group by tablename
order by tablename;

select 'risky_policies_true' as section;
select
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('notifications','service_records','appointments','vehicles','users','push_tokens','user_settings')
  and (
    qual = 'true'
    or with_check = 'true'
  )
order by tablename, policyname;

select 'schema_contract_appointments' as section;
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'appointments'
order by ordinal_position;

select 'schema_contract_service_records' as section;
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'service_records'
order by ordinal_position;

select 'schema_contract_notifications' as section;
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'notifications'
order by ordinal_position;

select 'schema_contract_reminders' as section;
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'reminders'
order by ordinal_position;

select 'mobile_expected_columns_appointments' as section;
select
  (select count(*) from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='vehicle_id') > 0 as has_vehicle_id,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='vehicle_vin') > 0 as has_vehicle_vin,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='scheduled_time') > 0 as has_scheduled_time,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='status') > 0 as has_status;

select 'mobile_expected_columns_service_records' as section;
select
  (select count(*) from information_schema.columns where table_schema='public' and table_name='service_records' and column_name='vehicle_id') > 0 as has_vehicle_id,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='service_records' and column_name='vehicle_vin') > 0 as has_vehicle_vin,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='service_records' and column_name='description') > 0 as has_description,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='service_records' and column_name='service_details') > 0 as has_service_details,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='service_records' and column_name='mileage') > 0 as has_mileage,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='service_records' and column_name='service_date') > 0 as has_service_date,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='service_records' and column_name='performed_at') > 0 as has_performed_at;

select 'push_triggers_on_notifications' as section;
select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table = 'notifications'
order by trigger_name;
