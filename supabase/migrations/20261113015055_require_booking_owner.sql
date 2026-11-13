-- Una estadía siempre pertenece a un copropietario. Los bloqueos de
-- mantenimiento se guardan en `blocks`, por lo que no están alcanzados.
alter table public.bookings
  alter column user_id set not null,
  alter column user_name set not null;

alter table public.bookings
  drop constraint if exists bookings_require_assigned_user;

alter table public.bookings
  add constraint bookings_require_assigned_user
  check (length(btrim(user_id)) > 0 and length(btrim(user_name)) > 0);
