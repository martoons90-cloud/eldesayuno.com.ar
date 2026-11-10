/** Presenta fechas de la base sin cambios de zona horaria. */
export const formatDateDisplay = (value?: string | null): string => {
  if (!value) return 'Sin fecha';
  const plain = String(value).slice(0, 10);
  const match = plain.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return value;
};

/** Para meses internos YYYY-MM mostrados como MM/AAAA. */
export const formatPeriodDisplay = (value?: string | null): string => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
  return match ? `${match[2]}/${match[1]}` : (value || '-');
};
