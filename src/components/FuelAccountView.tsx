import React, { useEffect, useMemo, useState } from 'react';
import { Fuel, Plus, Receipt, Ticket, X } from 'lucide-react';
import { ExpenseItem, FuelAccount, FuelTicket, FuelVoucher, TrustSettings, User } from '../types';
import { storageService } from '../services/storageService';

interface FuelAccountViewProps {
  currentUser: User;
  settings: TrustSettings;
  users: User[];
}

const emptyAccount = (): FuelAccount => ({ stationName: '', accountNumber: '', vouchers: [] });
const today = () => new Date().toISOString().slice(0, 10);

export const FuelAccountView: React.FC<FuelAccountViewProps> = ({ currentUser, settings, users }) => {
  const [account, setAccount] = useState<FuelAccount>(settings.fuelAccount || emptyAccount());
  const [isSaving, setIsSaving] = useState(false);
  const [isVoucherOpen, setIsVoucherOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [ticketVoucherId, setTicketVoucherId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [voucherForm, setVoucherForm] = useState({
    issuedAt: today(), assignedTo: '', vehicle: '', purpose: '', authorizedAmount: 0, authorizedLiters: 0,
  });
  const [ticketForm, setTicketForm] = useState({ date: today(), ticketNumber: '', fuelType: 'Diésel', liters: 0, amount: 0 });

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
    if (!voucherForm.assignedTo.trim() || Number(voucherForm.authorizedAmount) <= 0) {
      setError('Indicá a quién se entrega el vale y el importe máximo autorizado.');
      return;
    }
    const number = `V-${new Date().getFullYear()}-${String(account.vouchers.length + 1).padStart(4, '0')}`;
    const voucher: FuelVoucher = {
      id: `fuel-voucher-${Date.now()}`,
      number,
      issuedAt: voucherForm.issuedAt,
      stationName: account.stationName || 'Estación de servicio',
      assignedTo: voucherForm.assignedTo.trim(),
      vehicle: voucherForm.vehicle.trim(),
      purpose: voucherForm.purpose.trim(),
      authorizedAmount: Number(voucherForm.authorizedAmount),
      authorizedLiters: Number(voucherForm.authorizedLiters) || 0,
      status: 'issued',
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
      tickets: [],
    };
    const next = { ...account, vouchers: [voucher, ...account.vouchers] };
    if (await persist(next)) {
      setIsVoucherOpen(false);
      setVoucherForm({ issuedAt: today(), assignedTo: '', vehicle: '', purpose: '', authorizedAmount: 0, authorizedLiters: 0 });
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
      setTicketForm({ date: today(), ticketNumber: '', fuelType: 'Diésel', liters: 0, amount: 0 });
    } else {
      await storageService.deleteExpense(fuelExpense.id);
    }
  };

  const statusLabel: Record<FuelVoucher['status'], string> = { issued: 'Emitido', partial: 'Con ticket', settled: 'Rendido', cancelled: 'Anulado' };
  const statusStyle: Record<FuelVoucher['status'], string> = { issued: 'bg-amber-100 text-amber-800', partial: 'bg-blue-100 text-blue-800', settled: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-neutral-200 text-neutral-700' };
  const ticketVoucher = account.vouchers.find((voucher) => voucher.id === ticketVoucherId) || null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="bg-white border border-[#E3DFC8] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-[#B0833E] flex items-center gap-1"><Fuel className="w-3.5 h-3.5" /> Operatoria de combustible</div>
          <h1 className="text-2xl font-bold text-[#163323] mt-1">Cuenta Corriente de Combustible</h1>
          <p className="text-sm text-[#637568] mt-1">Vales y tickets de retiro. Cada ticket queda como gasto pendiente hasta que se pague a la estación.</p>
          {account.stationName && <p className="text-[11px] text-[#7A8E7E] mt-2">Cuenta operativa: <strong className="text-[#526657]">{account.stationName}</strong></p>}
        </div>
        <div className="flex gap-2"><button type="button" onClick={() => setIsAccountOpen(true)} className="px-3 py-2 border border-[#DDD5BF] text-xs font-bold uppercase tracking-wide text-[#526657] hover:bg-[#F4F1E9] cursor-pointer">Configurar</button><button type="button" onClick={() => setIsVoucherOpen(true)} className="px-4 py-2 bg-[#1B3B2B] text-white text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-[#132A1F] cursor-pointer"><Plus className="w-4 h-4 text-[#BFA270]" /> Nuevo vale</button></div>
      </div>

      {error && <div className="border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Deuda pendiente a estación', `$${totals.accountBalance.toLocaleString('es-AR')}`, 'También figura como gasto pendiente'],
          ['Litros registrados', `${totals.liters.toLocaleString('es-AR')} L`, 'Según tickets cargados'],
          ['Vales abiertos', String(totals.openVouchers), 'Emitidos o con carga parcial'],
          ['Sin ticket', String(totals.pendingTickets), 'Vales pendientes de rendir'],
        ].map(([label, value, detail]) => <div key={label} className="bg-white border border-[#E3DFC8] p-4"><span className="block text-[10px] uppercase font-bold text-[#637568]">{label}</span><strong className="block mt-2 font-mono text-xl text-[#163323]">{value}</strong><span className="block text-[11px] text-[#7A8E7E] mt-1">{detail}</span></div>)}
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
                  <p className="text-xs text-[#526657] mt-1">{voucher.issuedAt} · {voucher.assignedTo}{voucher.vehicle ? ` · ${voucher.vehicle}` : ''}{voucher.purpose ? ` · ${voucher.purpose}` : ''}</p>
                  <p className="text-xs mt-2 text-[#163323]">Autorizado: <strong>${voucher.authorizedAmount.toLocaleString('es-AR')}</strong> · Retirado: <strong>${used.toLocaleString('es-AR')}</strong>{voucher.authorizedLiters > 0 ? ` · Máx. ${voucher.authorizedLiters} L` : ''}</p>
                  {voucher.tickets.length > 0 && <div className="mt-2 text-[11px] text-[#637568]">{voucher.tickets.map((ticket) => <span key={ticket.id} className="inline-block mr-3">Ticket {ticket.ticketNumber}: ${ticket.amount.toLocaleString('es-AR')} · {ticket.liters || 0} L · <strong className="text-amber-800">pendiente en Gastos</strong></span>)}</div>}
                </div>
                <button type="button" onClick={() => { setTicketVoucherId(voucher.id); setError(''); }} disabled={voucher.status === 'cancelled'} className="self-start px-3 py-2 border border-[#1B3B2B] text-[#163323] text-xs font-bold uppercase tracking-wide hover:bg-[#F4F1E9] disabled:opacity-50 cursor-pointer flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> Cargar ticket</button>
              </div>;
            })}
          </div>
        )}
      </div>

      {isAccountOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><form onSubmit={async (event) => { event.preventDefault(); if (await saveAccountData()) setIsAccountOpen(false); }} className="bg-white max-w-md w-full p-5 border border-[#E3DFC8] shadow-xl relative space-y-3"><button type="button" onClick={() => setIsAccountOpen(false)} className="absolute top-3 right-3 p-1 cursor-pointer"><X className="w-5 h-5" /></button><h3 className="text-lg font-bold text-[#163323]">Configurar cuenta de estación</h3><p className="text-xs text-[#637568]">Estos datos sólo se usan para identificar la cuenta al emitir vales; no quedan expuestos en el listado.</p><input value={account.stationName} onChange={(event) => setAccount({ ...account, stationName: event.target.value })} placeholder="Nombre de la estación" className="w-full px-3 py-2 border border-[#DDD5BF]" /><input value={account.accountNumber} onChange={(event) => setAccount({ ...account, accountNumber: event.target.value })} placeholder="Número interno de cuenta (opcional)" className="w-full px-3 py-2 border border-[#DDD5BF]" /><button disabled={isSaving} className="w-full px-4 py-2 bg-[#1B3B2B] text-white text-xs font-bold uppercase tracking-wide disabled:opacity-60 cursor-pointer">{isSaving ? 'Guardando...' : 'Guardar configuración'}</button></form></div>}
      {isVoucherOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><form onSubmit={createVoucher} className="bg-white max-w-lg w-full p-5 border border-[#E3DFC8] shadow-xl relative space-y-3"><button type="button" onClick={() => setIsVoucherOpen(false)} className="absolute top-3 right-3 p-1 cursor-pointer"><X className="w-5 h-5" /></button><h3 className="text-lg font-bold text-[#163323]">Emitir vale de combustible</h3><input type="date" value={voucherForm.issuedAt} onChange={(event) => setVoucherForm({ ...voucherForm, issuedAt: event.target.value })} className="w-full px-3 py-2 border border-[#DDD5BF]" /><select value={voucherForm.assignedTo} onChange={(event) => setVoucherForm({ ...voucherForm, assignedTo: event.target.value })} className="w-full px-3 py-2 border border-[#DDD5BF]"><option value="">Entregar a...</option>{users.filter((user) => user.active !== false).map((user) => <option key={user.id} value={user.name}>{user.name} ({user.partName})</option>)}</select><input value={voucherForm.vehicle} onChange={(event) => setVoucherForm({ ...voucherForm, vehicle: event.target.value })} placeholder="Vehículo / patente (opcional)" className="w-full px-3 py-2 border border-[#DDD5BF]" /><input value={voucherForm.purpose} onChange={(event) => setVoucherForm({ ...voucherForm, purpose: event.target.value })} placeholder="Destino o tarea" className="w-full px-3 py-2 border border-[#DDD5BF]" /><div className="grid grid-cols-2 gap-3"><input type="number" min="0" value={voucherForm.authorizedAmount || ''} onChange={(event) => setVoucherForm({ ...voucherForm, authorizedAmount: Number(event.target.value) || 0 })} placeholder="Máximo $ ARS *" className="px-3 py-2 border border-[#DDD5BF]" /><input type="number" min="0" value={voucherForm.authorizedLiters || ''} onChange={(event) => setVoucherForm({ ...voucherForm, authorizedLiters: Number(event.target.value) || 0 })} placeholder="Máximo litros" className="px-3 py-2 border border-[#DDD5BF]" /></div><button disabled={isSaving} className="w-full px-4 py-2 bg-[#1B3B2B] text-white text-xs font-bold uppercase tracking-wide disabled:opacity-60 cursor-pointer">{isSaving ? 'Guardando...' : 'Emitir vale'}</button></form></div>}
      {ticketVoucher && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><form onSubmit={addTicket} className="bg-white max-w-lg w-full p-5 border border-[#E3DFC8] shadow-xl relative space-y-3"><button type="button" onClick={() => setTicketVoucherId(null)} className="absolute top-3 right-3 p-1 cursor-pointer"><X className="w-5 h-5" /></button><h3 className="text-lg font-bold text-[#163323]">Cargar ticket · {ticketVoucher.number}</h3><input type="date" value={ticketForm.date} onChange={(event) => setTicketForm({ ...ticketForm, date: event.target.value })} className="w-full px-3 py-2 border border-[#DDD5BF]" /><input value={ticketForm.ticketNumber} onChange={(event) => setTicketForm({ ...ticketForm, ticketNumber: event.target.value })} placeholder="Número de ticket *" className="w-full px-3 py-2 border border-[#DDD5BF]" /><input value={ticketForm.fuelType} onChange={(event) => setTicketForm({ ...ticketForm, fuelType: event.target.value })} placeholder="Tipo de combustible" className="w-full px-3 py-2 border border-[#DDD5BF]" /><div className="grid grid-cols-2 gap-3"><input type="number" min="0" step="any" value={ticketForm.liters || ''} onChange={(event) => setTicketForm({ ...ticketForm, liters: Number(event.target.value) || 0 })} placeholder="Litros" className="px-3 py-2 border border-[#DDD5BF]" /><input type="number" min="0" step="any" value={ticketForm.amount || ''} onChange={(event) => setTicketForm({ ...ticketForm, amount: Number(event.target.value) || 0 })} placeholder="Importe $ *" className="px-3 py-2 border border-[#DDD5BF]" /></div><button disabled={isSaving} className="w-full px-4 py-2 bg-[#1B3B2B] text-white text-xs font-bold uppercase tracking-wide disabled:opacity-60 cursor-pointer">{isSaving ? 'Guardando...' : 'Vincular ticket'}</button></form></div>}
    </div>
  );
};
