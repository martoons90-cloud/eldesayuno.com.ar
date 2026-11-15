import React, { useEffect, useMemo, useState } from 'react';
import { Download, Fuel, Plus, Printer, Receipt, Share2, Ticket, Trash2, X } from 'lucide-react';
import { ExpenseItem, FuelAccount, FuelTicket, FuelVoucher, TrustSettings, User, canWriteModule } from '../types';
import { storageService } from '../services/storageService';

interface FuelAccountViewProps {
  currentUser: User;
  settings: TrustSettings;
  users: User[];
}

const emptyAccount = (): FuelAccount => ({ stationName: '', accountNumber: '', knownVehicles: [], vouchers: [] });
const today = () => new Date().toISOString().slice(0, 10);

export const FuelAccountView: React.FC<FuelAccountViewProps> = ({ currentUser, settings, users }) => {
  const canManage = canWriteModule(currentUser, 'fuel');
  const [account, setAccount] = useState<FuelAccount>(settings.fuelAccount || emptyAccount());
  const [isSaving, setIsSaving] = useState(false);
  const [isVoucherOpen, setIsVoucherOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [ticketVoucherId, setTicketVoucherId] = useState<string | null>(null);
  const [ticketPendingDeletion, setTicketPendingDeletion] = useState<{ voucherId: string; ticket: FuelTicket } | null>(null);
  const [voucherPendingDeletion, setVoucherPendingDeletion] = useState<FuelVoucher | null>(null);
  const [isDeletingTicket, setIsDeletingTicket] = useState(false);
  const [isDeletingVoucher, setIsDeletingVoucher] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<FuelVoucher | null>(null);
  const [recipientType, setRecipientType] = useState<'owner' | 'third_party'>('owner');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [voucherForm, setVoucherForm] = useState({
    issuedAt: today(), assignedTo: '', vehicle: '', authorizedAmount: 0, authorizedLiters: 0, fuelType: 'Diésel común',
  });
  const [ticketForm, setTicketForm] = useState({ date: today(), ticketNumber: '', fuelType: 'Diésel común', liters: 0, amount: 0 });

  useEffect(() => setAccount(settings.fuelAccount || emptyAccount()), [settings.fuelAccount]);

  const totals = useMemo(() => {
    const tickets = account.vouchers.flatMap((voucher) => voucher.tickets || []);
    return {
      accountBalance: tickets.reduce((sum, ticket) => sum + (Number(ticket.amount) || 0), 0),
      liters: tickets.reduce((sum, ticket) => sum + (Number(ticket.liters) || 0), 0),
      openVouchers: account.vouchers.filter((voucher) => voucher.status === 'issued' || voucher.status === 'partial').length,
      pendingTickets: account.vouchers.filter((voucher) => (voucher.tickets || []).length === 0 && voucher.status !== 'cancelled').length,
    };
  }, [account]);

  const persist = async (next: FuelAccount) => {
    setIsSaving(true);
    setError('');
    try {
      const saved = await storageService.saveSettingsAsync({ fuelAccount: next });
      setAccount(saved.fuelAccount || next);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La base de datos no confirmó el movimiento.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveAccountData = async () => {
    return persist(account);
  };

  const createVoucher = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!voucherForm.assignedTo.trim()) {
      setError('Indicá a quién se entrega el vale.');
      return;
    }
    const number = `V-${new Date().getFullYear()}-${String(account.vouchers.length + 1).padStart(4, '0')}`;
    const voucher: FuelVoucher = {
      id: `fuel-voucher-${Date.now()}`,
      number,
      issuedAt: voucherForm.issuedAt,
      stationName: account.stationName || 'Estación de servicio',
      assignedTo: voucherForm.assignedTo.trim(),
      vehicle: voucherForm.vehicle.trim().toUpperCase(),
      purpose: '',
      authorizedAmount: Number(voucherForm.authorizedAmount),
      authorizedLiters: Number(voucherForm.authorizedLiters) || 0,
      fuelType: voucherForm.fuelType,
      status: 'issued',
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
      tickets: [],
    };
    const vehicle = voucherForm.vehicle.trim().toUpperCase();
    const knownVehicles = Array.from(new Set([...(account.knownVehicles || []), ...(vehicle ? [vehicle] : [])]));
    const next = { ...account, knownVehicles, vouchers: [voucher, ...account.vouchers] };
    if (await persist(next)) {
      setIsVoucherOpen(false);
      setVoucherForm({ issuedAt: today(), assignedTo: '', vehicle: '', authorizedAmount: 0, authorizedLiters: 0, fuelType: 'Diésel común' });
      setRecipientType('owner');
    }
  };

  const addTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    const voucher = account.vouchers.find((item) => item.id === ticketVoucherId);
    if (!voucher || Number(ticketForm.amount) <= 0 || !ticketForm.ticketNumber.trim()) {
      setError('Indicá número de ticket e importe para vincularlo al vale.');
      return;
    }
    const ticket: FuelTicket = {
      id: `fuel-ticket-${Date.now()}`,
      date: ticketForm.date,
      ticketNumber: ticketForm.ticketNumber.trim(),
      fuelType: ticketForm.fuelType.trim() || 'Combustible',
      liters: Number(ticketForm.liters) || 0,
      amount: Number(ticketForm.amount),
      expenseId: `fuel-expense-${Date.now()}`,
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
    };
    const fuelExpense: ExpenseItem = {
      id: ticket.expenseId!,
      concept: `Combustible · ${ticket.fuelType} · Vale ${voucher.number}`,
      category: 'impuestos',
      amount: ticket.amount,
      currency: 'ARS',
      periodMonth: ticket.date.slice(0, 7),
      date: ticket.date,
      provider: voucher.stationName || account.stationName || 'Estación de servicio',
      invoiceNumber: `Ticket ${ticket.ticketNumber}`,
      status: 'pending',
      paymentMethod: 'transfer',
      notes: '',
      createdBy: currentUser.name,
      approvalStatus: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser.name,
      reimbursementStatus: 'not_applicable',
      reimbursedAmount: 0,
      createdAt: new Date().toISOString(),
    };
    const expenseSaved = await storageService.saveExpense(fuelExpense);
    if (!expenseSaved) {
      setError('No se pudo crear el gasto pendiente en la base. El ticket no fue vinculado.');
      return;
    }
    const totalUsed = [...(voucher.tickets || []), ticket].reduce((sum, item) => sum + Number(item.amount), 0);
    const status: FuelVoucher['status'] = voucher.authorizedAmount > 0 && totalUsed >= voucher.authorizedAmount - 0.01 ? 'settled' : 'partial';
    const next: FuelAccount = {
      ...account,
      vouchers: account.vouchers.map((item) => item.id === voucher.id ? { ...item, tickets: [...(item.tickets || []), ticket], status } : item),
    };
    if (await persist(next)) {
      setTicketVoucherId(null);
      setTicketForm({ date: today(), ticketNumber: '', fuelType: 'Diésel común', liters: 0, amount: 0 });
    } else {
      await storageService.deleteExpense(fuelExpense.id);
    }
  };

  const deleteTicket = async () => {
    if (!ticketPendingDeletion || isDeletingTicket) return;
    const { voucherId, ticket } = ticketPendingDeletion;
    const voucher = account.vouchers.find((item) => item.id === voucherId);
    if (!voucher) {
      setTicketPendingDeletion(null);
      return;
    }

    setIsDeletingTicket(true);
    setError('');
    setSuccess('');
    const linkedExpense = ticket.expenseId
      ? storageService.getExpenses().find((expense) => expense.id === ticket.expenseId)
      : undefined;
    try {
      if (ticket.expenseId && !await storageService.deleteExpense(ticket.expenseId)) {
        setError('No se pudo eliminar el gasto asociado. El ticket sigue vigente.');
        return;
      }

      const remainingTickets = (voucher.tickets || []).filter((item) => item.id !== ticket.id);
      const totalUsed = remainingTickets.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const status: FuelVoucher['status'] = voucher.status === 'cancelled'
        ? 'cancelled'
        : remainingTickets.length === 0
          ? 'issued'
          : voucher.authorizedAmount > 0 && totalUsed >= voucher.authorizedAmount - 0.01
            ? 'settled'
            : 'partial';
      const next: FuelAccount = {
        ...account,
        vouchers: account.vouchers.map((item) => item.id === voucherId ? { ...item, tickets: remainingTickets, status } : item),
      };

      if (await persist(next)) {
        setTicketPendingDeletion(null);
        setSuccess(ticket.expenseId
          ? `Ticket ${ticket.ticketNumber} y gasto asociado eliminados.`
          : `Ticket ${ticket.ticketNumber} eliminado.`);
      } else if (linkedExpense) {
        // Si no se pudo actualizar el vale, se restaura el gasto para no dejar
        // el comprobante asociado a una deuda que ya no existe.
        await storageService.saveExpense(linkedExpense);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el ticket.');
    } finally {
      setIsDeletingTicket(false);
    }
  };

  const deleteVoucher = async () => {
    if (!voucherPendingDeletion || isDeletingVoucher) return;
    const voucher = voucherPendingDeletion;
    setIsDeletingVoucher(true);
    setError('');
    setSuccess('');
    const localExpenses = storageService.getExpenses();
    const expensesById = new Map<string, ExpenseItem>();
    for (const ticket of voucher.tickets || []) {
      const expense = ticket.expenseId ? localExpenses.find((item) => item.id === ticket.expenseId) : undefined;
      if (expense) expensesById.set(expense.id, expense);
    }
    const expenses = Array.from(expensesById.values());
    const removedExpenseIds: string[] = [];

    try {
      for (const ticket of voucher.tickets || []) {
        if (!ticket.expenseId) continue;
        if (!await storageService.deleteExpense(ticket.expenseId)) {
          for (const expense of expenses.filter((item) => removedExpenseIds.includes(item.id))) {
            await storageService.saveExpense(expense);
          }
          setError(`No se pudo eliminar el gasto del ticket ${ticket.ticketNumber}. El vale se mantiene.`);
          return;
        }
        removedExpenseIds.push(ticket.expenseId);
      }

      const next: FuelAccount = {
        ...account,
        vouchers: account.vouchers.filter((item) => item.id !== voucher.id),
      };
      if (await persist(next)) {
        setVoucherPendingDeletion(null);
        setSuccess(`Vale ${voucher.number} eliminado${voucher.tickets.length ? ' junto con sus tickets y gastos asociados' : ''}.`);
      } else {
        for (const expense of expenses.filter((item) => removedExpenseIds.includes(item.id))) {
          await storageService.saveExpense(expense);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el vale.');
    } finally {
      setIsDeletingVoucher(false);
    }
  };

  const formatVoucherDate = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  };

  const shareVoucher = (voucher: FuelVoucher) => {
    const message = [
      `VALE DE COMBUSTIBLE ${voucher.number}`,
      `Estación: ${voucher.stationName || account.stationName || 'Estación de servicio'}`,
      `Fecha: ${formatVoucherDate(voucher.issuedAt)}`,
      `Autorizado para: ${voucher.assignedTo}`,
      voucher.vehicle ? `Vehículo: ${voucher.vehicle}` : '',
      `Combustible: ${voucher.fuelType || 'Diésel común'}`,
      `Importe máximo: ${voucher.authorizedAmount > 0 ? `$${Number(voucher.authorizedAmount).toLocaleString('es-AR')} ARS` : 'Libre'}`,
      `Cantidad máxima: ${voucher.authorizedLiters > 0 ? `${voucher.authorizedLiters} litros` : 'Libre'}`,
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const downloadVoucherImage = async (voucher: FuelVoucher) => {
    const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
    const lines: string[][] = [
      ['Vale', voucher.number],
      ['Estación', voucher.stationName || account.stationName || 'Estación de servicio'],
      ['Fecha', formatVoucherDate(voucher.issuedAt)],
      ['Autorizado para', voucher.assignedTo],
      ...(voucher.vehicle ? [['Vehículo', voucher.vehicle]] : []),
      ['Combustible', voucher.fuelType || 'Diésel común'],
      ['Importe máximo', voucher.authorizedAmount > 0 ? `$${Number(voucher.authorizedAmount).toLocaleString('es-AR')} ARS` : 'Libre'],
      ['Cantidad máxima', voucher.authorizedLiters > 0 ? `${voucher.authorizedLiters} litros` : 'Libre'],
    ];
    const height = 330 + lines.length * 66;
    const rows = lines.map(([label, value], index) => `<text x="72" y="${230 + index * 66}" fill="#66756e" font-family="Arial,sans-serif" font-size="19" font-weight="700">${escapeXml(label.toUpperCase())}</text><text x="72" y="${258 + index * 66}" fill="#18332f" font-family="Arial,sans-serif" font-size="25">${escapeXml(value)}</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}"><rect width="100%" height="100%" fill="#f4f1e9"/><rect x="28" y="28" width="944" height="${height - 56}" rx="28" fill="#fff" stroke="#dce6e1" stroke-width="3"/><path d="M28 56a28 28 0 0 1 28-28h888a28 28 0 0 1 28 28v112H28z" fill="#18332f"/><text x="72" y="92" fill="#fff" font-family="Arial,sans-serif" font-size="18" font-weight="700" letter-spacing="3">EL DESAYUNO · CUENTA CORRIENTE</text><text x="72" y="140" fill="#fff" font-family="Arial,sans-serif" font-size="32" font-weight="700">VALE DE COMBUSTIBLE</text>${rows}<text x="72" y="${height - 72}" fill="#7a8e7e" font-family="Arial,sans-serif" font-size="16">Emitido por ${escapeXml(voucher.createdBy || currentUser.name)}</text></svg>`;
    const image = new Image();
    const imageUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('No se pudo preparar la imagen del vale.'));
        image.src = imageUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(image, 0, 0);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('No se pudo descargar la imagen del vale.');
      const downloadUrl = URL.createObjectURL(png);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `${voucher.number.toLowerCase()}-vale-combustible.png`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const statusLabel: Record<FuelVoucher['status'], string> = { issued: 'Emitido', partial: 'Con ticket', settled: 'Rendido', cancelled: 'Anulado' };
  const statusStyle: Record<FuelVoucher['status'], string> = { issued: 'bg-amber-100 text-amber-800', partial: 'bg-blue-100 text-blue-800', settled: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-neutral-200 text-neutral-700' };
  const ticketVoucher = account.vouchers.find((voucher) => voucher.id === ticketVoucherId) || null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="bg-white border border-[#DCE6E1] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-[#315D5B] flex items-center gap-1"><Fuel className="w-3.5 h-3.5" /> Operatoria de combustible</div>
          <h1 className="text-2xl font-bold text-[#163323] mt-1">Cuenta Corriente de Combustible</h1>
          <p className="text-sm text-[#637568] mt-1">Vales y tickets de retiro. Cada ticket queda como gasto pendiente hasta que se pague a la estación.</p>
          {account.stationName && <p className="text-[11px] text-[#7A8E7E] mt-2">Cuenta operativa: <strong className="text-[#526657]">{account.stationName}</strong></p>}
        </div>
        {canManage && <div className="flex gap-2"><button type="button" onClick={() => setIsAccountOpen(true)} className="px-3.5 py-2.5 rounded-[9px] border border-[#CFDDD7] bg-white text-xs font-bold uppercase tracking-wide text-[#18332F] hover:bg-[#F2F7F4] cursor-pointer">Configurar</button><button type="button" onClick={() => setIsVoucherOpen(true)} className="px-4 py-2.5 rounded-[9px] bg-[#1B3B2B] text-white text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-[#132A1F] cursor-pointer"><Plus className="w-4 h-4 text-white/80" /> Nuevo vale</button></div>}
      </div>

      {error && <div className="border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>}
      {success && <div role="status" className="border border-emerald-200 bg-emerald-50 text-emerald-900 px-4 py-3 text-sm">{success}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Deuda pendiente a estación', `$${totals.accountBalance.toLocaleString('es-AR')}`, 'También figura como gasto pendiente'],
          ['Litros registrados', `${totals.liters.toLocaleString('es-AR')} L`, 'Según tickets cargados'],
          ['Vales abiertos', String(totals.openVouchers), 'Emitidos o con carga parcial'],
          ['Sin ticket', String(totals.pendingTickets), 'Vales pendientes de rendir'],
        ].map(([label, value, detail]) => <div key={label} className="bg-white border border-[#DCE6E1] rounded-[14px] p-4"><span className="block text-[10px] uppercase font-bold text-[#637568]">{label}</span><strong className="block mt-2 font-mono text-xl text-[#163323]">{value}</strong><span className="block text-[11px] text-[#7A8E7E] mt-1">{detail}</span></div>)}
      </div>

      <div className="bg-white border border-[#E3DFC8] overflow-hidden">
        <div className="p-4 border-b border-[#E3DFC8] flex items-center gap-2"><Ticket className="w-4 h-4 text-[#B0833E]" /><h2 className="font-bold text-sm text-[#163323]">Vales emitidos</h2></div>
        {account.vouchers.length === 0 ? <div className="p-10 text-center text-sm text-[#7A8E7E]">Todavía no hay vales de combustible emitidos.</div> : (
          <div className="divide-y divide-[#E3DFC8]">
            {account.vouchers.map((voucher) => {
              const used = voucher.tickets.reduce((sum, ticket) => sum + Number(ticket.amount), 0);
              return <div key={voucher.id} className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
                <div>
                  <div className="flex flex-wrap gap-2 items-center"><strong className="text-[#163323]">Vale {voucher.number}</strong><span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${statusStyle[voucher.status]}`}>{statusLabel[voucher.status]}</span></div>
                  <p className="text-xs text-[#526657] mt-1">{voucher.issuedAt} · {voucher.assignedTo}{voucher.vehicle ? ` · ${voucher.vehicle}` : ''}</p>
                  <p className="text-xs mt-2 text-[#163323]">Combustible: <strong>{voucher.fuelType || 'Diésel común'}</strong> · Importe máx.: <strong>{voucher.authorizedAmount > 0 ? `$${voucher.authorizedAmount.toLocaleString('es-AR')}` : 'Libre'}</strong> · Retirado: <strong>${used.toLocaleString('es-AR')}</strong> · Cantidad máx.: <strong>{voucher.authorizedLiters > 0 ? `${voucher.authorizedLiters} L` : 'Libre'}</strong></p>
                  {voucher.tickets.length > 0 && <div className="mt-3 space-y-2">{voucher.tickets.map((ticket) => <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E5E9E6] bg-[#F8FAF8] px-3 py-2 text-[11px] text-[#637568]"><span>Ticket <strong className="text-[#18332F]">{ticket.ticketNumber}</strong> · ${ticket.amount.toLocaleString('es-AR')} · {ticket.liters || 0} L · <strong className="text-amber-800">pendiente en Gastos</strong></span>{canManage && <button type="button" onClick={() => { setError(''); setTicketPendingDeletion({ voucherId: voucher.id, ticket }); }} disabled={isDeletingTicket} aria-label={`Eliminar ticket ${ticket.ticketNumber}`} title="Eliminar ticket" className="p-1 text-red-700 hover:bg-red-50 disabled:opacity-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>}</div>)}</div>}
                </div>
                <div className="flex flex-wrap gap-2 self-start">
                  <button type="button" onClick={() => setSelectedVoucher(voucher)} className="px-3 py-2 border border-[#CFDDD7] text-[#163323] text-xs font-bold uppercase tracking-wide hover:bg-[#F4F1E9] cursor-pointer flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> Ver vale</button>
                  {canManage && <button type="button" onClick={() => { setTicketVoucherId(voucher.id); setTicketForm((old) => ({ ...old, fuelType: voucher.fuelType || 'Diésel común' })); setError(''); }} disabled={voucher.status === 'cancelled'} className="px-3 py-2 border border-[#1B3B2B] text-[#163323] text-xs font-bold uppercase tracking-wide hover:bg-[#F4F1E9] disabled:opacity-50 cursor-pointer flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> Cargar ticket</button>}
                  {canManage && <button type="button" onClick={() => { setError(''); setVoucherPendingDeletion(voucher); }} disabled={isDeletingVoucher} aria-label={`Eliminar vale ${voucher.number}`} title="Eliminar vale" className="p-2 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>;
            })}
          </div>
        )}
      </div>

      {selectedVoucher && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
        <div className="bg-white max-w-xl w-full border border-[#DCE6E1] shadow-xl relative my-auto">
          <div className="px-5 py-4 bg-[#18332F] text-white flex items-center justify-between print:hidden"><div><h3 className="font-bold">Vale de combustible {selectedVoucher.number}</h3><p className="text-xs text-white/75 mt-1">Podés imprimirlo, guardarlo como PDF o descargarlo como imagen.</p></div><button type="button" onClick={() => setSelectedVoucher(null)} className="p-1 cursor-pointer" aria-label="Cerrar"><X className="w-5 h-5" /></button></div>
          <div className="p-6 sm:p-8 fuel-voucher-print">
            <div className="text-center border-b border-[#DCE6E1] pb-5"><p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#7A8E7E]">{selectedVoucher.stationName || account.stationName || 'Estación de servicio'}</p><h2 className="text-2xl font-bold text-[#18332F] mt-2">VALE DE COMBUSTIBLE</h2><p className="text-sm text-[#637568] mt-1">N.º {selectedVoucher.number}</p></div>
            <dl className="grid grid-cols-[minmax(120px,0.7fr)_1fr] gap-x-4 gap-y-4 py-6 text-sm">
              <dt className="font-bold text-[#637568]">Fecha de emisión</dt><dd className="text-[#18332F]">{formatVoucherDate(selectedVoucher.issuedAt)}</dd>
              <dt className="font-bold text-[#637568]">Autorizado para</dt><dd className="text-[#18332F]">{selectedVoucher.assignedTo}</dd>
              {selectedVoucher.vehicle && <><dt className="font-bold text-[#637568]">Vehículo / patente</dt><dd className="text-[#18332F]">{selectedVoucher.vehicle}</dd></>}
              <dt className="font-bold text-[#637568]">Combustible</dt><dd className="text-[#18332F]">{selectedVoucher.fuelType || 'Diésel común'}</dd>
              <dt className="font-bold text-[#637568]">Importe máximo</dt><dd className="text-[#18332F] font-bold">{selectedVoucher.authorizedAmount > 0 ? `$${Number(selectedVoucher.authorizedAmount).toLocaleString('es-AR')} ARS` : 'Libre'}</dd>
              <dt className="font-bold text-[#637568]">Cantidad máxima</dt><dd className="text-[#18332F]">{selectedVoucher.authorizedLiters > 0 ? `${selectedVoucher.authorizedLiters} litros` : 'Libre'}</dd>
            </dl>
            <div className="border-t border-dashed border-[#B7C5BC] pt-4 flex justify-between text-xs text-[#637568]"><span>Firma de quien retira</span><span>Firma de la estación</span></div>
            <p className="mt-6 text-[10px] text-[#7A8E7E]">Emitido por {selectedVoucher.createdBy || currentUser.name}</p>
          </div>
          <div className="px-5 py-4 border-t border-[#DCE6E1] flex flex-wrap justify-end gap-2 print:hidden"><button type="button" onClick={() => shareVoucher(selectedVoucher)} className="px-3 py-2 border border-[#CFDDD7] text-[#18332F] text-xs font-bold uppercase cursor-pointer flex items-center gap-2"><Share2 className="w-4 h-4" /> WhatsApp</button><button type="button" onClick={() => downloadVoucherImage(selectedVoucher).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'No se pudo descargar la imagen del vale.'))} className="px-3 py-2 border border-[#CFDDD7] text-[#18332F] text-xs font-bold uppercase cursor-pointer flex items-center gap-2"><Download className="w-4 h-4" /> Imagen</button><button type="button" onClick={() => window.print()} className="px-3 py-2 bg-[#18332F] text-white text-xs font-bold uppercase cursor-pointer flex items-center gap-2"><Printer className="w-4 h-4" /> Imprimir / PDF</button></div>
        </div>
      </div>}

      {canManage && isAccountOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><form onSubmit={async (event) => { event.preventDefault(); if (await saveAccountData()) setIsAccountOpen(false); }} className="bg-white max-w-md w-full p-5 border border-[#E3DFC8] shadow-xl relative space-y-3"><button type="button" onClick={() => setIsAccountOpen(false)} className="absolute top-3 right-3 p-1 cursor-pointer"><X className="w-5 h-5" /></button><h3 className="text-lg font-bold text-[#163323]">Configurar cuenta de estación</h3><p className="text-xs text-[#637568]">Estos datos sólo se usan para identificar la cuenta al emitir vales; no quedan expuestos en el listado.</p><input value={account.stationName} onChange={(event) => setAccount({ ...account, stationName: event.target.value })} placeholder="Nombre de la estación" className="w-full px-3 py-2 border border-[#DDD5BF]" /><input value={account.accountNumber} onChange={(event) => setAccount({ ...account, accountNumber: event.target.value })} placeholder="Número interno de cuenta (opcional)" className="w-full px-3 py-2 border border-[#DDD5BF]" /><button disabled={isSaving} className="w-full px-4 py-2 bg-[#1B3B2B] text-white text-xs font-bold uppercase tracking-wide disabled:opacity-60 cursor-pointer">{isSaving ? 'Guardando...' : 'Guardar configuración'}</button></form></div>}
      {canManage && isVoucherOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><form onSubmit={createVoucher} className="bg-white max-w-lg w-full p-5 border border-[#E3DFC8] shadow-xl relative space-y-3 max-h-[90vh] overflow-y-auto"><button type="button" onClick={() => setIsVoucherOpen(false)} className="absolute top-3 right-3 p-1 cursor-pointer"><X className="w-5 h-5" /></button><h3 className="text-lg font-bold text-[#163323]">Emitir vale de combustible</h3>
        <label className="block text-xs font-bold text-[#526657]">Fecha de emisión<input type="date" value={voucherForm.issuedAt} onChange={(event) => setVoucherForm({ ...voucherForm, issuedAt: event.target.value })} className="mt-1 w-full px-3 py-2 border border-[#DDD5BF]" /></label>
        <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-[#526657]">Entregar a<select value={recipientType} onChange={(event) => { setRecipientType(event.target.value as 'owner' | 'third_party'); setVoucherForm({ ...voucherForm, assignedTo: '' }); }} className="mt-1 w-full px-3 py-2 border border-[#DDD5BF]"><option value="owner">Socio</option><option value="third_party">Tercero</option></select></label>
          {recipientType === 'owner' ? <label className="text-xs font-bold text-[#526657]">Socio<select required value={voucherForm.assignedTo} onChange={(event) => setVoucherForm({ ...voucherForm, assignedTo: event.target.value })} className="mt-1 w-full px-3 py-2 border border-[#DDD5BF]"><option value="">Seleccionar socio...</option>{users.filter((user) => user.active !== false).map((user) => <option key={user.id} value={user.name}>{user.name} ({user.partName})</option>)}</select></label> : <label className="text-xs font-bold text-[#526657]">Nombre del tercero<input required value={voucherForm.assignedTo} onChange={(event) => setVoucherForm({ ...voucherForm, assignedTo: event.target.value })} placeholder="Nombre y apellido" className="mt-1 w-full px-3 py-2 border border-[#DDD5BF]" /></label>}
        </div>
        <label className="block text-xs font-bold text-[#526657]">Vehículo / patente (opcional)<input list="fuel-known-vehicles" value={voucherForm.vehicle} onChange={(event) => setVoucherForm({ ...voucherForm, vehicle: event.target.value.toUpperCase() })} placeholder="Ej.: AB123CD" className="mt-1 w-full px-3 py-2 border border-[#DDD5BF]" /><datalist id="fuel-known-vehicles">{(account.knownVehicles || []).map((vehicle) => <option key={vehicle} value={vehicle} />)}</datalist><span className="mt-1 block font-normal text-[#7A8E7E]">Las patentes ingresadas quedan guardadas para próximos vales.</span></label>
        <label className="block text-xs font-bold text-[#526657]">Tipo de combustible<select value={voucherForm.fuelType} onChange={(event) => setVoucherForm({ ...voucherForm, fuelType: event.target.value })} className="mt-1 w-full px-3 py-2 border border-[#DDD5BF]"><option>Diésel común</option><option>Infinia Diésel</option><option>Nafta Súper</option><option>Nafta Infinia</option></select></label>
        <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-[#526657]">Monto máximo (ARS)<input type="number" min="0" value={voucherForm.authorizedAmount || ''} onChange={(event) => setVoucherForm({ ...voucherForm, authorizedAmount: Number(event.target.value) || 0 })} placeholder="Libre" className="mt-1 w-full px-3 py-2 border border-[#DDD5BF]" /></label><label className="text-xs font-bold text-[#526657]">Cantidad máxima (litros)<input type="number" min="0" step="any" value={voucherForm.authorizedLiters || ''} onChange={(event) => setVoucherForm({ ...voucherForm, authorizedLiters: Number(event.target.value) || 0 })} placeholder="Libre" className="mt-1 w-full px-3 py-2 border border-[#DDD5BF]" /></label></div>
        <p className="text-xs text-[#637568]">Si dejás monto o litros vacíos, ese límite queda libre.</p><button disabled={isSaving} className="w-full px-4 py-2 bg-[#1B3B2B] text-white text-xs font-bold uppercase tracking-wide disabled:opacity-60 cursor-pointer">{isSaving ? 'Guardando...' : 'Emitir vale'}</button></form></div>}
      {canManage && ticketVoucher && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><form onSubmit={addTicket} className="bg-white max-w-lg w-full p-5 border border-[#E3DFC8] shadow-xl relative space-y-3"><button type="button" onClick={() => setTicketVoucherId(null)} className="absolute top-3 right-3 p-1 cursor-pointer"><X className="w-5 h-5" /></button><h3 className="text-lg font-bold text-[#163323]">Cargar ticket · {ticketVoucher.number}</h3><input type="date" value={ticketForm.date} onChange={(event) => setTicketForm({ ...ticketForm, date: event.target.value })} className="w-full px-3 py-2 border border-[#DDD5BF]" /><input value={ticketForm.ticketNumber} onChange={(event) => setTicketForm({ ...ticketForm, ticketNumber: event.target.value })} placeholder="Número de ticket *" className="w-full px-3 py-2 border border-[#DDD5BF]" /><select value={ticketForm.fuelType} onChange={(event) => setTicketForm({ ...ticketForm, fuelType: event.target.value })} className="w-full px-3 py-2 border border-[#DDD5BF]"><option>Diésel común</option><option>Infinia Diésel</option><option>Nafta Súper</option><option>Nafta Infinia</option></select><div className="grid grid-cols-2 gap-3"><input type="number" min="0" step="any" value={ticketForm.liters || ''} onChange={(event) => setTicketForm({ ...ticketForm, liters: Number(event.target.value) || 0 })} placeholder="Litros" className="px-3 py-2 border border-[#DDD5BF]" /><input type="number" min="0" step="any" value={ticketForm.amount || ''} onChange={(event) => setTicketForm({ ...ticketForm, amount: Number(event.target.value) || 0 })} placeholder="Importe $ *" className="px-3 py-2 border border-[#DDD5BF]" /></div><button disabled={isSaving} className="w-full px-4 py-2 bg-[#1B3B2B] text-white text-xs font-bold uppercase tracking-wide disabled:opacity-60 cursor-pointer">{isSaving ? 'Guardando...' : 'Vincular ticket'}</button></form></div>}
      {canManage && voucherPendingDeletion && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"><div role="alertdialog" aria-modal="true" aria-labelledby="fuel-voucher-delete-title" className="bg-white max-w-md w-full p-5 border border-[#E3DFC8] shadow-xl"><h3 id="fuel-voucher-delete-title" className="text-lg font-bold text-[#163323]">¿Eliminar el vale {voucherPendingDeletion.number}?</h3><p className="mt-2 text-sm text-[#637568]">El vale se quitará de la cuenta corriente y no se puede recuperar.</p>{voucherPendingDeletion.tickets.length > 0 && <p className="mt-2 text-sm text-red-800">También se eliminarán sus {voucherPendingDeletion.tickets.length} ticket(s), los gastos de combustible y cualquier cobranza o movimiento de caja relacionado.</p>}{error && <p className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={isDeletingVoucher} onClick={() => setVoucherPendingDeletion(null)} className="px-4 py-2 border border-[#CFDDD7] text-[#18332F] text-xs font-bold uppercase disabled:opacity-50 cursor-pointer">Volver</button><button type="button" disabled={isDeletingVoucher} onClick={deleteVoucher} className="px-4 py-2 bg-red-700 text-white text-xs font-bold uppercase disabled:opacity-50 cursor-pointer">{isDeletingVoucher ? 'Eliminando...' : 'Sí, eliminar vale'}</button></div></div></div>}
      {canManage && ticketPendingDeletion && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"><div role="alertdialog" aria-modal="true" aria-labelledby="fuel-ticket-delete-title" className="bg-white max-w-md w-full p-5 border border-[#E3DFC8] shadow-xl"><h3 id="fuel-ticket-delete-title" className="text-lg font-bold text-[#163323]">¿Eliminar el ticket {ticketPendingDeletion.ticket.ticketNumber}?</h3><p className="mt-2 text-sm text-[#637568]">Se quitará del vale y también se eliminará el gasto de combustible asociado. Si ese gasto tiene cobranzas o movimientos vinculados, también se eliminarán. Esta acción no se puede deshacer.</p>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={isDeletingTicket} onClick={() => setTicketPendingDeletion(null)} className="px-4 py-2 border border-[#CFDDD7] text-[#18332F] text-xs font-bold uppercase disabled:opacity-50 cursor-pointer">Volver</button><button type="button" disabled={isDeletingTicket} onClick={deleteTicket} className="px-4 py-2 bg-red-700 text-white text-xs font-bold uppercase disabled:opacity-50 cursor-pointer">{isDeletingTicket ? 'Eliminando...' : 'Sí, eliminar'}</button></div></div></div>}
    </div>
  );
};
