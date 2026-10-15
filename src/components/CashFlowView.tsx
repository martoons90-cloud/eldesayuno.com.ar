import React, { useState, useEffect } from 'react';
import {
  User,
  CashFlowTransaction,
  CashFlowType,
  CashFlowCategory,
  ExpenseItem,
  ExpenseCategory,
  TrustSettings,
  isUserAdmin,
  isUserIntendente,
  hasFinancialAccess,
  canUploadExpenses,
} from '../types';
import { storageService } from '../services/storageService';
import { UserRoleBadge } from './UserRoleBadge';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Trash2,
  Check,
  X,
  Wallet,
  Receipt,
  Building2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  FileText,
  UserCheck,
  Coins,
  RefreshCw,
} from 'lucide-react';

interface CashFlowViewProps {
  currentUser: User;
  settings: TrustSettings;
  isAdmin?: boolean;
  onNavigateToCobranzas?: () => void;
}

export const CashFlowView: React.FC<CashFlowViewProps> = ({
  currentUser,
  settings,
  isAdmin,
  onNavigateToCobranzas,
}) => {
  const [cashFlows, setCashFlows] = useState<CashFlowTransaction[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Filters
  const [activeTabSub, setActiveTabSub] = useState<'caja' | 'cuentas' | 'gastos_pendientes'>('caja');
  const [typeFilter, setTypeFilter] = useState<'all' | 'ingreso' | 'egreso'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [txType, setTxType] = useState<CashFlowType>('ingreso');
  const [txCategory, setTxCategory] = useState<CashFlowCategory>('aporte_socio');
  const [txConcept, setTxConcept] = useState('');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [txLinkedUserId, setTxLinkedUserId] = useState<string>('');
  const [txNotes, setTxNotes] = useState('');

  // Expense Submission Modal (for Cabezas de Equipo, Admin, Intendente)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expConcept, setExpConcept] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('servicios');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expDate, setExpDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expProvider, setExpProvider] = useState('');
  const [expInvoiceNumber, setExpInvoiceNumber] = useState('');
  const [expPayerUserId, setExpPayerUserId] = useState('');
  const [expNotes, setExpNotes] = useState('');

  // Partial Reimbursement Modal (for Admin/Intendente managing owner account balances)
  const [reimburseModalUser, setReimburseModalUser] = useState<{ userId: string; userName: string; balanceDue: number } | null>(null);
  const [reimburseAmount, setReimburseAmount] = useState<number>(0);
  const [reimburseNotes, setReimburseNotes] = useState('');

  const fullAdmin = isAdmin !== undefined ? isAdmin : hasFinancialAccess(currentUser);
  const canUpload = canUploadExpenses(currentUser);

  useEffect(() => {
    const syncData = async () => {
      const [freshCF, freshExp] = await Promise.all([
        storageService.fetchCashFlowFromDatabase(),
        storageService.fetchExpensesFromDatabase(),
      ]);
      if (freshCF && Array.isArray(freshCF)) setCashFlows(freshCF);
      if (freshExp && Array.isArray(freshExp)) setExpenses(freshExp);
      setUsers(storageService.getUsers());
    };
    syncData();
    const unsub = storageService.subscribe(syncData);
    return () => unsub();
  }, []);

  // 1. Transactions filtered by role (Admin/Intendente sees all; Copropietario sees only their own)
  const isUserTx = (t: CashFlowTransaction) => {
    if (t.userId && t.userId === currentUser.id) return true;
    if (t.userName && currentUser.name && t.userName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()) return true;
    return false;
  };

  const visibleCashFlows = fullAdmin ? cashFlows : cashFlows.filter(isUserTx);

  // Global cash totals (for Admin / Intendente)
  const totalIngresos = cashFlows
    .filter((t) => t.type === 'ingreso')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalEgresos = cashFlows
    .filter((t) => t.type === 'egreso')
    .reduce((sum, t) => sum + t.amount, 0);

  const cajaBalance = totalIngresos - totalEgresos;

  // Personal cash totals (for Copropietario)
  const myIngresos = visibleCashFlows
    .filter((t) => t.type === 'ingreso')
    .reduce((sum, t) => sum + t.amount, 0);

  const myEgresos = visibleCashFlows
    .filter((t) => t.type === 'egreso')
    .reduce((sum, t) => sum + t.amount, 0);

  // Eligible users for Cuentas Corrientes:
  // Admin sees all owner accounts; Copropietario sees ONLY their own account ("su parte")
  const targetUsers = fullAdmin
    ? users.filter((u) => u.role !== 'intendente' && u.role !== 'fiduciante')
    : users.filter(
        (u) =>
          u.id === currentUser.id ||
          (currentUser.name && u.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      );

  const finalUsers = (!fullAdmin && targetUsers.length === 0) ? [currentUser] : targetUsers;

  const visibleAccountBalances = finalUsers.map((u) => {
    // Expenses submitted by this user that are approved
    const userApprovedExpenses = expenses.filter(
      (e) => (e.userId === u.id || (e.userName && e.userName.toLowerCase() === u.name.toLowerCase())) &&
             (e.approvalStatus === 'approved' || e.status === 'paid')
    );
    const totalAdvanced = userApprovedExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Reimbursements issued to this user from cash flow
    const userReimbursements = cashFlows.filter(
      (t) => (t.userId === u.id || (t.userName && t.userName.toLowerCase() === u.name.toLowerCase())) &&
             t.category === 'reintegro_gasto'
    );
    const totalReimbursed = userReimbursements.reduce((sum, t) => sum + t.amount, 0);

    const balanceDue = Math.max(0, totalAdvanced - totalReimbursed);
    const pendingExpensesCount = expenses.filter(
      (e) => (e.userId === u.id || (e.userName && e.userName.toLowerCase() === u.name.toLowerCase())) &&
             e.approvalStatus === 'pending'
    ).length;

    return {
      userId: u.id,
      userName: u.name,
      partName: u.partName,
      userColor: u.color,
      totalAdvanced,
      totalReimbursed,
      balanceDue,
      pendingExpensesCount,
    };
  });

  const myAccount = visibleAccountBalances.find(
    (acc) =>
      acc.userId === currentUser.id ||
      (currentUser.name && acc.userName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
  ) || visibleAccountBalances[0] || {
    totalAdvanced: 0,
    totalReimbursed: 0,
    balanceDue: 0,
    pendingExpensesCount: 0,
  };

  // Pending expenses submitted for admin/intendente approval
  const pendingExpenses = expenses.filter((e) => !e.approvalStatus || e.approvalStatus === 'pending');

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txConcept.trim() || txAmount <= 0) {
      alert('Por favor ingrese un concepto válido y un monto mayor a 0.');
      return;
    }

    const linkedUser = users.find((u) => u.id === txLinkedUserId);

    const newTx: CashFlowTransaction = {
      id: `cf-${Date.now()}`,
      type: txType,
      category: txCategory,
      concept: txConcept.trim(),
      amount: Number(txAmount),
      currency: 'ARS',
      date: txDate,
      userId: linkedUser?.id,
      userName: linkedUser?.name,
      partName: linkedUser?.partName,
      notes: txNotes.trim(),
      createdBy: `${currentUser.name} (${currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'intendente' ? 'Intendente' : 'Socio'})`,
      createdAt: new Date().toISOString(),
    };

    storageService.saveCashFlowTransaction(newTx);
    setIsTransactionModalOpen(false);
    setTxConcept('');
    setTxAmount(0);
    setTxNotes('');
  };

  const handleCreateExpenseSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expConcept.trim() || expAmount <= 0) {
      alert('Por favor ingrese un concepto y monto válido.');
      return;
    }

    const selectedPayer = users.find((u) => u.id === expPayerUserId) || currentUser;

    const newExpense: ExpenseItem = {
      id: `exp-${Date.now()}`,
      concept: expConcept.trim(),
      category: expCategory,
      amount: Number(expAmount),
      currency: 'ARS',
      periodMonth: expDate.substring(0, 7),
      date: expDate,
      provider: expProvider.trim() || selectedPayer.name,
      invoiceNumber: expInvoiceNumber.trim() || undefined,
      status: 'pending',
      approvalStatus: fullAdmin ? 'approved' : 'pending', // Admin/Intendente auto-approve, others pending
      approvedAt: fullAdmin ? new Date().toISOString() : undefined,
      approvedBy: fullAdmin ? currentUser.name : undefined,
      userId: selectedPayer.id,
      userName: selectedPayer.name,
      partName: selectedPayer.partName,
      notes: expNotes.trim(),
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
    };

    storageService.saveExpense(newExpense);

    // If auto-approved by admin/intendente, also record as expense cash flow transaction
    if (fullAdmin) {
      const outflow: CashFlowTransaction = {
        id: `cf-exp-${Date.now()}`,
        type: 'egreso',
        category: 'pago_proveedor',
        concept: `Gasto Aprobado: ${newExpense.concept}${newExpense.invoiceNumber ? ` (Factura N° ${newExpense.invoiceNumber})` : ''}`,
        amount: newExpense.amount,
        currency: 'ARS',
        date: newExpense.date,
        userId: selectedPayer.id,
        userName: selectedPayer.name,
        partName: selectedPayer.partName,
        expenseId: newExpense.id,
        notes: newExpense.notes,
        createdBy: `${currentUser.name} (Admin/Intendente)`,
        createdAt: new Date().toISOString(),
      };
      storageService.saveCashFlowTransaction(outflow);
    }

    setIsExpenseModalOpen(false);
    setExpConcept('');
    setExpAmount(0);
    setExpProvider('');
    setExpInvoiceNumber('');
    setExpPayerUserId('');
    setExpNotes('');
    alert(
      fullAdmin
        ? 'Gasto registrado y aprobado automáticamente en la caja del fideicomiso.'
        : 'Factura/Gasto enviado con éxito. Quedará sujeto a aprobación del Administrador o Intendente.'
    );
  };

  const handleApproveExpense = (exp: ExpenseItem) => {
    const updated: ExpenseItem = {
      ...exp,
      approvalStatus: 'approved',
      status: 'paid',
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser.name,
    };
    storageService.saveExpense(updated);

    // Register corresponding egreso in cash flow
    const outflow: CashFlowTransaction = {
      id: `cf-exp-${Date.now()}`,
      type: 'egreso',
      category: 'pago_proveedor',
      concept: `Pago Gasto Aprobado: ${exp.concept} (${exp.userName || 'Socio'})`,
      amount: exp.amount,
      currency: 'ARS',
      date: new Date().toISOString().split('T')[0],
      userId: exp.userId,
      userName: exp.userName,
      partName: exp.partName,
      expenseId: exp.id,
      notes: exp.notes,
      createdBy: `${currentUser.name} (Admin)`,
      createdAt: new Date().toISOString(),
    };
    storageService.saveCashFlowTransaction(outflow);
    alert('Gasto aprobado y registrado como egreso en caja.');
  };

  const handleRejectExpense = (exp: ExpenseItem) => {
    const reason = prompt('Indique el motivo del rechazo del gasto:');
    if (reason === null) return;
    const updated: ExpenseItem = {
      ...exp,
      approvalStatus: 'rejected',
      rejectionReason: reason || 'Rechazado por administración',
    };
    storageService.saveExpense(updated);
  };

  const handleExecuteReimbursement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reimburseModalUser || reimburseAmount <= 0) {
      alert('Monto de reintegro no válido.');
      return;
    }

    if (reimburseAmount > cajaBalance + 1) {
      alert('Advertencia: El monto a reintegrar supera el saldo disponible actual en caja.');
    }

    const tx: CashFlowTransaction = {
      id: `cf-reimb-${Date.now()}`,
      type: 'egreso',
      category: 'reintegro_gasto',
      concept: `Reintegro parcial/total de gastos a ${reimburseModalUser.userName}`,
      amount: Number(reimburseAmount),
      currency: 'ARS',
      date: new Date().toISOString().split('T')[0],
      userId: reimburseModalUser.userId,
      userName: reimburseModalUser.userName,
      notes: reimburseNotes.trim() || 'Devolución de dinero por adelanto de compras del copropietario',
      createdBy: `${currentUser.name} (Admin/Intendente)`,
      createdAt: new Date().toISOString(),
    };

    storageService.saveCashFlowTransaction(tx);
    setReimburseModalUser(null);
    setReimburseAmount(0);
    setReimburseNotes('');
    alert(`Reintegro de $${reimburseAmount.toLocaleString()} registrado correctamente. Se descontó de la caja común.`);
  };

  const filteredCashFlows = visibleCashFlows.filter((t) => {
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesSearch =
      t.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.userName && t.userName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.partName && t.partName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#7A8E7E] pb-1">
            <span className="font-serif font-bold text-[#163323]">Fideicomiso El Desayuno</span>
            <span>·</span>
            <span>{fullAdmin ? 'Gestión de Caja, Ingresos y Cuentas Corrientes' : 'Mi Cuenta, Ingresos y Reintegros'}</span>
          </div>
          <h2
            className="text-xl sm:text-2xl font-serif font-bold text-[#163323] tracking-wide flex items-center gap-2.5"
            style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
          >
            <Wallet className="w-6 h-6 text-[#BFA270]" />
            <span>{fullAdmin ? 'Caja Común, Ingresos, Egresos y Reintegros' : 'Mi Estado de Cuenta y Movimientos de Caja'}</span>
          </h2>
          <p className="text-xs text-[#526657] mt-1 max-w-3xl leading-relaxed">
            {fullAdmin
              ? 'Control de caja en tiempo real, cuentas corrientes individuales por copropietario, carga de facturas sujetas a aprobación y devoluciones escalonadas de adelantos.'
              : 'Consultá tus aportes e ingresos registrados, los gastos que adelantaste de tu bolsillo y el estado de reintegros de tu cuenta corriente.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canUpload && (
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="px-4 py-2.5 bg-[#FAF8F5] hover:bg-[#F2EDE1] border border-[#DDD5BF] text-[#163323] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
              title="Subir factura o gasto adelantado para aprobación del administrador"
            >
              <Receipt className="w-4 h-4 text-[#8C7A53]" />
              <span>+ Subir Factura / Gasto</span>
            </button>
          )}

          {fullAdmin && (
            <button
              onClick={() => setIsTransactionModalOpen(true)}
              className="px-4 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-2xs"
            >
              <Plus className="w-4 h-4 text-[#BFA270]" />
              <span>+ Registrar Movimiento de Caja</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {fullAdmin ? (
          <>
            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 border-l-[#1B3B2B]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Saldo Disponible en Caja
              </span>
              <div className="text-2xl font-bold font-mono text-[#163323] mt-1">
                ${cajaBalance.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-[#526657] mt-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>Ingresos totales menos egresos ejecutados</span>
              </p>
            </div>

            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 border-l-emerald-700">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Total Ingresos Comunes
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-800 mt-1">
                ${totalIngresos.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-[#526657] mt-1">
                Aportes de socios y fondos de reserva
              </p>
            </div>

            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 border-l-amber-700">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Total Egresos & Proveedores
              </span>
              <div className="text-2xl font-bold font-mono text-amber-900 mt-1">
                ${totalEgresos.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-[#526657] mt-1">
                Gastos operativos, servicios y reintegros
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 border-l-[#1B3B2B]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Mi Saldo a Favor (Adelantos)
              </span>
              <div className="text-2xl font-bold font-mono text-[#163323] mt-1">
                ${myAccount.balanceDue.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-[#526657] mt-1 flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${myAccount.balanceDue > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-600'}`} />
                <span>{myAccount.balanceDue > 0 ? 'Monto a reintegrar por la administración' : 'Cuenta al día (sin saldo adeudado)'}</span>
              </p>
            </div>

            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 border-l-emerald-700">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Mis Ingresos / Aportes Registrados
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-800 mt-1">
                ${myIngresos.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-[#526657] mt-1">
                Aportes y pagos registrados a tu nombre
              </p>
            </div>

            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 border-l-amber-700">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Mis Reintegros / Devoluciones Cobradas
              </span>
              <div className="text-2xl font-bold font-mono text-amber-900 mt-1">
                ${myEgresos.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-[#526657] mt-1">
                Reintegros cobrados por gastos adelantados
              </p>
            </div>
          </>
        )}
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex border-b border-[#E3DFC8] bg-white px-4 pt-2 gap-6">
        <button
          onClick={() => setActiveTabSub('caja')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTabSub === 'caja'
              ? 'border-[#1B3B2B] text-[#163323]'
              : 'border-transparent text-[#7A8E7E] hover:text-[#163323]'
          }`}
        >
          <Coins className="w-4 h-4 text-[#BFA270]" />
          <span>{fullAdmin ? `Libro Diario de Caja (${cashFlows.length})` : `Mis Movimientos de Caja (${visibleCashFlows.length})`}</span>
        </button>

        <button
          onClick={() => setActiveTabSub('cuentas')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTabSub === 'cuentas'
              ? 'border-[#1B3B2B] text-[#163323]'
              : 'border-transparent text-[#7A8E7E] hover:text-[#163323]'
          }`}
        >
          <Wallet className="w-4 h-4 text-[#BFA270]" />
          <span>{fullAdmin ? 'Cuentas Corrientes & Reintegros Escalonados' : `Mi Cuenta Corriente (${currentUser.partName || 'Mi Parte'})`}</span>
        </button>

        {fullAdmin && (
          <button
            onClick={() => setActiveTabSub('gastos_pendientes')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2 relative ${
              activeTabSub === 'gastos_pendientes'
                ? 'border-[#1B3B2B] text-[#163323]'
                : 'border-transparent text-[#7A8E7E] hover:text-[#163323]'
            }`}
          >
            <Receipt className="w-4 h-4 text-[#BFA270]" />
            <span>Facturas Pendientes de Aprobación</span>
            {pendingExpenses.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-600 text-white font-mono text-[9px] font-bold flex items-center justify-center">
                {pendingExpenses.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* 1. LIBRO DIARIO DE CAJA                                   */}
      {/* ========================================================= */}
      {activeTabSub === 'caja' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#E3DFC8] p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#8C7A53] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por concepto o socio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-medium focus:outline-none focus:border-[#163323]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-[#637568] font-semibold flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-[#BFA270]" />
                <span>Tipo:</span>
              </span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-semibold text-[#163323] focus:outline-none cursor-pointer"
              >
                <option value="all">Todos los Movimientos</option>
                <option value="ingreso">Solo Ingresos (Entradas)</option>
                <option value="egreso">Solo Egresos (Salidas)</option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-[#E3DFC8] shadow-xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8F5EE] border-b border-[#E3DFC8] text-[#55695B] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3">Categoría</th>
                  <th className="py-3 px-4">Concepto / Detalle</th>
                  <th className="py-3 px-3">Socio / Parte</th>
                  <th className="py-3 px-4 text-right">Monto (ARS)</th>
                  {fullAdmin && <th className="py-3 px-3 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0]">
                {filteredCashFlows.length === 0 ? (
                  <tr>
                    <td colSpan={fullAdmin ? 7 : 6} className="py-12 text-center text-xs text-[#7A8E7E]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Coins className="w-8 h-8 text-[#DDD5BF]" />
                        <span className="font-semibold text-sm text-[#163323]">
                          {fullAdmin
                            ? 'No se encontraron movimientos de caja con los filtros seleccionados.'
                            : 'No tenés movimientos de ingresos ni egresos registrados a tu nombre aún.'}
                        </span>
                        <p className="text-[11px] text-[#7A8E7E] max-w-md">
                          {fullAdmin
                            ? 'Podés registrar nuevos movimientos de caja con el botón superior.'
                            : 'Tus aportes de expensas, fondos y reintegros cobrados se listarán en esta sección una vez asentados por la administración.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCashFlows.map((tx) => {
                    const isIngreso = tx.type === 'ingreso';
                    return (
                      <tr key={tx.id} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="py-3.5 px-4 font-mono text-[#637568]">{tx.date}</td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-2xs ${
                              isIngreso
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {isIngreso ? <TrendingUp className="w-3 h-3 text-emerald-700" /> : <TrendingDown className="w-3 h-3 text-amber-700" />}
                            <span>{tx.type}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-medium uppercase text-[10px] text-[#526657]">
                          {tx.category.replace('_', ' ')}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-[#163323]">
                          <span>{tx.concept}</span>
                          {tx.notes && <span className="block text-[11px] text-[#7A8E7E] font-normal">{tx.notes}</span>}
                        </td>
                        <td className="py-3.5 px-3">
                          {tx.userName ? (
                            <span className="font-medium text-[#163323]">{tx.userName} ({tx.partName})</span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className={`py-3.5 px-4 text-right font-mono font-bold text-sm ${isIngreso ? 'text-emerald-700' : 'text-amber-900'}`}>
                          {isIngreso ? '+' : '-'}${tx.amount.toLocaleString()}
                        </td>
                        {fullAdmin && (
                          <td className="py-3.5 px-3 text-right">
                            <button
                              onClick={() => {
                                if (confirm('¿Eliminar este movimiento de caja?')) {
                                  storageService.deleteCashFlowTransaction(tx.id);
                                }
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded-2xs transition-colors cursor-pointer"
                              title="Eliminar movimiento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. CUENTAS CORRIENTES & REINTEGROS ESCALONADOS            */}
      {/* ========================================================= */}
      {activeTabSub === 'cuentas' && (
        <div className="space-y-4">
          <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-4.5 space-y-2">
            <h3 className="text-sm font-bold text-[#163323] flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#BFA270]" />
              <span>{fullAdmin ? 'Cuenta Corriente & Devoluciones Escalonadas de Adelantos' : `Mi Cuenta Corriente (${currentUser.partName || 'Mi Parte'})`}</span>
            </h3>
            <p className="text-xs text-[#526657] leading-relaxed">
              {fullAdmin
                ? 'Cada perfil acumula los gastos que pagó de su bolsillo por cuenta del fideicomiso. Si la división de expensas o la caja no permite devolver todo junto, el Administrador o Intendente puede realizar reintegros parciales escalonados, descontándose de la caja común de forma transparente.'
                : 'Acá podés consultar los gastos que adelantaste de tu bolsillo por cuenta del fideicomiso, los reintegros que ya te fueron transferidos y el saldo pendiente de devolución por parte de la administración.'}
            </p>
          </div>

          <div className={`grid grid-cols-1 ${fullAdmin ? 'md:grid-cols-2' : 'max-w-2xl'} gap-4`}>
            {visibleAccountBalances.map((acc) => {
              const hasBalance = acc.balanceDue > 0;
              return (
                <div key={acc.userId} className="bg-white border border-[#E3DFC8] p-5 shadow-xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE0]">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-8 h-8 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs"
                          style={{ backgroundColor: acc.userColor }}
                        >
                          {acc.userName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-[#163323]">{acc.userName}</h4>
                          <span className="text-[11px] text-[#7A8E7E]">{acc.partName}</span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-2xs ${
                          hasBalance
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {hasBalance ? 'Saldo a Favor del Socio' : 'Cuenta Al Día'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 bg-[#FAF8F5] border border-[#E8E2D2]">
                        <span className="text-[10px] text-[#7A8E7E] block uppercase">Gastos Adelantados</span>
                        <span className="font-mono font-bold text-[#163323] text-sm">${acc.totalAdvanced.toLocaleString()}</span>
                      </div>
                      <div className="p-2.5 bg-[#FAF8F5] border border-[#E8E2D2]">
                        <span className="text-[10px] text-[#7A8E7E] block uppercase">Reintegrado</span>
                        <span className="font-mono font-bold text-emerald-800 text-sm">${acc.totalReimbursed.toLocaleString()}</span>
                      </div>
                      <div className="p-2.5 bg-[#FAF8F5] border border-[#E8E2D2]">
                        <span className="text-[10px] text-[#7A8E7E] block uppercase">Saldo Adeudado</span>
                        <span className={`font-mono font-bold text-sm ${hasBalance ? 'text-amber-900' : 'text-[#163323]'}`}>
                          ${acc.balanceDue.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {fullAdmin && hasBalance && (
                    <div className="pt-3 border-t border-[#EFEAE0] flex items-center justify-between">
                      <span className="text-[11px] text-[#637568]">
                        Devolución parcial o total desde caja:
                      </span>
                      <button
                        onClick={() => {
                          setReimburseModalUser({
                            userId: acc.userId,
                            userName: acc.userName,
                            balanceDue: acc.balanceDue,
                          });
                          setReimburseAmount(acc.balanceDue);
                        }}
                        className="px-3 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <span>Realizar Reintegro</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#BFA270]" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. GASTOS PENDIENTES DE APROBACIÓN                        */}
      {/* ========================================================= */}
      {activeTabSub === 'gastos_pendientes' && fullAdmin && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-300 p-4 text-xs text-amber-950 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Bandeja de Aprobación de Facturas y Gastos</strong>
              <span>Los copropietarios y cabezas de equipo pueden subir comprobantes de compras realizadas para la estancia. Una vez aprobados por usted, se registran automáticamente como egresos en la caja.</span>
            </div>
          </div>

          <div className="bg-white border border-[#E3DFC8] shadow-xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8F5EE] border-b border-[#E3DFC8] text-[#55695B] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Fecha / Socio</th>
                  <th className="py-3 px-3">Categoría</th>
                  <th className="py-3 px-4">Concepto y Proveedor</th>
                  <th className="py-3 px-3 text-right">Monto</th>
                  <th className="py-3 px-4 text-right">Acciones de Aprobación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0]">
                {pendingExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-[#163323] block">{exp.userName || exp.createdBy}</span>
                      <span className="text-[10px] text-[#7A8E7E] font-mono">{exp.date}</span>
                    </td>
                    <td className="py-3.5 px-3 uppercase text-[10px] font-bold text-[#526657]">
                      {exp.category}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#163323]">
                      <span>{exp.concept}</span>
                      {exp.provider && <span className="block text-[11px] text-[#7A8E7E]">Proveedor: {exp.provider}</span>}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-sm text-[#163323]">
                      ${exp.amount.toLocaleString()} {exp.currency}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApproveExpense(exp)}
                          className="px-3 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Aprobar</span>
                        </button>
                        <button
                          onClick={() => handleRejectExpense(exp)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5 text-red-700" />
                          <span>Rechazar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pendingExpenses.length === 0 && (
              <div className="p-8 text-center text-xs text-[#7A8E7E]">
                No hay facturas o gastos pendientes de aprobación en este momento.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: REGISTRAR MOVIMIENTO DE CAJA                     */}
      {/* ========================================================= */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DCD4C0] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold tracking-wide" style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}>
                Registrar Movimiento de Caja Común
              </h3>
              <button onClick={() => setIsTransactionModalOpen(false)} className="text-[#C9D6CC] hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Tipo de Movimiento *</label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as CashFlowType)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-xs focus:outline-none"
                  >
                    <option value="ingreso">Ingreso de Dinero (Entrada)</option>
                    <option value="egreso">Egreso de Dinero (Salida)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Categoría *</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value as CashFlowCategory)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-xs focus:outline-none uppercase"
                  >
                    <option value="aporte_socio">Aporte de Socio</option>
                    <option value="pago_expensas">Pago de Expensas</option>
                    <option value="pago_proveedor">Pago a Proveedor / Servicio</option>
                    <option value="reintegro_gasto">Reintegro de Gasto a Socio</option>
                    <option value="fondo_reserva">Fondo de Reserva</option>
                    <option value="otro_ingreso">Otro Ingreso</option>
                    <option value="otro_egreso">Otro Egreso</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Concepto o Detalle *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Cobro cuota extraordinaria o pago servicio"
                  value={txConcept}
                  onChange={(e) => setTxConcept(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Monto (ARS) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={txAmount || ''}
                    onChange={(e) => {
                      const valStr = e.target.value.replace(',', '.');
                      setTxAmount(parseFloat(valStr) || 0);
                    }}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-bold text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Vincular a Copropietario (Opcional)</label>
                <select
                  value={txLinkedUserId}
                  onChange={(e) => setTxLinkedUserId(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-xs focus:outline-none"
                >
                  <option value="">-- Sin socio vinculado --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.partName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Observaciones / Notas</label>
                <textarea
                  rows={2}
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder="Número de transferencia, comprobante, etc..."
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[#EFEAE0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#637568] hover:text-[#163323] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  <Check className="w-4 h-4 text-[#BFA270]" />
                  <span>Registrar en Caja</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: SUBIR FACTURA / GASTO                            */}
      {/* ========================================================= */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DCD4C0] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold tracking-wide" style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}>
                Subir Factura o Comprobante de Gasto
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-[#C9D6CC] hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpenseSubmission} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-snug">
                💡 <strong>Aviso:</strong> Como {currentUser.partName}, al subir este gasto quedará registrado en su cuenta corriente a favor y sujeto a aprobación del Administrador o Intendente.
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Concepto del Gasto *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Compra de materiales ferretería o arreglo bomba"
                  value={expConcept}
                  onChange={(e) => setExpConcept(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Categoría *</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-xs focus:outline-none uppercase"
                  >
                    <option value="servicios">Servicios (Luz, Gas, etc.)</option>
                    <option value="personal_casero">Personal / Casero</option>
                    <option value="mantenimiento">Mantenimiento & Reparación</option>
                    <option value="impuestos">Impuestos & Tasas</option>
                    <option value="insumos">Insumos & Limpieza</option>
                    <option value="otro">Otro Gasto</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Monto (ARS) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={expAmount || ''}
                    onChange={(e) => {
                      const valStr = e.target.value.replace(',', '.');
                      setExpAmount(parseFloat(valStr) || 0);
                    }}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-bold text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#FAF8F5] p-2.5 border border-[#DCD4C0]">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">👤 ¿Quién realizó / pagó el gasto?</label>
                  {fullAdmin ? (
                    <select
                      value={expPayerUserId}
                      onChange={(e) => setExpPayerUserId(e.target.value)}
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-semibold text-xs focus:outline-none"
                    >
                      <option value="">{currentUser.name} ({currentUser.partName}) [Tú]</option>
                      {users.filter((u) => u.id !== currentUser.id).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.partName})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full p-2 bg-white border border-[#DCD4C0] font-semibold text-xs text-[#163323] truncate">
                      {currentUser.name} ({currentUser.partName})
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">🧾 N° Factura / Comprobante</label>
                  <input
                    type="text"
                    placeholder="ej. 0001-0004812"
                    value={expInvoiceNumber}
                    onChange={(e) => setExpInvoiceNumber(e.target.value)}
                    className="w-full p-2 bg-white border border-[#DCD4C0] font-mono font-bold text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Proveedor / Comercio</label>
                  <input
                    type="text"
                    placeholder="ej. Ferretería El Centro"
                    value={expProvider}
                    onChange={(e) => setExpProvider(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Fecha del Comprobante *</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Notas / Detalles Adicionales</label>
                <textarea
                  rows={2}
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  placeholder="Detalle el motivo de la compra o adjunte aclaración..."
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[#EFEAE0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#637568] hover:text-[#163323] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  <Check className="w-4 h-4 text-[#BFA270]" />
                  <span>Enviar Comprobante</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: EJECUTAR REINTEGRO PARCIAL O TOTAL               */}
      {/* ========================================================= */}
      {reimburseModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-md border border-[#DCD4C0] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold tracking-wide" style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}>
                Reintegro de Adelanto a {reimburseModalUser.userName}
              </h3>
              <button onClick={() => setReimburseModalUser(null)} className="text-[#C9D6CC] hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteReimbursement} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-[#FAF8F5] border border-[#E3DFC8] space-y-1">
                <span className="text-[10px] text-[#7A8E7E] uppercase block font-bold">Saldo Adeudado Actual:</span>
                <span className="font-mono font-bold text-base text-amber-900">${reimburseModalUser.balanceDue.toLocaleString()} ARS</span>
                <p className="text-[11px] text-[#526657] mt-1">
                  Puede realizar una devolución parcial (ej. $10,000 o más) y el sistema irá descontando de la cuenta del copropietario y registrando el egreso en caja.
                </p>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Monto a Devolver / Reintegrar (ARS) *</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max={reimburseModalUser.balanceDue}
                  required
                  value={reimburseAmount || ''}
                  onChange={(e) => {
                    const valStr = e.target.value.replace(',', '.');
                    setReimburseAmount(parseFloat(valStr) || 0);
                  }}
                  className="w-full p-2.5 bg-white border border-[#DCD4C0] font-mono font-bold text-sm text-[#163323] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Motivo / Notas del Reintegro</label>
                <input
                  type="text"
                  value={reimburseNotes}
                  onChange={(e) => setReimburseNotes(e.target.value)}
                  placeholder="ej. Transferencia parcial cuenta bancaria"
                  className="w-full p-2.5 bg-white border border-[#DCD4C0] font-semibold focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[#EFEAE0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReimburseModalUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#637568] hover:text-[#163323] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  <Check className="w-4 h-4 text-[#BFA270]" />
                  <span>Confirmar Reintegro</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
