-- Estado compacto de la cuenta corriente de combustible: datos de estación,
-- vales emitidos y tickets vinculados. Se aloja en settings para reutilizar
-- el mismo control de acceso y la misma señal liviana de sincronización.
alter table public.settings
  add column if not exists fuel_account jsonb not null default '{"stationName":"","accountNumber":"","vouchers":[]}'::jsonb;

alter table public.settings
  drop constraint if exists settings_fuel_account_is_object;

alter table public.settings
  add constraint settings_fuel_account_is_object
  check (jsonb_typeof(fuel_account) = 'object');
