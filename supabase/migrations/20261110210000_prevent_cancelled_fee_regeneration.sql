-- Una cobranza anulada desde Cobranzas no debe recrearse al volver a guardar
-- el gasto/adelanto que la originó. Se conserva la fecha de anulación para
-- permitir emitir una nueva cobranza manualmente si corresponde.
alter table public.expenses
  add column if not exists collection_cancelled_at timestamptz;
