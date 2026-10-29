import React, { useEffect, useMemo, useState } from 'react';
import { CashFlowCategory, CashFlowTransaction, TrustSettings, User } from '../types';
import { storageService } from '../services/storageService';
import { CustomDialogModal } from './CustomDialogModal';
import {
  BanknoteArrowDown,
  CheckCircle2,
  CreditCard,
  Edit3,
  Landmark,
  Plus,
  Search,
  Tag,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';

interface IncomeViewProps {
  currentUser: User;
  settings: TrustSettings;
  isAdmin: boolean;
}

type IncomeCategory = CashFlowCategory;

const INCOME_CATEGORIES: Array<{ id: IncomeCategory; label: string }> = [
  { id: 'pago_expensas', label: 'Cobro de expensas' },
  { id: 'aporte_socio', label: 'Aporte de copropietario' },
  { id: 'fondo_reserva', label: 'Fondo de reserva' },
  { id: 'otro_ingreso', label: 'Otro ingreso' },
];

const currentDate = () => new Date().toISOString().slice(0, 10);
const currentPeriod = () => currentDate().slice(0, 7);

const formatCurrency = (amount: number, currency: 'ARS' | 'USD' = 'ARS') =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatPeriod = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
};

const categoryName = (category: string, categories: Array<{ id: string; name: string }>) =>
  categories.find((item) => item.id === category)?.name || category.replace(/^income_/, '').replaceAll('_', ' ');

/**
 * Libro específico de ingresos. Usa los movimientos físicos de Caja ya
 * existentes para que un cobro se registre una sola vez y siga disponible
 * para aplicar a facturas o distribuir entre copropietarios.
 */
export const IncomeView: React.FC<IncomeViewProps> = ({ currentUser, settings: _settings, isAdmin }) => {
  const [incomes, setIncomes] = useState<CashFlowTransaction[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Array<{ id: string; name: string }>>(
    INCOME_CATEGORIES.map((category) => ({ id: category.id, name: category.label }))
  );
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod);
  const [categoryFilter, setCategoryFilter] = useState<'all' | IncomeCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSavingIncome, setIsSavingIncome] = useState(false);
  const [editingIncome, setEditingIncome] = useState<CashFlowTransaction | null>(null);
  const [form, setForm] = useState({
    concept: '',
    category: 'otro_ingreso' as IncomeCategory,
    amount: 0,
    currency: 'ARS' as 'ARS' | 'USD',
    date: currentDate(),
    userId: '',
    notes: '',
  });
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'confirm' | 'alert' | 'success' | 'warning';
    confirmText?: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const loadIncomes = async () => {
    const fresh = await storageService.fetchCashFlowFromDatabase();
    if (Array.isArray(fresh)) {
      setIncomes(fresh.filter((transaction) => transaction.type === 'ingreso' && !transaction.id.startsWith('ledger-')));
    }
  };

  const loadIncomeCategories = async () => {
    const result = await storageService.fetchIncomeCategoriesFromDatabase();
    if (!result.success || result.categories.length === 0) return;
    setIncomeCategories((current) => {
      const merged = new Map(current.map((category) => [category.id, category]));
      result.categories.forEach((category) => merged.set(category.id, category));
      return Array.from(merged.values());
    });
  };

  useEffect(() => {
    void loadIncomes();
    void loadIncomeCategories();
    return storageService.subscribe(() => {
      void loadIncomes();
      void loadIncomeCategories();
    });
  }, []);

  const users = storageService.getUsers().filter((user) => user.active !== false);
  const availablePeriods = useMemo(() => {
    const periods = new Set(incomes.map((income) => income.date?.slice(0, 7)).filter(Boolean));
    periods.add(currentPeriod());
    return Array.from(periods).sort().reverse();
  }, [incomes]);

  const filteredIncomes = useMemo(() => incomes
    .filter((income) => selectedPeriod === 'all' || income.date?.startsWith(selectedPeriod))
    .filter((income) => categoryFilter === 'all' || income.category === categoryFilter)
    .filter((income) => `${income.concept} ${income.userName || ''} ${income.notes || ''}`.toLowerCase().includes(searchTerm.trim().toLowerCase()))
    .sort((left, right) => `${right.date}${right.createdAt}`.localeCompare(`${left.date}${left.createdAt}`)), [incomes, selectedPeriod, categoryFilter, searchTerm]);

  const total = filteredIncomes.reduce((sum, income) => sum + Number(income.amount || 0), 0);
  const totalByCategory = incomeCategories.map((category) => ({
    ...category,
    total: filteredIncomes.filter((income) => income.category === category.id).reduce((sum, income) => sum + Number(income.amount || 0), 0),
  }));
  const automaticCount = filteredIncomes.filter((income) => income.id.startsWith('cf-fee-payment-')).length;

  const openNewIncome = () => {
    setEditingIncome(null);
    setForm({ concept: '', category: 'otro_ingreso', amount: 0, currency: 'ARS', date: currentDate(), userId: '', notes: '' });
    setIsFormOpen(true);
  };

  const openEditIncome = (income: CashFlowTransaction) => {
    setEditingIncome(income);
    setForm({
      concept: income.concept,
      category: income.category || 'otro_ingreso',
      amount: Number(income.amount),
      currency: income.currency || 'ARS',
      date: income.date || currentDate(),
      userId: income.userId || '',
      notes: income.notes || '',
    });
    setIsFormOpen(true);
  };

  const saveIncome = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSavingIncome) return;
    if (!form.concept.trim() || Number(form.amount) <= 0) {
      setDialog({ isOpen: true, title: 'Datos incompletos', message: 'Indicá un concepto y un importe mayor a cero.', type: 'alert', onConfirm: () => {} });
      return;
    }
    setIsSavingIncome(true);
    try {
    const linkedUser = users.find((user) => user.id === form.userId);
    const income: CashFlowTransaction = {
      id: editingIncome?.id || `inc-${Date.now()}`,
      type: 'ingreso',
      category: form.category,
      concept: form.concept.trim(),
      amount: Number(form.amount),
      currency: form.currency,
      date: form.date,
      userId: linkedUser?.id,
      userName: linkedUser?.name,
      partName: linkedUser?.partName,
      notes: form.notes.trim(),
      createdBy: editingIncome?.createdBy || `${currentUser.name} (Libro de Ingresos)`,
      createdAt: editingIncome?.createdAt || new Date().toISOString(),
    };
    const saved = await storageService.saveCashFlowTransaction(income);
    if (!saved) {
      setDialog({ isOpen: true, title: 'No se pudo guardar', message: 'La base de datos no confirmó el ingreso. No se aplicaron cambios.', type: 'alert', onConfirm: () => {} });
      return;
    }
    setIsFormOpen(false);
    await loadIncomes();
    setDialog({ isOpen: true, title: 'Ingreso confirmado', message: 'El ingreso fue guardado y la base de datos confirmó la acción.', type: 'success', onConfirm: () => {} });
    } finally {
      setIsSavingIncome(false);
    }
  };

  const requestDelete = (income: CashFlowTransaction) => {
    setDialog({
      isOpen: true,
      title: 'Eliminar ingreso',
      message: `¿Eliminar “${income.concept}”? Si este ingreso fue aplicado a una factura o distribuido, también se retirarán esos asientos asociados.`,
      type: 'warning',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        const deleted = await storageService.deleteCashFlowWithDependencies(income.id);
        if (!deleted) {
          setDialog({ isOpen: true, title: 'No se pudo eliminar', message: 'La base de datos no confirmó la eliminación. El ingreso sigue vigente.', type: 'alert', onConfirm: () => {} });
          return false;
        }
        await loadIncomes();
        setDialog({ isOpen: true, title: 'Ingreso eliminado', message: 'El ingreso fue eliminado y la base de datos confirmó la acción.', type: 'success', onConfirm: () => {} });
        return false;
      },
    });
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-5 animate-fade-in pb-10">
      <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-emerald-50/70 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-emerald-800 text-white font-mono text-[10px] font-bold uppercase tracking-wider">Administración fiduciaria</span>
              <span className="text-xs font-medium text-[#637568]">● Libro de ingresos confirmados</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#163323]" style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}>Ingresos del Fideicomiso</h1>
            <p className="text-xs sm:text-sm text-[#46574B] mt-1 max-w-2xl">Cobros, aportes y fondos recibidos. Cada registro impacta una única vez en Caja & Cuentas, sin duplicar cobranzas.</p>
          </div>
          {isAdmin && <button onClick={openNewIncome} className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-2 shadow-sm cursor-pointer"><Plus className="w-4 h-4 text-[#BFA270]" /> Registrar ingreso</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-4 bg-white border border-[#E3DFC8] p-4 shadow-xs">
          <div className="flex justify-between text-xs text-[#637568] font-bold uppercase tracking-wider mb-2"><span>Total ingresado</span><BanknoteArrowDown className="w-4 h-4 text-emerald-700" /></div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-800">{formatCurrency(total)}</div>
          <p className="text-[11px] text-[#7A8E7E] mt-1 font-medium">{filteredIncomes.length} ingreso{filteredIncomes.length === 1 ? '' : 's'} en {selectedPeriod === 'all' ? 'todos los períodos' : formatPeriod(selectedPeriod)}</p>
        </div>
        <div className="md:col-span-3 bg-[#FAF8F5] border border-[#DDD5BF] p-4 shadow-xs">
          <div className="flex justify-between text-xs text-[#163323] font-bold uppercase tracking-wider mb-2"><span>Origen</span><Users className="w-4 h-4 text-[#BFA270]" /></div>
          <div className="text-lg font-bold font-mono text-[#163323]">{filteredIncomes.filter((income) => income.userId).length}</div>
          <p className="text-[11px] text-[#7A8E7E] mt-1">ingresos identificados por copropietario</p>
        </div>
        <div className="md:col-span-5 bg-white border border-[#E3DFC8] p-3.5 shadow-xs">
          <div className="flex justify-between text-xs text-[#637568] font-bold uppercase tracking-wider mb-2"><span>Ingresos por categoría</span><Tag className="w-3.5 h-3.5 text-[#BFA270]" /></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {totalByCategory.map((category) => <div key={category.id} className="p-2 bg-emerald-50 border border-emerald-100 border-l-4 border-l-emerald-500 min-w-0"><span className="block text-[10px] font-bold text-emerald-900 truncate" title={category.name}>{category.name}</span><span className="block font-mono text-xs font-bold text-emerald-800 mt-1">{formatCurrency(category.total)}</span></div>)}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E3DFC8] p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-[#163323] uppercase tracking-wider whitespace-nowrap">Período:</span>
          {availablePeriods.map((period) => <button key={period} onClick={() => setSelectedPeriod(period)} className={`px-3 py-1 text-xs font-bold font-mono cursor-pointer whitespace-nowrap ${selectedPeriod === period ? 'bg-[#1B3B2B] text-white' : 'bg-[#FAF8F5] text-[#56685B] border border-[#DDD5BF]'}`}>{formatPeriod(period)}</button>)}
          <button onClick={() => setSelectedPeriod('all')} className={`px-3 py-1 text-xs font-bold cursor-pointer whitespace-nowrap ${selectedPeriod === 'all' ? 'bg-[#1B3B2B] text-white' : 'bg-[#FAF8F5] text-[#56685B] border border-[#DDD5BF]'}`}>Todos</button>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64"><Search className="w-3.5 h-3.5 text-[#7A8E7E] absolute left-2.5 top-1/2 -translate-y-1/2" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar concepto o persona..." className="w-full pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]" /></div>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as 'all' | IncomeCategory)} className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-medium text-[#163323] focus:outline-none"><option value="all">Todas las categorías</option>{incomeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        </div>
      </div>

      <section className="bg-white border border-[#E3DFC8] shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-[#163323] text-white flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Landmark className="w-3.5 h-3.5 text-[#BFA270]" />Detalle auditado de ingresos ({filteredIncomes.length})</span><span className="text-[11px] font-mono">Total: {formatCurrency(total)}</span></div>
        {filteredIncomes.length === 0 ? <div className="py-14 text-center text-sm text-[#7A8E7E]"><Wallet className="w-8 h-8 mx-auto mb-3 text-[#C9BEA5]" />No se encontraron ingresos con estos filtros.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[840px] text-xs"><thead className="bg-[#F6F2E8] text-[#526657] uppercase tracking-wide text-[10px]"><tr><th className="text-left p-3">Fecha / Mes</th><th className="text-left p-3">Concepto</th><th className="text-left p-3">Categoría</th><th className="text-left p-3">Origen</th><th className="text-right p-3">Monto</th><th className="text-left p-3">Estado</th><th className="text-right p-3">Acciones</th></tr></thead><tbody>{filteredIncomes.map((income) => {
          const automatic = income.id.startsWith('cf-fee-payment-');
          return <tr key={income.id} className="border-t border-[#EDE7D9] hover:bg-[#FCFBF8]"><td className="p-3 font-mono text-[#526657]"><div>{income.date || '-'}</div><span className="text-[10px] text-[#8B9A8D]">{income.date?.slice(0, 7) || '-'}</span></td><td className="p-3"><div className="font-bold text-[#163323]">{income.concept}</div>{income.notes && <div className="text-[10px] italic text-[#7A8E7E] max-w-xs truncate">{income.notes}</div>}</td><td className="p-3"><span className="inline-flex px-2 py-0.5 border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold text-[10px] uppercase">{categoryName(income.category, incomeCategories)}</span></td><td className="p-3"><div className="font-medium text-[#163323]">{income.userName || 'Fondos generales'}</div><span className="text-[10px] text-[#7A8E7E]">{automatic ? 'Cobranza confirmada' : 'Ingreso manual'}</span></td><td className="p-3 text-right font-mono font-bold text-emerald-800">{formatCurrency(income.amount, income.currency)}</td><td className="p-3"><span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5"><CheckCircle2 className="w-3 h-3" />Confirmado</span></td><td className="p-3"><div className="flex justify-end gap-2">{isAdmin && !automatic && <><button onClick={() => openEditIncome(income)} title="Editar ingreso" className="text-[#637568] hover:text-[#1B3B2B] cursor-pointer"><Edit3 className="w-4 h-4" /></button><button onClick={() => requestDelete(income)} title="Eliminar ingreso" className="text-[#9A6A5B] hover:text-red-700 cursor-pointer"><Trash2 className="w-4 h-4" /></button></>}{automatic && <span className="text-[10px] text-[#8B9A8D]">Gestionado desde Cobranzas</span>}</div></td></tr>;
        })}</tbody></table></div>}
      </section>

      {automaticCount > 0 && <p className="text-[11px] text-[#637568] flex gap-1.5 items-start"><CreditCard className="w-3.5 h-3.5 mt-0.5 shrink-0" />Los cobros creados desde Cobranzas se muestran aquí como confirmados, pero se editan o anulan desde Cobranzas para preservar el historial de las cuotas.</p>}

      {isFormOpen && <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-4"><form onSubmit={saveIncome} className="bg-[#FAF8F5] w-full max-w-2xl border border-[#DDD5BF] shadow-2xl overflow-hidden"><div className="bg-[#163323] text-white px-5 py-4 flex items-center justify-between"><div><h2 className="font-bold tracking-wide" style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}>{editingIncome ? 'Modificar ingreso' : 'Registrar nuevo ingreso'}</h2><p className="text-[10px] text-emerald-100 mt-0.5">Se refleja directamente en Caja & Cuentas.</p></div><button type="button" disabled={isSavingIncome} onClick={() => setIsFormOpen(false)} className="text-white/80 hover:text-white text-xl cursor-pointer disabled:opacity-40">×</button></div><div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"><label className="md:col-span-2 font-bold text-[#163323]">Concepto *<input autoFocus value={form.concept} onChange={(event) => setForm({ ...form, concept: event.target.value })} placeholder="Ej: Aporte extraordinario octubre" className="mt-1 w-full px-3 py-2 bg-white border border-[#DDD5BF] font-normal focus:outline-none focus:border-[#1B3B2B]" /></label><label className="font-bold text-[#163323]">Categoría<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as IncomeCategory })} className="mt-1 w-full px-3 py-2 bg-white border border-[#DDD5BF] font-normal focus:outline-none">{incomeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="font-bold text-[#163323]">Monto *<input type="number" min="0.01" step="0.01" value={form.amount || ''} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} className="mt-1 w-full px-3 py-2 bg-white border border-[#DDD5BF] font-mono font-normal focus:outline-none" /></label><label className="font-bold text-[#163323]">Fecha<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="mt-1 w-full px-3 py-2 bg-white border border-[#DDD5BF] font-normal focus:outline-none" /></label><label className="font-bold text-[#163323]">Moneda<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as 'ARS' | 'USD' })} className="mt-1 w-full px-3 py-2 bg-white border border-[#DDD5BF] font-normal focus:outline-none"><option value="ARS">ARS ($ Pesos)</option><option value="USD">USD (US$)</option></select></label><label className="md:col-span-2 font-bold text-[#163323]">Copropietario que aportó <span className="font-normal text-[#7A8E7E]">(opcional)</span><select value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} className="mt-1 w-full px-3 py-2 bg-white border border-[#DDD5BF] font-normal focus:outline-none"><option value="">Fondos generales / sin asignar</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}{user.partName ? ` · ${user.partName}` : ''}</option>)}</select></label><label className="md:col-span-2 font-bold text-[#163323]">Observaciones <span className="font-normal text-[#7A8E7E]">(opcional)</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} className="mt-1 w-full px-3 py-2 bg-white border border-[#DDD5BF] font-normal resize-none focus:outline-none" placeholder="Referencia, medio de cobro u observaciones..." /></label></div><div className="px-5 py-4 bg-[#F2EDE1] border-t border-[#DDD5BF] flex justify-end gap-3"><button type="button" disabled={isSavingIncome} onClick={() => setIsFormOpen(false)} className="px-4 py-2 border border-[#CFC5B0] bg-white text-xs font-bold uppercase cursor-pointer disabled:opacity-50">Cancelar</button><button type="submit" disabled={isSavingIncome} className="px-5 py-2 bg-[#1B3B2B] text-white text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">{isSavingIncome ? 'Guardando...' : editingIncome ? 'Guardar cambios' : 'Registrar ingreso'}</button></div></form></div>}

      <CustomDialogModal {...dialog} onClose={() => setDialog((current) => ({ ...current, isOpen: false }))} />
    </div>
  );
};
