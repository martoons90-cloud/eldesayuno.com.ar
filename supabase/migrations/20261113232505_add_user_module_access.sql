-- Excepciones individuales para la Central de Permisos.
-- {} significa que la persona mantiene los permisos heredados de su rol.
alter table public.users
  add column if not exists module_access jsonb not null default '{}'::jsonb;

alter table public.users
  drop constraint if exists users_module_access_is_object;

alter table public.users
  add constraint users_module_access_is_object
  check (jsonb_typeof(module_access) = 'object');
