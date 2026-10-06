import React, { useState, useEffect } from 'react';
import { User, ExpenseItem, ExpenseCategory, TrustSettings, FeeCollection, OwnerFeeAllocation, DistributionMode } from '../types';
import { storageService } from '../services/storageService';
import { r2Service } from '../services/r2Service';
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  Calendar,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  Trash2,
  Edit3,
  Building2,
  ArrowRight,
  TrendingUp,
  Receipt,
  Tag,
  ShieldCheck,
  X,
  Send,
  PieChart,
  Users,
  Check,
  ExternalLink,
} from 'lucide-react';

interface ExpensesViewProps {
  currentUser: User;
  settings: TrustSettings;
  isAdmin: boolean;
  onNavigateToCobranzas?: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  currentUser,
  settings,
  isAdmin,
  onNavigateToCobranzas,
}) => {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-10');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');

  // Modals
  const [isNewExpenseModalOpen, setIsNewExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Form State
  const [expenseForm, setExpenseForm] = useState<{
    concept: string;
    category: ExpenseCategory;
    amount: number;
    currency: 'ARS' | 'USD';
    periodMonth: string;
    date: string;
    provider: string;
    status: 'paid' | 'pending';
    paymentMethod: string;
    receiptUrl: string;
    notes: string;
  }>({
    concept: '',
    category: 'servicios',
    amount: 0,
    currency: 'ARS',
    periodMonth: '2026-10',
    date: new Date().toISOString().split('T')[0],
    provider: '',
    status: 'paid',
    paymentMethod: 'transfer',
    receiptUrl: '',
    notes: '',
  });

  const [isUploadingBill, setIsUploadingBill] = useState(false);

  // Transfer Modal State
  const [transferDueDate, setTransferDueDate] = useState(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [transferDistributionMode, setTransferDistributionMode] = useState<DistributionMode>('equal_cabezas');
  const [transferCustomPercentages, setTransferCustomPercentages] = useState<Record<string, number>>({});
  const [transferCustomAmounts, setTransferCustomAmounts] = useState<Record<string, number>>({});
  const [transferSuccessMsg, setTransferSuccessMsg] = useState(false);

  const loadExpenses = () => {
    setExpenses(storageService.getExpenses());
  };

  useEffect(() => {
    loadExpenses();
    const unsub = storageService.subscribe(loadExpenses);
    return () => unsub();
  }, []);

  // Distinct Periods available in expenses
  const availablePeriods = Array.from(
    new Set(expenses.map((e) => e.periodMonth || '2026-10'))
  ).sort().reverse();

  if (!availablePeriods.includes('2026-10')) availablePeriods.unshift('2026-10');

  // Filtered Expenses
  const filteredExpenses = expenses.filter((exp) => {
    if (selectedPeriod !== 'all' && exp.periodMonth !== selectedPeriod) return false;
    if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && exp.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match =
        exp.concept.toLowerCase().includes(q) ||
        (exp.provider && exp.provider.toLowerCase().includes(q)) ||
        (exp.notes && exp.notes.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Financial Metrics for Selected Period
  const periodTotalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const periodPaidAmount = filteredExpenses
    .filter((e) => e.status === 'paid')
    .reduce((sum, e) => sum + e.amount, 0);
  const periodPendingAmount = periodTotalAmount - periodPaidAmount;

  // Breakdown per Category
  const categoryTotals: Record<ExpenseCategory, number> = {
    servicios: 0,
    personal_casero: 0,
    mantenimiento: 0,
    impuestos: 0,
    insumos: 0,
    otro: 0,
  };

  filteredExpenses.forEach((e) => {
    if (categoryTotals[e.category] !== undefined) {
      categoryTotals[e.category] += e.amount;
    } else {
      categoryTotals.otro += e.amount;
    }
  });

  // Projections
  const costPerCabeza = Math.round(periodTotalAmount / 4);
  const costPerOwner = Math.round(periodTotalAmount / 15);

  // Category Category Badges
  const getCategoryBadge = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'servicios':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold uppercase rounded">Servicios (Luz/Agua/WiFi)</span>;
      case 'personal_casero':
        return <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold uppercase rounded">Personal / Casero</span>;
      case 'mantenimiento':
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold uppercase rounded">Mantenimiento & Parque</span>;
      case 'impuestos':
        return <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold uppercase rounded">Impuestos & Tasas</span>;
      case 'insumos':
        return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded">Insumos & Consumibles</span>;
      default:
        return <span className="px-2 py-0.5 bg-neutral-100 text-neutral-800 text-[10px] font-bold uppercase rounded">Otro Gasto</span>;
    }
  };

  // Upload Bill / Factura Voucher
  const handleBillFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBill(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await r2Service.uploadPhoto(base64, `factura-${Date.now()}-${file.name}`, 'facturas');
        if (res.success && res.url) {
          setExpenseForm((prev) => ({ ...prev, receiptUrl: res.url! }));
        } else {
          setExpenseForm((prev) => ({ ...prev, receiptUrl: base64 }));
        }
      } catch {
        setExpenseForm((prev) => ({ ...prev, receiptUrl: base64 }));
      } finally {
        setIsUploadingBill(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Open Edit Expense
  const handleEditExpense = (exp: ExpenseItem) => {
    setEditingExpense(exp);
    setExpenseForm({
      concept: exp.concept,
      category: exp.category,
      amount: exp.amount,
      currency: exp.currency || 'ARS',
      periodMonth: exp.periodMonth || '2026-10',
      date: exp.date || new Date().toISOString().split('T')[0],
      provider: exp.provider || '',
      status: exp.status,
      paymentMethod: exp.paymentMethod || 'transfer',
      receiptUrl: exp.receiptUrl || '',
      notes: exp.notes || '',
    });
    setIsNewExpenseModalOpen(true);
  };

  // Save Expense
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.concept.trim()) {
      alert('Por favor, ingrese un concepto para el gasto.');
      return;
    }

    if (expenseForm.amount <= 0) {
      alert('El monto del gasto debe ser mayor a cero.');
      return;
    }

    const itemToSave: ExpenseItem = {
      id: editingExpense ? editingExpense.id : 'exp-' + Date.now(),
      concept: expenseForm.concept.trim(),
      category: expenseForm.category,
      amount: expenseForm.amount,
      currency: expenseForm.currency,
      periodMonth: expenseForm.periodMonth,
      date: expenseForm.date,
      provider: expenseForm.provider.trim(),
      status: expenseForm.status,
      paymentMethod: expenseForm.paymentMethod,
      receiptUrl: expenseForm.receiptUrl,
      notes: expenseForm.notes.trim(),
      createdBy: currentUser.name,
      createdAt: editingExpense ? editingExpense.createdAt : new Date().toISOString(),
    };

    storageService.saveExpense(itemToSave);
    setIsNewExpenseModalOpen(false);
    setEditingExpense(null);
  };

  // Delete Expense
  const handleDeleteExpense = (id: string) => {
    if (confirm('¿Está seguro de eliminar este registro de gasto?')) {
      storageService.deleteExpense(id);
    }
  };

  // Calculate allocations for transfer modal
  const calculateTransferAllocations = (): OwnerFeeAllocation[] => {
    const activeUsers = storageService.getUsers().filter((u) => u.active !== false);
    if (activeUsers.length === 0) return [];

    if (transferDistributionMode === 'equal_cabezas') {
      const cabezaGroups: Record<number, User[]> = { 1: [], 2: [], 3: [], 4: [] };
      activeUsers.forEach((u) => {
        const cNum = u.cabezaNumber || 1;
        if (!cabezaGroups[cNum]) cabezaGroups[cNum] = [];
        cabezaGroups[cNum].push(u);
      });

      const allocations: OwnerFeeAllocation[] = [];
      const amountPerCabeza = periodTotalAmount / 4;
      const pctPerCabeza = 100 / 4;

      for (let cNum = 1; cNum <= 4; cNum++) {
        const members = cabezaGroups[cNum] || [];
        if (members.length > 0) {
          const amtPerMember = Math.round((amountPerCabeza / members.length) * 100) / 100;
          const pctPerMember = Math.round((pctPerCabeza / members.length) * 10000) / 10000;
          members.forEach((m) => {
            allocations.push({
              userId: m.id,
              userName: m.name,
              partName: m.partName,
              cabezaNumber: m.cabezaNumber,
              percentage: pctPerMember,
              assignedAmount: amtPerMember,
              paidAmount: 0,
              status: 'pending',
            });
          });
        }
      }
      return allocations;
    } else if (transferDistributionMode === 'equal_owners') {
      const N = activeUsers.length;
      const amtPerOwner = Math.round((periodTotalAmount / N) * 100) / 100;
      const pctPerOwner = Math.round((100 / N) * 10000) / 10000;
      return activeUsers.map((m) => ({
        userId: m.id,
        userName: m.name,
        partName: m.partName,
        cabezaNumber: m.cabezaNumber,
        percentage: pctPerOwner,
        assignedAmount: amtPerOwner,
        paidAmount: 0,
        status: 'pending',
      }));
    } else if (transferDistributionMode === 'percentage') {
      return activeUsers.map((m) => {
        const pct = transferCustomPercentages[m.id] ?? Math.round((100 / activeUsers.length) * 10000) / 10000;
        const assigned = Math.round((periodTotalAmount * (pct / 100)) * 100) / 100;
        return {
          userId: m.id,
          userName: m.name,
          partName: m.partName,
          cabezaNumber: m.cabezaNumber,
          percentage: pct,
          assignedAmount: assigned,
          paidAmount: 0,
          status: 'pending',
        };
      });
    } else {
      // custom_amount
      return activeUsers.map((m) => {
        const assigned = transferCustomAmounts[m.id] ?? Math.round(periodTotalAmount / activeUsers.length);
        const pct = periodTotalAmount > 0 ? Math.round((assigned / periodTotalAmount) * 10000) / 100 : 0;
        return {
          userId: m.id,
          userName: m.name,
          partName: m.partName,
          cabezaNumber: m.cabezaNumber,
          percentage: pct,
          assignedAmount: assigned,
          paidAmount: 0,
          status: 'pending',
        };
      });
    }
  };

  const liveTransferAllocations = calculateTransferAllocations();
  const liveTransferTotalPct = liveTransferAllocations.reduce((s, a) => s + a.percentage, 0);
  const liveTransferTotalAmt = liveTransferAllocations.reduce((s, a) => s + a.assignedAmount, 0);

  // TRANSFER TO COBRANZA (GENERATE FEE COLLECTION FROM MONTHLY EXPENSES)
  const handleTransferToCobranza = () => {
    if (periodTotalAmount <= 0) {
      alert('No hay gastos acumulados en el período seleccionado para trasladar a cobranza.');
      return;
    }

    // Build itemized bullet list of expenses
    const itemizedList = filteredExpenses
      .map((e) => `• ${e.concept}: $${e.amount.toLocaleString()} ARS (${e.provider || 'S/D'})`)
      .join('\n');

    const formattedPeriodLabel = selectedPeriod === '2026-10' ? 'Octubre 2026' : selectedPeriod;
    const allocations = calculateTransferAllocations();

    const newFeeCollection: FeeCollection = {
      id: 'fee-expenses-' + Date.now(),
      concept: `Expensas Mensuales Ordinarias - Rendición Gastos ${formattedPeriodLabel}`,
      category: 'expensas_ordinarias',
      totalAmount: periodTotalAmount,
      currency: 'ARS',
      recurrence: 'monthly',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: transferDueDate,
      distributionMode: transferDistributionMode,
      allocations,
      status: 'active',
      createdBy: `${currentUser.name} (Administración)`,
      createdAt: new Date().toISOString(),
      notes: `Gastos consolidados del mes:\n${itemizedList}`,
    };

    storageService.saveFeeCollection(newFeeCollection);

    // Mark current expenses as transferred
    filteredExpenses.forEach((e) => {
      storageService.saveExpense({
        ...e,
        transferredToFeeCollectionId: newFeeCollection.id,
      });
    });

    setTransferSuccessMsg(true);
    setTimeout(() => {
      setTransferSuccessMsg(false);
      setIsTransferModalOpen(false);
      if (onNavigateToCobranzas) onNavigateToCobranzas();
    }, 2000);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-[#FAF8F5] to-transparent pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-[#1B3B2B] text-[#FAF8F5] font-mono text-[10px] font-bold uppercase tracking-wider">
                Administración Fiduciaria
              </span>
              <span className="text-xs font-medium text-[#637568]">● Libro de Gastos y Facturas</span>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-bold text-[#163323]"
              style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
            >
              Gestor de Gastos y Costos Operativos
            </h1>
            <p className="text-xs sm:text-sm text-[#46574B] mt-1 max-w-2xl">
              Registro auditado de facturas de luz, sueldo de casero, mantenimiento de parque, impuestos e insumos. Cálculo automático del número mensual y traslado en 1-clic a Cobranzas de Expensas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isAdmin && (
              <>
                <button
                  onClick={() => setIsTransferModalOpen(true)}
                  className="px-4 py-2 bg-[#BFA270] hover:bg-[#a38758] text-[#163323] text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <Send className="w-4 h-4 text-[#163323]" />
                  <span>Trasladar Mes a Cobranza</span>
                </button>

                <button
                  onClick={() => {
                    setEditingExpense(null);
                    setExpenseForm({
                      concept: '',
                      category: 'servicios',
                      amount: 0,
                      currency: 'ARS',
                      periodMonth: selectedPeriod === 'all' ? '2026-10' : selectedPeriod,
                      date: new Date().toISOString().split('T')[0],
                      provider: '',
                      status: 'paid',
                      paymentMethod: 'transfer',
                      receiptUrl: '',
                      notes: '',
                    });
                    setIsNewExpenseModalOpen(true);
                  }}
                  className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-[#FAF8F5] text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#BFA270]" />
                  <span>+ Registrar Gasto / Factura</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI Financial Metric Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Card 1: Total Gastos */}
        <div className="md:col-span-3 bg-white border border-[#E3DFC8] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#637568] font-bold uppercase tracking-wider mb-2">
            <span>Total Gastos ({selectedPeriod === 'all' ? 'Todos' : selectedPeriod})</span>
            <Receipt className="w-4 h-4 text-[#163323]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#163323]">
            ${periodTotalAmount.toLocaleString()} <span className="text-xs font-sans text-[#7A8E7E]">ARS</span>
          </div>
          <p className="text-[11px] text-[#7A8E7E] mt-1 font-medium">
            {filteredExpenses.length} facturas/gastos registrados
          </p>
        </div>

        {/* Card 2: Estado de Pago de Facturas */}
        <div className="md:col-span-3 bg-[#FAF8F5] border border-[#DDD5BF] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#163323] font-bold uppercase tracking-wider mb-2">
            <span>Estado de Pago de Facturas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-sm sm:text-base font-bold font-mono text-emerald-800">
              ${periodPaidAmount.toLocaleString()} pagados
            </div>
            {periodPendingAmount > 0 ? (
              <p className="text-xs text-amber-700 font-mono font-bold mt-1">
                ${periodPendingAmount.toLocaleString()} pendiente de pago
              </p>
            ) : (
              <p className="text-[11px] text-emerald-700 font-medium mt-1">
                ✓ Todas las facturas del mes están pagadas
              </p>
            )}
          </div>
          <span className="text-[10px] text-[#7A8E7E] block mt-1">
            Control de liquidación de proveedores
          </span>
        </div>

        {/* Card 3: Gastos por Categoría (Compacto) */}
        <div className="md:col-span-6 bg-white border border-[#E3DFC8] p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#637568] font-bold uppercase tracking-wider mb-2">
            <span>Gastos por Categoría</span>
            <Tag className="w-3.5 h-3.5 text-[#BFA270]" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-1.5 bg-[#FAF8F5] border border-[#DDD5BF] flex flex-col justify-center">
              <span className="text-[10px] font-bold text-blue-900 truncate">Servicios (Luz/Agua/WiFi)</span>
              <span className="font-mono text-xs font-bold text-[#163323] mt-0.5">
                ${categoryTotals.servicios.toLocaleString()}
              </span>
            </div>

            <div className="p-1.5 bg-[#FAF8F5] border border-[#DDD5BF] flex flex-col justify-center">
              <span className="text-[10px] font-bold text-purple-900 truncate">Personal / Casero</span>
              <span className="font-mono text-xs font-bold text-[#163323] mt-0.5">
                ${categoryTotals.personal_casero.toLocaleString()}
              </span>
            </div>

            <div className="p-1.5 bg-[#FAF8F5] border border-[#DDD5BF] flex flex-col justify-center">
              <span className="text-[10px] font-bold text-amber-900 truncate">Mantenimiento</span>
              <span className="font-mono text-xs font-bold text-[#163323] mt-0.5">
                ${categoryTotals.mantenimiento.toLocaleString()}
              </span>
            </div>

            <div className="p-1.5 bg-[#FAF8F5] border border-[#DDD5BF] flex flex-col justify-center">
              <span className="text-[10px] font-bold text-red-900 truncate">Impuestos & Tasas</span>
              <span className="font-mono text-xs font-bold text-[#163323] mt-0.5">
                ${categoryTotals.impuestos.toLocaleString()}
              </span>
            </div>

            <div className="p-1.5 bg-[#FAF8F5] border border-[#DDD5BF] flex flex-col justify-center">
              <span className="text-[10px] font-bold text-emerald-900 truncate">Insumos & Limpieza</span>
              <span className="font-mono text-xs font-bold text-[#163323] mt-0.5">
                ${categoryTotals.insumos.toLocaleString()}
              </span>
            </div>

            {categoryTotals.otro > 0 && (
              <div className="p-1.5 bg-[#FAF8F5] border border-[#DDD5BF] flex flex-col justify-center">
                <span className="text-[10px] font-bold text-neutral-800 truncate">Otros Gastos</span>
                <span className="font-mono text-xs font-bold text-[#163323] mt-0.5">
                  ${categoryTotals.otro.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Period Filter & Controls Bar */}
      <div className="bg-white border border-[#E3DFC8] p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        {/* Period Selector Tabs */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-[#163323] uppercase tracking-wider whitespace-nowrap">
            Período:
          </span>
          {availablePeriods.map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`px-3 py-1 text-xs font-bold font-mono transition-colors cursor-pointer ${
                selectedPeriod === p
                  ? 'bg-[#1B3B2B] text-white'
                  : 'bg-[#FAF8F5] text-[#56685B] border border-[#DDD5BF] hover:bg-[#F4EFE6]'
              }`}
            >
              {p === '2026-10' ? 'Octubre 2026' : p === '2026-09' ? 'Septiembre 2026' : p}
            </button>
          ))}
          <button
            onClick={() => setSelectedPeriod('all')}
            className={`px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
              selectedPeriod === 'all'
                ? 'bg-[#1B3B2B] text-white'
                : 'bg-[#FAF8F5] text-[#56685B] border border-[#DDD5BF] hover:bg-[#F4EFE6]'
            }`}
          >
            Todos los Meses
          </button>
        </div>

        {/* Category & Search Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-[#7A8E7E] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por concepto o proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-medium text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
          >
            <option value="all">Todas las Categorías</option>
            <option value="servicios">Servicios (Luz/Agua/WiFi)</option>
            <option value="personal_casero">Personal / Casero</option>
            <option value="mantenimiento">Mantenimiento & Parque</option>
            <option value="impuestos">Impuestos & Tasas</option>
            <option value="insumos">Insumos & Limpieza</option>
            <option value="otro">Otros Gastos</option>
          </select>
        </div>
      </div>

      {/* Expenses List Table */}
      <div className="bg-white border border-[#E3DFC8] shadow-xs overflow-hidden">
        <div className="p-3 bg-[#FAF8F5] border-b border-[#E3DFC8] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#163323] uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#BFA270]" />
            Detalle Auditado de Gastos del Fideicomiso ({filteredExpenses.length} Ítems)
          </h3>

          <span className="text-xs text-[#637568]">
            Suma Total: <strong className="font-mono text-[#163323]">${periodTotalAmount.toLocaleString()} ARS</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1B3B2B] text-[#FAF8F5] font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Fecha / Mes</th>
                <th className="py-2.5 px-3">Concepto del Gasto</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3">Proveedor / Entidad</th>
                <th className="py-2.5 px-3 text-right">Monto ($ ARS)</th>
                <th className="py-2.5 px-3 text-center">Estado</th>
                <th className="py-2.5 px-3 text-center">Factura / Comprobante</th>
                {isAdmin && <th className="py-2.5 px-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3DFC8]">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#7A8E7E]">
                    No se encontraron registros de gastos para el período seleccionado.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-[#56685B]">
                      {exp.date}
                      <span className="block text-[10px] text-[#7A8E7E]">Mes: {exp.periodMonth}</span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#163323]">
                      {exp.concept}
                      {exp.notes && <span className="block text-[10px] text-[#637568] font-normal italic">"{exp.notes}"</span>}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getCategoryBadge(exp.category)}
                    </td>
                    <td className="py-3 px-3 text-[#46574B]">
                      {exp.provider || '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#163323]">
                      ${exp.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {exp.status === 'paid' ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded-full">
                          Pagado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded-full">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {exp.receiptUrl ? (
                        <a
                          href={exp.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#2563EB] hover:underline font-semibold flex items-center justify-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Ver Factura</span>
                        </a>
                      ) : (
                        <span className="text-neutral-400 italic text-[11px]">Sin adjunto</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEditExpense(exp)}
                            className="p-1 text-[#637568] hover:text-[#163323] cursor-pointer"
                            title="Editar gasto"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1 text-neutral-400 hover:text-red-700 cursor-pointer"
                            title="Eliminar gasto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New / Edit Expense */}
      {isNewExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white border border-[#E3DFC8] max-w-lg w-full p-6 shadow-xl relative">
            <button
              onClick={() => setIsNewExpenseModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-[#637568] hover:text-[#163323] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4 border-b border-[#E3DFC8] pb-3">
              <div className="w-8 h-8 bg-[#1B3B2B] text-[#BFA270] rounded flex items-center justify-center font-bold">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#163323]">
                  {editingExpense ? 'Modificar Gasto Registrado' : 'Registrar Nuevo Gasto / Factura'}
                </h3>
                <p className="text-xs text-[#637568]">Ingrese los detalles del gasto operativo del fideicomiso.</p>
              </div>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#163323] mb-1">Concepto del Gasto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Factura Luz EPEC Octubre / Sueldo Casero"
                  value={expenseForm.concept}
                  onChange={(e) => setExpenseForm({ ...expenseForm, concept: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163323] mb-1">Categoría</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as ExpenseCategory })}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs focus:outline-none focus:border-[#1B3B2B]"
                  >
                    <option value="servicios">Servicios (Luz/Agua/WiFi)</option>
                    <option value="personal_casero">Personal / Casero</option>
                    <option value="mantenimiento">Mantenimiento & Parque</option>
                    <option value="impuestos">Impuestos & Tasas</option>
                    <option value="insumos">Insumos & Limpieza</option>
                    <option value="otro">Otro Gasto</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#163323] mb-1">Monto ($ ARS) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="150000"
                    value={expenseForm.amount || ''}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-xs font-bold text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163323] mb-1">Período / Mes (YYYY-MM)</label>
                  <input
                    type="text"
                    placeholder="2026-10"
                    value={expenseForm.periodMonth}
                    onChange={(e) => setExpenseForm({ ...expenseForm, periodMonth: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-xs focus:outline-none focus:border-[#1B3B2B]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#163323] mb-1">Fecha de Facturación / Pago</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-xs focus:outline-none focus:border-[#1B3B2B]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">Proveedor / Entidad</label>
                <input
                  type="text"
                  placeholder="Ej: EPEC, Telecom, Casero Ramón"
                  value={expenseForm.provider}
                  onChange={(e) => setExpenseForm({ ...expenseForm, provider: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163323] mb-1">Estado</label>
                  <select
                    value={expenseForm.status}
                    onChange={(e) => setExpenseForm({ ...expenseForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-semibold focus:outline-none focus:border-[#1B3B2B]"
                  >
                    <option value="paid">Pagado</option>
                    <option value="pending">Pendiente de Pago</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#163323] mb-1">Medio de Pago</label>
                  <select
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs focus:outline-none focus:border-[#1B3B2B]"
                  >
                    <option value="transfer">Transferencia Bancaria</option>
                    <option value="cash">Efectivo</option>
                    <option value="mercadopago">MercadoPago</option>
                    <option value="check">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">Adjuntar Factura / Comprobante (Imagen o PDF)</label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-semibold text-[#163323] flex items-center justify-center gap-2 cursor-pointer hover:bg-[#F4EFE6] transition-colors">
                    <Upload className="w-4 h-4 text-[#BFA270]" />
                    <span>{isUploadingBill ? 'Subiendo factura...' : 'Cargar Comprobante / Factura'}</span>
                    <input type="file" accept="image/*,.pdf" onChange={handleBillFileUpload} className="hidden" />
                  </label>
                </div>
                {expenseForm.receiptUrl && (
                  <p className="text-[11px] text-emerald-700 font-medium mt-1 truncate">
                    ✓ Adjunto guardado correctamente
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  placeholder="Detalles adicionales del comprobante..."
                  className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3DFC8]">
                <button
                  type="button"
                  onClick={() => setIsNewExpenseModalOpen(false)}
                  className="px-4 py-2 border border-[#DDD5BF] text-xs font-bold text-[#637568] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
                >
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transfer Period Expenses to Fee Collection */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white border border-[#E3DFC8] max-w-lg w-full p-6 shadow-xl relative">
            <button
              onClick={() => setIsTransferModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-[#637568] hover:text-[#163323] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4 border-b border-[#E3DFC8] pb-3">
              <div className="w-8 h-8 bg-[#BFA270] text-[#163323] rounded flex items-center justify-center font-bold">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#163323]">Trasladar Gastos a Cobranza de Expensas</h3>
                <p className="text-xs text-[#637568]">Emita una orden de cobranza para todos los copropietarios en base a los gastos reales del mes.</p>
              </div>
            </div>

            {transferSuccessMsg ? (
              <div className="p-6 bg-emerald-50 border border-emerald-300 text-emerald-800 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold">¡Cobranza Generada Exitosamente!</p>
                <p className="text-xs">Los gastos de {selectedPeriod} fueron liquidados y trasladados al padrón de cobranzas.</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-3 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-[#163323] uppercase">Período A Liquidar:</span>
                    <span className="font-mono font-bold text-[#1B3B2B] bg-[#F4EFE6] px-2 py-0.5">
                      {selectedPeriod === '2026-10' ? 'Octubre 2026' : selectedPeriod}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#637568]">Total Gastos Acumulados:</span>
                    <span className="font-mono font-bold text-[#163323] text-sm">
                      ${periodTotalAmount.toLocaleString()} ARS
                    </span>
                  </div>

                  <div className="border-t border-[#E3DFC8] pt-2 space-y-1">
                    <p className="text-[11px] font-bold text-[#163323]">Simulación de Cuotas:</p>
                    <div className="flex justify-between text-[11px]">
                      <span>Si se divide por Cabezas (4 partes):</span>
                      <strong className="font-mono text-[#1B3B2B]">${costPerCabeza.toLocaleString()} / Cabeza</strong>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span>Si se divide por Copropietario (15 partes):</span>
                      <strong className="font-mono text-[#1B3B2B]">${costPerOwner.toLocaleString()} / Copropietario</strong>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#163323] mb-1">Modo de División de Expensas *</label>
                  <select
                    value={transferDistributionMode}
                    onChange={(e) => setTransferDistributionMode(e.target.value as DistributionMode)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-semibold text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                  >
                    <option value="equal_cabezas">Por Cabezas (4 partes iguales de 25%)</option>
                    <option value="equal_owners">Por Copropietario (15 partes iguales de 1/15)</option>
                    <option value="percentage">Porcentaje Personalizado (% para cada socio)</option>
                    <option value="custom_amount">Monto Fijo Personalizado ($ para cada socio)</option>
                  </select>
                </div>

                {/* Custom Percentage Editor */}
                {transferDistributionMode === 'percentage' && (
                  <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-3 space-y-2 max-h-48 overflow-y-auto">
                    <div className="flex justify-between items-center font-bold text-[#163323]">
                      <span>Ingresar Porcentajes por Socio (%):</span>
                      <span className={`font-mono text-xs ${Math.abs(liveTransferTotalPct - 100) < 0.1 ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}`}>
                        Total: {liveTransferTotalPct.toFixed(2)}% / 100%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {storageService.getUsers().filter((u) => u.active !== false).map((u) => (
                        <div key={u.id} className="flex items-center gap-1.5 bg-white p-1.5 border border-[#DDD5BF]">
                          <span className="text-[11px] font-semibold text-[#163323] truncate flex-1">{u.name}</span>
                          <input
                            type="number"
                            step={0.1}
                            min={0}
                            max={100}
                            value={transferCustomPercentages[u.id] ?? (100 / 15).toFixed(2)}
                            onChange={(e) =>
                              setTransferCustomPercentages({
                                ...transferCustomPercentages,
                                [u.id]: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-16 px-1 py-0.5 font-mono text-right text-xs border border-[#DDD5BF] focus:outline-none focus:border-[#1B3B2B]"
                          />
                          <span className="text-[10px] text-[#7A8E7E]">%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Amount Editor */}
                {transferDistributionMode === 'custom_amount' && (
                  <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-3 space-y-2 max-h-48 overflow-y-auto">
                    <div className="flex justify-between items-center font-bold text-[#163323]">
                      <span>Ingresar Montos Fijos por Socio ($):</span>
                      <span className={`font-mono text-xs ${liveTransferTotalAmt === periodTotalAmount ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}`}>
                        Suma: ${liveTransferTotalAmt.toLocaleString()} / ${periodTotalAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {storageService.getUsers().filter((u) => u.active !== false).map((u) => (
                        <div key={u.id} className="flex items-center gap-1.5 bg-white p-1.5 border border-[#DDD5BF]">
                          <span className="text-[11px] font-semibold text-[#163323] truncate flex-1">{u.name}</span>
                          <input
                            type="number"
                            step={1000}
                            min={0}
                            value={transferCustomAmounts[u.id] ?? Math.round(periodTotalAmount / 15)}
                            onChange={(e) =>
                              setTransferCustomAmounts({
                                ...transferCustomAmounts,
                                [u.id]: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-20 px-1 py-0.5 font-mono text-right text-xs border border-[#DDD5BF] focus:outline-none focus:border-[#1B3B2B]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Preview Table */}
                <div>
                  <label className="block font-bold text-[#163323] mb-1">
                    Previsualización de Cuotas por Copropietario ({liveTransferAllocations.length} Socios)
                  </label>
                  <div className="border border-[#E3DFC8] max-h-36 overflow-y-auto bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#1B3B2B] text-white font-mono text-[10px] sticky top-0">
                        <tr>
                          <th className="p-1.5">Copropietario</th>
                          <th className="p-1.5">Parte</th>
                          <th className="p-1.5 text-right">% Asignado</th>
                          <th className="p-1.5 text-right">Monto Cuota ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E3DFC8]">
                        {liveTransferAllocations.map((alloc) => (
                          <tr key={alloc.userId} className="hover:bg-[#FAF8F5]">
                            <td className="p-1.5 font-semibold text-[#163323]">{alloc.userName}</td>
                            <td className="p-1.5 text-[#56685B]">{alloc.partName}</td>
                            <td className="p-1.5 text-right font-mono text-[#56685B]">{alloc.percentage.toFixed(2)}%</td>
                            <td className="p-1.5 text-right font-mono font-bold text-[#163323]">
                              ${alloc.assignedAmount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#163323] mb-1">Fecha de Vencimiento de la Cobranza</label>
                  <input
                    type="date"
                    value={transferDueDate}
                    onChange={(e) => setTransferDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-xs focus:outline-none focus:border-[#1B3B2B]"
                  />
                </div>

                <div className="bg-[#FFFDF7] p-2.5 border border-[#E8E2D2] text-[11px] text-[#56685B]">
                  <strong>Resumen de Gastos Incluidos:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 max-h-24 overflow-y-auto font-mono text-[10px]">
                    {filteredExpenses.map((e) => (
                      <li key={e.id}>
                        {e.concept}: ${e.amount.toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3DFC8]">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="px-4 py-2 border border-[#DDD5BF] text-xs font-bold text-[#637568] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleTransferToCobranza}
                    className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5 text-[#BFA270]" />
                    <span>Emitir Cobranza Ahora</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
