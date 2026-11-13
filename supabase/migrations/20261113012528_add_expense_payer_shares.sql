-- Un mismo comprobante puede ser adelantado por varios copropietarios.
-- El gasto continúa siendo único; los aportes se guardan como una lista
-- pequeña dentro del propio comprobante.
alter table public.expenses
  add column if not exists payer_shares jsonb not null default '[]'::jsonb;

alter table public.expenses
  drop constraint if exists expenses_payer_shares_is_array;

alter table public.expenses
  add constraint expenses_payer_shares_is_array
  check (jsonb_typeof(payer_shares) = 'array');
