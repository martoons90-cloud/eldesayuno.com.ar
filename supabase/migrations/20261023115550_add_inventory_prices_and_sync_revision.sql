-- Precio unitario del inventario. Se conserva location_room para no perder
-- información histórica, aunque ya no se muestra ni se pide en la pantalla.
alter table public.inventory
  add column if not exists unit_price numeric(14, 2) not null default 0
  check (unit_price >= 0);

-- Vínculo persistente entre una factura y su cobranza, para impedir que la
-- misma se vuelva a emitir luego de recargar la página.
alter table public.expenses
  add column if not exists transferred_to_fee_collection_id text,
  add column if not exists transferred_percentage numeric(7, 4),
  add column if not exists transferred_installments integer;

-- Bitácora mínima de cambios: el navegador consulta sólo estas columnas antes
-- de pedir datos. No contiene datos personales ni copias de las tablas.
create table if not exists public.app_sync_events (
  revision bigint generated always as identity primary key,
  scope text not null,
  created_at timestamptz not null default now()
);

alter table public.app_sync_events enable row level security;
revoke all on public.app_sync_events from public, anon, authenticated;
grant select on public.app_sync_events to anon, authenticated;
drop policy if exists "sync events may be read" on public.app_sync_events;
create policy "sync events may be read"
  on public.app_sync_events for select to anon, authenticated using (true);

-- La función sólo se invoca desde triggers; no queda disponible por API.
create or replace function public.record_app_sync_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.app_sync_events(scope) values (tg_table_name);
  delete from public.app_sync_events
   where revision < greatest(0, (select coalesce(max(revision), 0) - 2000 from public.app_sync_events));
  -- Es un trigger AFTER: el valor de retorno se ignora.
  return null;
end;
$$;
revoke all on function public.record_app_sync_event() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users', 'bookings', 'blocks', 'settings', 'rules', 'contacts',
    'documents', 'inventory', 'notifications', 'fee_collections', 'expenses',
    'cash_flow', 'incidents', 'expense_categories', 'cashflow_categories',
    'fee_categories', 'inventory_categories', 'operational_categories'
  ]
  loop
    execute format('drop trigger if exists app_sync_event_trigger on public.%I', table_name);
    execute format(
      'create trigger app_sync_event_trigger after insert or update or delete on public.%I for each row execute function public.record_app_sync_event()',
      table_name
    );
  end loop;
end;
$$;
