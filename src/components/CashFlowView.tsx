import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  User,
  CashFlowTransaction,
  CashFlowType,
  CashFlowCategory,
  ExpenseItem,
  ExpenseCategory,
  TrustSettings,
  FeeCollection,
  OwnerFeeAllocation,
  isUserAdmin,
  isUserIntendente,
  isUserFiduciante,
  hasFinancialAccess,
  canViewGeneralFinancialAccount,
  canUploadExpenses,
} from '../types';
import { storageService } from '../services/storageService';
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
  Zap,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CashFlowViewProps {
  currentUser: User;
  settings: TrustSettings;
  isAdmin?: boolean;
  canViewGeneral?: boolean;
  onNavigateToCobranzas?: () => void;
}

export const CashFlowView: React.FC<CashFlowViewProps> = ({
  currentUser,
  settings,
  isAdmin,
  canViewGeneral: canViewGeneralProp,
  onNavigateToCobranzas,
}) => {
  const [cashFlows, setCashFlows] = useState<CashFlowTransaction[]>(() => storageService.getCashFlows());
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => storageService.getExpenses());
  const [users, setUsers] = useState<User[]>(() => storageService.getUsers());
  const [feeCollections, setFeeCollections] = useState<FeeCollection[]>(() => storageService.getFeeCollections());
  const syncInProgress = useRef(false);

  // Permissions
  const fullAdmin = isAdmin !== undefined ? isAdmin : hasFinancialAccess(currentUser);
  const canViewGeneral = canViewGeneralProp !== undefined
    ? canViewGeneralProp
    : canViewGeneralFinancialAccount(currentUser);
  // Las operaciones personales solo se habilitan dentro de una sesión de
  // copropietario. Un administrador ve y administra el conjunto, no su cuenta.
  const canUsePersonalAccount = !fullAdmin;
  const canUpload = canUploadExpenses(currentUser);

  // Sub-tabs: if user cannot view general, force to 'mi_cuenta'
  const [activeTabSub, setActiveTabSub] = useState<'caja' | 'cuentas_socios' | 'mi_cuenta' | 'gastos_pendientes'>(
    canViewGeneral ? 'caja' : 'mi_cuenta'
  );
  const [typeFilter, setTypeFilter] = useState<'all' | 'ingreso' | 'egreso'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isExecutingDebit, setIsExecutingDebit] = useState(false);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  const toggleExpandTx = (txId: string) => {
    setExpandedTxId((prev) => (prev === txId ? null : txId));
  };

  // Modals
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [txType, setTxType] = useState<CashFlowType>('ingreso');
  const [txCategory, setTxCategory] = useState<CashFlowCategory>('otro_ingreso');
  const [txConcept, setTxConcept] = useState('');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [txLinkedUserId, setTxLinkedUserId] = useState<string>('');
  const [txNotes, setTxNotes] = useState('');

  // Una factura puede abonarse en uno o varios pagos desde Caja.
  const [isInvoicePaymentModalOpen, setIsInvoicePaymentModalOpen] = useState(false);
  const [invoicePaymentAmounts, setInvoicePaymentAmounts] = useState<Record<string, number>>({});
  const [invoicePaymentDate, setInvoicePaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [invoicePaymentNotes, setInvoicePaymentNotes] = useState('');
  const [incomeForExpensePayment, setIncomeForExpensePayment] = useState<CashFlowTransaction | null>(null);
  const [incomeForAllocation, setIncomeForAllocation] = useState<CashFlowTransaction | null>(null);
  const [incomeAllocationMode, setIncomeAllocationMode] = useState<'general' | 'all' | 'one' | 'expenses'>('general');
  const [incomeAllocationUserId, setIncomeAllocationUserId] = useState('');
  const [incomeExpenseEntryMode, setIncomeExpenseEntryMode] = useState<'percentage' | 'amount'>('amount');
  const [incomeExpensePercentages, setIncomeExpensePercentages] = useState<Record<string, number>>({});
  const [incomeRemainderMode, setIncomeRemainderMode] = useState<'general' | 'all' | 'one'>('general');
  const [incomeRemainderUserId, setIncomeRemainderUserId] = useState('');
  const [isSavingIncomeAllocation, setIsSavingIncomeAllocation] = useState(false);
  const [isConfirmingPayments, setIsConfirmingPayments] = useState(false);
  const incomeAllocationInProgress = useRef(false);
  const paymentConfirmationInProgress = useRef(false);
  const [pendingRemainderAllocation, setPendingRemainderAllocation] = useState<{
    income: CashFlowTransaction;
    amount: number;
    mode: 'general' | 'all' | 'one';
    userId: string;
  } | null>(null);

  // Expense Submission Modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expConcept, setExpConcept] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('servicios');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expDate, setExpDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expProvider, setExpProvider] = useState('');
  const [expInvoiceNumber, setExpInvoiceNumber] = useState('');
  const [expPayerUserId, setExpPayerUserId] = useState('');
  const [expNotes, setExpNotes] = useState('');

  // Reimbursement Modal
  const [reimburseModalUser, setReimburseModalUser] = useState<{ userId: string; userName: string; balanceDue: number } | null>(null);
  const [reimburseAmount, setReimburseAmount] = useState<number>(0);
  const [reimburseNotes, setReimburseNotes] = useState('');

  // Auto-debit local toggle state for currentUser
  const [autoDebitEnabled, setAutoDebitEnabled] = useState<boolean>(
    storageService.isAutoDebitEnabled(currentUser.id)
  );

  const syncData = async () => {
    // La vista es de lectura. Antes, cada apertura volvía a guardar los gastos
    // aprobados y disparaba notificaciones que iniciaban nuevas sincronizaciones
    // en cadena, dejando la Caja momentáneamente vacía.
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    try {
      let [freshCF, freshExp, freshFees] = await Promise.all([
        storageService.fetchCashFlowFromDatabase(),
        storageService.fetchExpensesFromDatabase(),
        storageService.fetchFeesFromDatabase(),
      ]);
      // Limpia los asientos que versiones anteriores dejaron al borrar el
      // movimiento padre. Se hace contra la base y sólo si hay inconsistencias.
      if (await storageService.reconcileCashFlowDependencies()) {
        [freshCF, freshExp, freshFees] = await Promise.all([
          storageService.fetchCashFlowFromDatabase(),
          storageService.fetchExpensesFromDatabase(),
          storageService.fetchFeesFromDatabase(),
        ]);
      }
      if (Array.isArray(freshCF)) setCashFlows(freshCF);
      if (Array.isArray(freshExp)) setExpenses(freshExp);
      if (Array.isArray(freshFees)) setFeeCollections(freshFees);
      setUsers(storageService.getUsers());
      setAutoDebitEnabled(storageService.isAutoDebitEnabled(currentUser.id));
    } finally {
      syncInProgress.current = false;
    }
  };

  useEffect(() => {
    syncData();
    const unsub = storageService.subscribe(syncData);
    return () => unsub();
  }, [currentUser.id]);

  // Ensure tab matches permission if switched
  useEffect(() => {
    if (canViewGeneral && !canUsePersonalAccount && activeTabSub === 'mi_cuenta') {
      setActiveTabSub('caja');
    } else if (!canViewGeneral && activeTabSub !== 'mi_cuenta') {
      setActiveTabSub('mi_cuenta');
    }
  }, [canViewGeneral, canUsePersonalAccount, activeTabSub]);

  // Caja se calcula exclusivamente desde los movimientos confirmados en la
  // base. Registrar una factura no mueve efectivo por sí solo.
  const effectiveCashFlows = useMemo(() => {
    // Los movimientos "ledger-" representan saldo entre el proyecto y un socio,
    // no dinero que haya ingresado o salido físicamente de Caja/Banco.
    return cashFlows
      .filter((transaction) => !transaction.id.startsWith('ledger-'))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [cashFlows]);

  // Helper: Share Percentage of an owner
  const getOwnerSharePct = (u: User): number => {
    if (typeof u.sharePercentage === 'number' && u.sharePercentage > 0) {
      return u.sharePercentage;
    }
    return 6.25; // 100% / 16 copropietarios
  };

  // Global cash totals (for General Account)
  const totalIngresosGeneral = effectiveCashFlows
    .filter((t) => t.type === 'ingreso')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalEgresosGeneral = effectiveCashFlows
    .filter((t) => t.type === 'egreso')
    .reduce((sum, t) => sum + t.amount, 0);

  const cajaBalanceGeneral = totalIngresosGeneral - totalEgresosGeneral;

  // Compromisos pendientes por compras pagadas personalmente por un
  // copropietario. Son gastos reales, aunque el efectivo no haya salido de
  // Caja/Banco todavía.
  const totalAdelantosPendientes = useMemo(() => {
    const advancesByOwner = new Map<string, number>();
    const reimbursedByOwner = new Map<string, number>();
    const autoDebitedByOwner = new Map<string, number>();

    cashFlows
      .filter((transaction) => transaction.id.startsWith('ledger-advance-') && transaction.userId)
      .forEach((transaction) => {
        const userId = transaction.userId!;
        advancesByOwner.set(userId, (advancesByOwner.get(userId) || 0) + (Number(transaction.amount) || 0));
      });
    cashFlows
      .filter((transaction) => transaction.category === 'reintegro_gasto' && transaction.userId)
      .forEach((transaction) => {
        const userId = transaction.userId!;
        reimbursedByOwner.set(userId, (reimbursedByOwner.get(userId) || 0) + (Number(transaction.amount) || 0));
      });
    feeCollections.flatMap((collection) => collection.allocations || [])
      .filter((allocation) => allocation.paymentMethod === 'auto_debit' && allocation.userId)
      .forEach((allocation) => {
        autoDebitedByOwner.set(
          allocation.userId,
          (autoDebitedByOwner.get(allocation.userId) || 0) + (Number(allocation.paidAmount) || 0)
        );
      });

    return Array.from(advancesByOwner.entries()).reduce((total, [userId, advanced]) => {
      const pending = advanced - (reimbursedByOwner.get(userId) || 0) - (autoDebitedByOwner.get(userId) || 0);
      return total + Math.max(0, pending);
    }, 0);
  }, [cashFlows, feeCollections]);

  const saldoNetoComprometido = cajaBalanceGeneral - totalAdelantosPendientes;

  // Compute particular account details for all eligible owners
  const activeOwners = users.filter((u) => u.active !== false && u.role !== 'intendente');
  const incomeDistributionBySource = useMemo(() => {
    const distributions = new Map<string, CashFlowTransaction[]>();
    cashFlows
      .filter((transaction) => transaction.id.startsWith('ledger-income-share-'))
      .forEach((transaction) => {
        const parts = transaction.id.slice('ledger-income-share-'.length).split('--');
        const sourceId = parts[0];
        if (sourceId) distributions.set(sourceId, [...(distributions.get(sourceId) || []), transaction]);
      });
    return distributions;
  }, [cashFlows]);
  const paidFromCajaByExpense = useMemo(() => {
    const totals = new Map<string, number>();
    cashFlows
      .filter((transaction) =>
        !transaction.id.startsWith('ledger-') &&
        transaction.type === 'egreso' &&
        Boolean(transaction.expenseId)
      )
      .forEach((transaction) => {
        const expenseId = transaction.expenseId!;
        totals.set(expenseId, (totals.get(expenseId) || 0) + (Number(transaction.amount) || 0));
      });
    return totals;
  }, [cashFlows]);

  // Incluye tanto facturas pendientes de Caja/Banco como compras adelantadas
  // por socios. Estas últimas se muestran para reintegrar al socio que pagó,
  // no para volver a pagar al proveedor.
  const payableInvoices = useMemo(() => expenses
    .filter((expense) =>
      expense.approvalStatus !== 'rejected' &&
      (expense.approvalStatus === 'approved' || expense.status === 'pending' || !expense.approvalStatus)
    )
    .map((expense) => {
      const isOwnerAdvance = storageService.isOwnerAdvanceExpense(expense);
      const paidAmount = isOwnerAdvance
        ? (Number(expense.reimbursedAmount) || 0)
        : (paidFromCajaByExpense.get(expense.id) || 0);
      return {
        expense,
        isOwnerAdvance,
        paidAmount,
        pendingAmount: Math.max(0, Math.round((Number(expense.amount) - paidAmount) * 100) / 100),
      };
    })
    .filter((item) => item.pendingAmount > 0.01), [expenses, paidFromCajaByExpense]);
  const targetOwners = canViewGeneral
    ? activeOwners
    : activeOwners.filter(
        (u) =>
          u.id === currentUser.id ||
          (currentUser.name && u.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      );
  const finalOwners = targetOwners.length === 0 ? [currentUser] : targetOwners;

  const accountsSummary = finalOwners.map((u) => {
    const sharePct = getOwnerSharePct(u);

    // 1. Sólo los ingresos que Administración decidió distribuir se acreditan
    // en la cuenta particular. Los ingresos generales siguen en Caja.
    const distributedIncome = cashFlows
      .filter((t) => t.id.startsWith('ledger-income-share-') && t.userId === u.id)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // 2. Direct personal incomes
    const directIncomes = cashFlows.filter(
      (t) =>
        t.type === 'ingreso' &&
        // Los adelantos se muestran por separado y no son ingresos cobrados:
        // representan una deuda del fideicomiso con el copropietario.
        !t.id.startsWith('ledger-') &&
        Boolean(t.userId && (t.userId === u.id || (t.userName && t.userName.toLowerCase() === u.name.toLowerCase())))
    );
    const totalDirectIncome = directIncomes.reduce((sum, t) => sum + t.amount, 0);
    const totalUserIncome = distributedIncome + totalDirectIncome;

    // 3. Solo los adelantos explícitos cuentan como saldo a favor. Un gasto
    // pagado desde Caja/Banco nunca se acredita a la cuenta de un socio.
    const totalAdvanced = cashFlows
      .filter((t) => t.id.startsWith('ledger-advance-') && t.userId === u.id)
      .reduce((sum, t) => sum + t.amount, 0);

    // 4. Reimbursements received from cash flow
    const reimbursements = cashFlows.filter(
      (t) =>
        (t.userId === u.id || (t.userName && t.userName.toLowerCase() === u.name.toLowerCase())) &&
        t.category === 'reintegro_gasto'
    );
    const totalReimbursed = reimbursements.reduce((sum, t) => sum + t.amount, 0);

    // 5. Monthly fees paid via automatic debit
    const autoDebitedAllocations = feeCollections.flatMap((fc) =>
      (fc.allocations || [])
        .filter((a) => a.userId === u.id && a.paymentMethod === 'auto_debit' && (a.paidAmount || 0) > 0)
        .map((a) => ({ collection: fc, allocation: a }))
    );
    const totalAutoDebited = autoDebitedAllocations.reduce(
      (sum, item) => sum + (item.allocation.paidAmount || 0),
      0
    );

    // Parte proporcional de las facturas que Caja ya pagó. Es un asiento de
    // cuenta corriente, no una segunda salida de efectivo.
    const totalInvoicePayments = cashFlows
      .filter((t) => t.id.startsWith('ledger-expense-share-') && t.userId === u.id)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // 6. Net available balance in owner's particular account
    // (+) Incomes credited + (+) Expenses advanced - (-) Reimbursements - (-) Auto debits applied
    const totalCredited = totalUserIncome + totalAdvanced;
    const totalDeductions = totalReimbursed + totalAutoDebited + totalInvoicePayments;
    const netAvailableBalance = Math.max(0, totalCredited - totalDeductions);

    // 7. Pending monthly fee debts
    const pendingAllocations = feeCollections.flatMap((fc) =>
      (fc.allocations || [])
        .filter(
          (a) =>
            a.userId === u.id &&
            a.status !== 'paid' &&
            a.assignedAmount - (a.paidAmount || 0) > 0
        )
        .map((a) => ({
          collection: fc,
          allocation: a,
          pendingAmount: a.assignedAmount - (a.paidAmount || 0),
        }))
    );
    const totalPendingDebt = pendingAllocations.reduce((sum, item) => sum + item.pendingAmount, 0);

    const pendingExpensesCount = expenses.filter(
      (e) =>
        (e.userId === u.id || (e.userName && e.userName.toLowerCase() === u.name.toLowerCase())) &&
        e.approvalStatus === 'pending'
    ).length;

    const isAutoDebitOn = storageService.isAutoDebitEnabled(u.id);

    return {
      userId: u.id,
      userName: u.name,
      partName: u.partName,
      userColor: u.color,
      sharePct,
      distributedIncome,
      totalDirectIncome,
      totalUserIncome,
      totalAdvanced,
      totalReimbursed,
      totalAutoDebited,
      totalInvoicePayments,
      netAvailableBalance,
      totalPendingDebt,
      pendingAllocations,
      autoDebitedAllocations,
      pendingExpensesCount,
      isAutoDebitOn,
    };
  });

  // Current user's particular account summary
  const myAccount =
    accountsSummary.find((acc) => acc.userId === currentUser.id) ||
    accountsSummary[0] || {
      userId: currentUser.id,
      userName: currentUser.name,
      partName: currentUser.partName,
      userColor: currentUser.color || '#1B3B2B',
      sharePct: getOwnerSharePct(currentUser),
      distributedIncome: 0,
      totalDirectIncome: 0,
      totalUserIncome: 0,
      totalAdvanced: 0,
      totalReimbursed: 0,
      totalAutoDebited: 0,
      totalInvoicePayments: 0,
      netAvailableBalance: 0,
      totalPendingDebt: 0,
      pendingAllocations: [],
      autoDebitedAllocations: [],
      pendingExpensesCount: 0,
      isAutoDebitOn: true,
    };

  // Toggle Auto Debit
  const handleToggleAutoDebit = (userId: string) => {
    if (!canUsePersonalAccount || userId !== currentUser.id) return;
    const current = storageService.isAutoDebitEnabled(userId);
    const nextVal = !current;
    storageService.setAutoDebitEnabled(userId, nextVal);
    if (userId === currentUser.id) {
      setAutoDebitEnabled(nextVal);
    }
    syncData();
  };

  // Execute Auto Debit Manually for an owner
  const handleExecuteAutoDebitNow = async (userId: string, availableBalance: number) => {
    if (!canUsePersonalAccount || userId !== currentUser.id) return;
    setIsExecutingDebit(true);
    try {
      const res = await storageService.executeAutoDebitForUser(userId, availableBalance);
      if (res.debitedTotal > 0) {
        alert(
          `¡Débito automático exitoso!\n\n` +
          `Se aplicaron $${res.debitedTotal.toLocaleString()} ARS a ${res.paymentsCount} cuota(s) mensual(es) pendiente(s). Tu saldo se actualizó automáticamente.`
        );
      } else {
        alert('No se registran cuotas mensuales pendientes para debitar o tu saldo disponible es $0.');
      }
      await syncData();
    } catch (err) {
      alert('Ocurrió un error al ejecutar el débito automático.');
    } finally {
      setIsExecutingDebit(false);
    }
  };

  // Save Transaction Modal Form
  const handleSaveTransaction = async (e: React.FormEvent) => {
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
      createdBy: `${currentUser.name} (${currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'intendente' ? 'Intendente' : 'Fiduciario'})`,
      createdAt: new Date().toISOString(),
    };

    await storageService.saveCashFlowTransaction(newTx);

    // Un ingreso común se acredita proporcionalmente en las cuentas mediante
    // su asiento de Caja, pero no se usa automáticamente para cancelar cuotas
    // o facturas. Administración decide expresamente qué pagar.
    if (txType === 'ingreso' && !linkedUser) {
      alert(
        `Ingreso común de $${Number(txAmount).toLocaleString()} ARS registrado con éxito.\n\n` +
        `Quedó como dinero general en Caja. Desde su propia fila podés decidir después si se distribuye, se acredita a un socio o se aplica a gastos.`
      );
    }

    setIsTransactionModalOpen(false);
    setTxConcept('');
    setTxAmount(0);
    setTxNotes('');
    setTxLinkedUserId('');
    await syncData();
  };

  const openIncomeAllocation = (income: CashFlowTransaction) => {
    const existing = incomeDistributionBySource.get(income.id) || [];
    const initialPercentages: Record<string, number> = {};
    payableInvoices.forEach(({ expense }) => { initialPercentages[expense.id] = 0; });
    setIncomeForAllocation(income);
    setIncomeAllocationMode(existing.length === 0 ? 'general' : existing.length === 1 ? 'one' : 'all');
    setIncomeAllocationUserId(existing.length === 1 ? existing[0].userId || '' : '');
    // El monto en pesos es el modo natural al asignar pagos. El porcentaje
    // sigue disponible como alternativa, pero no debe interpretar $25.000
    // como si fuera 25.000%.
    setIncomeExpenseEntryMode('amount');
    setIncomeExpensePercentages(initialPercentages);
    setIncomeRemainderMode('general');
    setIncomeRemainderUserId('');
  };

  const handleIncomeAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeForAllocation) return;
    if (incomeAllocationInProgress.current) return;
    incomeAllocationInProgress.current = true;
    setIsSavingIncomeAllocation(true);
    try {
    const existing = incomeDistributionBySource.get(incomeForAllocation.id) || [];
    if (incomeAllocationMode === 'expenses') {
      const selectedPercentages = payableInvoices
        .map((item) => ({ ...item, percentage: Number(incomeExpensePercentages[item.expense.id]) || 0 }))
        .filter((item) => item.percentage > 0.005);
      const requestedPercentage = selectedPercentages.reduce((sum, item) => sum + item.percentage, 0);
      const alreadyApplied = cashFlows
        .filter((transaction) => transaction.id.startsWith(`cf-income-spend-${incomeForAllocation.id}-`))
        .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
      const availableAmount = Math.max(0, incomeForAllocation.amount - alreadyApplied);

      if (selectedPercentages.length === 0) {
        alert('Indicá un monto o porcentaje del ingreso para aplicar a al menos un gasto.');
        return;
      }
      if (requestedPercentage > 100.001) {
        alert('La suma de los importes no puede superar el total del ingreso.');
        return;
      }
      const requestedAmount = Math.round((incomeForAllocation.amount * requestedPercentage / 100) * 100) / 100;
      if (requestedAmount > availableAmount + 0.01) {
        alert(`De este ingreso quedan $${availableAmount.toLocaleString()} ARS disponibles para aplicar.`);
        return;
      }
      if (selectedPercentages.some((item) => (incomeForAllocation.amount * item.percentage / 100) > item.pendingAmount + 0.01)) {
        alert('El importe elegido supera el saldo pendiente de al menos uno de los gastos.');
        return;
      }
      if (incomeRemainderMode === 'one' && !incomeRemainderUserId) {
        alert('Seleccioná el copropietario que recibirá el saldo restante.');
        return;
      }
      for (const ledger of existing) {
        if (!await storageService.deleteCashFlowTransaction(ledger.id)) {
          alert('La base de datos no confirmó el cambio de destino del ingreso.');
          await syncData();
          return;
        }
      }
      setIncomeForAllocation(null);
      setInvoicePaymentAmounts(Object.fromEntries(selectedPercentages.map((item) => [
        item.expense.id,
        Math.round((incomeForAllocation.amount * item.percentage / 100) * 100) / 100,
      ])));
      setInvoicePaymentDate(new Date().toISOString().split('T')[0]);
      setInvoicePaymentNotes('');
      setIncomeForExpensePayment(incomeForAllocation);
      setPendingRemainderAllocation({
        income: incomeForAllocation,
        amount: Math.round((availableAmount - requestedAmount) * 100) / 100,
        mode: incomeRemainderMode,
        userId: incomeRemainderUserId,
      });
      setIsInvoicePaymentModalOpen(true);
      return;
    }
    if (incomeAllocationMode === 'one' && !incomeAllocationUserId) {
      alert('Seleccioná el copropietario al que querés acreditar este ingreso.');
      return;
    }

    for (const ledger of existing) {
      if (!await storageService.deleteCashFlowTransaction(ledger.id)) {
        alert('La base de datos no confirmó el cambio de destino del ingreso.');
        await syncData();
        return;
      }
    }

    if (incomeAllocationMode === 'general') {
      setIncomeForAllocation(null);
      await syncData();
      return;
    }

    const recipients = incomeAllocationMode === 'all'
      ? activeOwners.map((owner) => ({ owner, amount: Math.round(incomeForAllocation.amount * (getOwnerSharePct(owner) / 100) * 100) / 100 }))
      : activeOwners.filter((owner) => owner.id === incomeAllocationUserId).map((owner) => ({ owner, amount: incomeForAllocation.amount }));
    if (recipients.length === 0) {
      alert('No se encontró el copropietario seleccionado.');
      return;
    }
    const distributed = recipients.reduce((sum, recipient) => sum + recipient.amount, 0);
    if (incomeAllocationMode === 'all') {
      recipients[recipients.length - 1].amount = Math.round((recipients[recipients.length - 1].amount + incomeForAllocation.amount - distributed) * 100) / 100;
    }

    const savedLedgerIds: string[] = [];
    for (const { owner, amount } of recipients) {
      const ledgerId = `ledger-income-share-${incomeForAllocation.id}--${owner.id}`;
      const saved = await storageService.saveCashFlowTransaction({
        id: ledgerId,
        type: 'ingreso',
        category: 'otro_ingreso',
        concept: incomeAllocationMode === 'all'
          ? `Parte proporcional de ingreso: ${incomeForAllocation.concept}`
          : `Ingreso acreditado por Administración: ${incomeForAllocation.concept}`,
        amount,
        currency: incomeForAllocation.currency,
        date: incomeForAllocation.date,
        userId: owner.id,
        userName: owner.name,
        partName: owner.partName,
        notes: incomeAllocationMode === 'all'
          ? `Distribución ${getOwnerSharePct(owner).toFixed(2)}% del ingreso ${incomeForAllocation.id}.`
          : `Acreditación individual del ingreso ${incomeForAllocation.id}.`,
        createdBy: `${currentUser.name} (Administración)`,
        createdAt: new Date().toISOString(),
      });
      if (!saved) {
        await Promise.all(savedLedgerIds.map((id) => storageService.deleteCashFlowTransaction(id)));
        alert('La base de datos no confirmó la distribución. No se aplicaron créditos parciales.');
        await syncData();
        return;
      }
      savedLedgerIds.push(ledgerId);
    }
    setIncomeForAllocation(null);
    await syncData();
    } finally {
      incomeAllocationInProgress.current = false;
      setIsSavingIncomeAllocation(false);
    }
  };

  const handlePayInvoicesFromCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentConfirmationInProgress.current) return;
    paymentConfirmationInProgress.current = true;
    setIsConfirmingPayments(true);
    try {
    const selected = payableInvoices
      .map((item) => ({ ...item, paymentAmount: Number(invoicePaymentAmounts[item.expense.id]) || 0 }))
      .filter((item) => item.paymentAmount > 0.005);
    const totalPayment = selected.reduce((sum, item) => sum + item.paymentAmount, 0);

    if (selected.length === 0 || totalPayment <= 0) {
      alert('Indicá un importe para al menos una factura.');
      return;
    }
    if (selected.some((item) => item.paymentAmount > item.pendingAmount + 0.01)) {
      alert('No podés pagar más que el saldo pendiente de una factura.');
      return;
    }
    if (totalPayment > cajaBalanceGeneral + 0.01) {
      alert(`El total a pagar ($${totalPayment.toLocaleString()} ARS) supera la Caja disponible ($${cajaBalanceGeneral.toLocaleString()} ARS).`);
      return;
    }
    const alreadyAppliedFromSource = incomeForExpensePayment
      ? cashFlows
          .filter((transaction) => transaction.id.startsWith(`cf-income-spend-${incomeForExpensePayment.id}-`))
          .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0)
      : 0;
    const sourceAvailable = incomeForExpensePayment
      ? Math.max(0, incomeForExpensePayment.amount - alreadyAppliedFromSource)
      : cajaBalanceGeneral;
    if (totalPayment > sourceAvailable + 0.01) {
      alert(`Este ingreso tiene $${sourceAvailable.toLocaleString()} ARS disponibles para aplicar. No podés asignar un importe mayor.`);
      return;
    }

    const persistedIds: string[] = [];
    const paymentBatchId = Date.now().toString();
    try {
      for (const { expense, isOwnerAdvance, paymentAmount, paidAmount } of selected) {
        if (isOwnerAdvance && expense.userId && paymentAmount > storageService.getOwnerAvailableCredit(expense.userId) + 0.01) {
          throw new Error('El reintegro supera el saldo a favor disponible del copropietario.');
        }
        const paymentId = incomeForExpensePayment
          ? `cf-income-spend-${incomeForExpensePayment.id}-${expense.id}-${paymentBatchId}`
          : `cf-invoice-payment-${expense.id}-${paymentBatchId}`;
        const savedPayment = await storageService.saveCashFlowTransaction({
          id: paymentId,
          type: 'egreso',
          category: isOwnerAdvance
            ? 'reintegro_gasto'
            : (expense.category === 'servicios' ? 'servicio' : expense.category === 'mantenimiento' ? 'mantenimiento' : 'pago_proveedor') as CashFlowCategory,
          concept: isOwnerAdvance
            ? `Reintegro ${paymentAmount + paidAmount >= Number(expense.amount) - 0.01 ? 'total' : 'parcial'} a ${expense.userName || 'copropietario'}: ${expense.concept}`
            : `Pago ${paymentAmount + paidAmount >= Number(expense.amount) - 0.01 ? 'total' : 'parcial'} de factura: ${expense.concept}`,
          amount: paymentAmount,
          currency: expense.currency || 'ARS',
          date: invoicePaymentDate,
          expenseId: expense.id,
          userId: isOwnerAdvance ? expense.userId : undefined,
          userName: isOwnerAdvance ? expense.userName : undefined,
          partName: isOwnerAdvance ? expense.partName : undefined,
          notes: [
            incomeForExpensePayment ? `Aplicado desde ingreso: ${incomeForExpensePayment.concept} (${incomeForExpensePayment.id})` : '',
            isOwnerAdvance ? 'Compra pagada previamente por el copropietario; este movimiento devuelve su adelanto.' : '',
            expense.invoiceNumber ? `Factura N° ${expense.invoiceNumber}` : '',
            invoicePaymentNotes.trim(),
          ].filter(Boolean).join(' · '),
          createdBy: `${currentUser.name} (Administración)`,
          createdAt: new Date().toISOString(),
        });
        if (!savedPayment) throw new Error('No se pudo guardar el egreso de Caja.');
        persistedIds.push(paymentId);

        // Se reparte exactamente el pago entre los socios, corrigiendo el
        // redondeo en el último asiento para que la suma coincida al centavo.
        const shares = activeOwners.map((owner) => ({
          owner,
          amount: Math.round(paymentAmount * (getOwnerSharePct(owner) / 100) * 100) / 100,
        }));
        const allocated = shares.reduce((sum, share) => sum + share.amount, 0);
        if (shares.length > 0) {
          shares[shares.length - 1].amount = Math.round((shares[shares.length - 1].amount + paymentAmount - allocated) * 100) / 100;
        }
        for (const share of shares) {
          if (share.amount <= 0) continue;
          const ledgerId = `ledger-expense-share-${paymentId}-${share.owner.id}`;
          const savedShare = await storageService.saveCashFlowTransaction({
            id: ledgerId,
            type: 'egreso',
            category: 'pago_proveedor',
            concept: `${incomeForExpensePayment ? `Ingreso “${incomeForExpensePayment.concept}” aplicado a` : 'Pago de'} ${isOwnerAdvance ? 'adelanto' : 'factura'}: ${expense.concept}`,
            amount: share.amount,
            currency: expense.currency || 'ARS',
            date: invoicePaymentDate,
            userId: share.owner.id,
            userName: share.owner.name,
            partName: share.owner.partName,
            expenseId: expense.id,
            notes: `${incomeForExpensePayment ? `Ingreso ${incomeForExpensePayment.id}` : `Pago de Caja ${paymentId}`}. Participación ${getOwnerSharePct(share.owner).toFixed(2)}%.`,
            createdBy: `${currentUser.name} (Administración)`,
            createdAt: new Date().toISOString(),
          });
          if (!savedShare) throw new Error('No se pudo guardar el asiento proporcional de los copropietarios.');
          persistedIds.push(ledgerId);
        }

        const totalPaid = Math.round((paidAmount + paymentAmount) * 100) / 100;
        const savedExpense = isOwnerAdvance
          ? await storageService.applyReimbursementToExpense(expense.id, paymentAmount)
          : await storageService.saveExpense({
              ...expense,
              status: totalPaid >= Number(expense.amount) - 0.01 ? 'paid' : 'pending',
              paidAt: invoicePaymentDate,
              paymentMethod: 'Caja/Banco',
            });
        if (!savedExpense) throw new Error('No se pudo actualizar el estado de la factura.');
      }

      // El mismo ingreso puede financiar gastos y, a la vez, acreditar su
      // saldo restante. Se calcula al confirmar para respetar cualquier ajuste
      // de importe realizado en la pantalla de revisión.
      const remainderAmount = Math.max(0, Math.round((sourceAvailable - totalPayment) * 100) / 100);
      if (pendingRemainderAllocation && remainderAmount > 0.01 && pendingRemainderAllocation.mode !== 'general') {
        const remainderRecipients = pendingRemainderAllocation.mode === 'all'
          ? activeOwners.map((owner) => ({ owner, amount: Math.round(remainderAmount * (getOwnerSharePct(owner) / 100) * 100) / 100 }))
          : activeOwners.filter((owner) => owner.id === pendingRemainderAllocation.userId).map((owner) => ({ owner, amount: remainderAmount }));
        if (remainderRecipients.length === 0) throw new Error('No se encontró el destino del saldo restante.');
        const remainderDistributed = remainderRecipients.reduce((sum, item) => sum + item.amount, 0);
        if (pendingRemainderAllocation.mode === 'all') {
          remainderRecipients[remainderRecipients.length - 1].amount = Math.round((remainderRecipients[remainderRecipients.length - 1].amount + remainderAmount - remainderDistributed) * 100) / 100;
        }
        for (const { owner, amount } of remainderRecipients) {
          if (amount <= 0) continue;
          const ledgerId = `ledger-income-share-${pendingRemainderAllocation.income.id}--${owner.id}`;
          const savedRemainder = await storageService.saveCashFlowTransaction({
            id: ledgerId,
            type: 'ingreso',
            category: 'otro_ingreso',
            concept: pendingRemainderAllocation.mode === 'all'
              ? `Saldo restante distribuido: ${pendingRemainderAllocation.income.concept}`
              : `Saldo restante acreditado: ${pendingRemainderAllocation.income.concept}`,
            amount,
            currency: pendingRemainderAllocation.income.currency,
            date: invoicePaymentDate,
            userId: owner.id,
            userName: owner.name,
            partName: owner.partName,
            notes: `Saldo luego de aplicar $${totalPayment.toLocaleString()} ARS a gastos del ingreso ${pendingRemainderAllocation.income.id}.`,
            createdBy: `${currentUser.name} (Administración)`,
            createdAt: new Date().toISOString(),
          });
          if (!savedRemainder) throw new Error('No se pudo acreditar el saldo restante.');
          persistedIds.push(ledgerId);
        }
      }
      setIsInvoicePaymentModalOpen(false);
      setIncomeForExpensePayment(null);
      setPendingRemainderAllocation(null);
      alert(`Se aplicaron $${totalPayment.toLocaleString()} ARS a gastos. El saldo restante quedó ${pendingRemainderAllocation?.mode === 'all' ? 'distribuido entre los copropietarios' : pendingRemainderAllocation?.mode === 'one' ? 'acreditado al copropietario elegido' : 'como ingreso general en Caja'}.`);
      await syncData();
    } catch (error) {
      // Evita dejar asientos sueltos si la base rechaza cualquier parte del pago.
      await Promise.all(persistedIds.map((id) => storageService.deleteCashFlowTransaction(id)));
      setPendingRemainderAllocation(null);
      await syncData();
      alert('La base de datos no confirmó el pago completo. No se aplicaron movimientos parciales.');
    }
    } finally {
      paymentConfirmationInProgress.current = false;
      setIsConfirmingPayments(false);
    }
  };

  // Submit Expense Modal Form
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
      approvalStatus: fullAdmin ? 'approved' : 'pending',
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

    setIsExpenseModalOpen(false);
    setExpConcept('');
    setExpAmount(0);
    setExpProvider('');
    setExpInvoiceNumber('');
    setExpPayerUserId('');
    setExpNotes('');
    alert(
      fullAdmin
        ? 'Factura registrada y aprobada. Quedó disponible para pagar total o parcialmente desde Caja.'
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

    alert('Factura aprobada. El egreso se registrará sólo al aplicar un pago desde Caja.');
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

  const handleExecuteReimbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reimburseModalUser || reimburseAmount <= 0) {
      alert('Monto de reintegro no válido.');
      return;
    }

    if (reimburseAmount > cajaBalanceGeneral + 1) {
      alert('Advertencia: El monto a reintegrar supera el saldo disponible actual en caja común.');
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

    const savedCashMovement = await storageService.saveCashFlowTransaction(tx);
    if (!savedCashMovement) {
      alert('La base de datos no confirmó el reintegro. No se actualizó el saldo del socio.');
      return;
    }
    const applied = await storageService.applyReimbursementToAdvances(reimburseModalUser.userId, reimburseAmount);
    if (!applied) {
      alert('El reintegro quedó registrado, pero no se pudo aplicar completo contra los adelantos. Revisá la cuenta corriente.');
    }
    setReimburseModalUser(null);
    setReimburseAmount(0);
    setReimburseNotes('');
    alert(`Reintegro de $${reimburseAmount.toLocaleString()} ARS registrado correctamente.`);
  };

  // Filtered cash flows for General Ledger
  const filteredGeneralCashFlows = effectiveCashFlows.filter((t) => {
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesSearch =
      t.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.userName && t.userName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.partName && t.partName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  });

  // Personal Ledger for currentUser:
  // Combines:
  // 1. User's share of common incomes
  // 2. Direct incomes
  // 3. Approved expense advances
  // 4. Reimbursements
  // 5. Auto-debits applied to monthly fee debts
  // 6. Proportional shares of invoices paid from Caja
  const personalMovements = [
    // Common incomes distributed
    ...cashFlows
      .filter((t) => t.id.startsWith('ledger-income-share-') && t.userId === currentUser.id)
      .map((t) => {
      const sourceId = t.id.slice('ledger-income-share-'.length).split('--')[0];
      const source = cashFlows.find((flow) => flow.id === sourceId);
      return {
        id: t.id,
        date: t.date,
        type: 'ingreso' as CashFlowType,
        category: 'Ingreso Común Distribuido',
        concept: t.concept,
        amount: t.amount,
        notes: source ? `Distribución del ingreso general: ${source.concept}` : (t.notes || 'Ingreso distribuido por Administración'),
        isCommonShare: true,
      };
    }),
    // Direct incomes
    ...effectiveCashFlows
      .filter(
        (t) =>
          t.type === 'ingreso' &&
          Boolean(t.userId && (t.userId === currentUser.id || (t.userName && t.userName.toLowerCase() === currentUser.name.toLowerCase())))
      )
      .map((t) => ({
        id: t.id,
        date: t.date,
        type: 'ingreso' as CashFlowType,
        category: t.category.replace('_', ' '),
        concept: t.concept,
        amount: t.amount,
        notes: t.notes || 'Aporte directo registrado',
        isCommonShare: false,
      })),
    // Adelantos personales realmente registrados en la cuenta corriente.
    ...cashFlows
      .filter((t) => t.id.startsWith('ledger-advance-') && t.userId === currentUser.id)
      .map((t) => ({
        id: t.id,
        date: t.date,
        type: 'ingreso' as CashFlowType, // positive credit to owner's account
        category: 'Gasto Adelantado (Aprobado)',
        concept: t.concept,
        amount: t.amount,
        notes: t.notes || 'Compra abonada personalmente por el copropietario',
        isCommonShare: false,
      })),
    // Reimbursements received
    ...effectiveCashFlows
      .filter(
        (t) =>
          (t.userId === currentUser.id || (t.userName && t.userName.toLowerCase() === currentUser.name.toLowerCase())) &&
          t.category === 'reintegro_gasto'
      )
      .map((t) => ({
        id: `reimb-${t.id}`,
        date: t.date,
        type: 'egreso' as CashFlowType,
        category: 'Reintegro Cobrado',
        concept: t.concept,
        amount: t.amount,
        notes: t.notes || 'Transferencia de reintegro desde caja común',
        isCommonShare: false,
      })),
    // Monthly fees debited automatically
    ...myAccount.autoDebitedAllocations.map(({ collection, allocation }) => ({
      id: `debit-${collection.id}-${allocation.userId}`,
      date: allocation.paidAt || collection.dueDate || '2026-10-15',
      type: 'egreso' as CashFlowType,
      category: '⚡ Débito Automático',
      concept: `Pago de Expensas: ${collection.concept}`,
      amount: allocation.paidAmount || 0,
      notes: allocation.notes || 'Débito automático aplicado desde saldo a favor',
      isCommonShare: false,
    })),
    // Facturas abonadas con Caja: cada copropietario ve el importe que le
    // corresponde por su participación, sin duplicar el egreso físico.
    ...cashFlows
      .filter((t) => t.id.startsWith('ledger-expense-share-') && t.userId === currentUser.id)
      .map((t) => ({
        id: t.id,
        date: t.date,
        type: 'egreso' as CashFlowType,
        category: 'Factura Pagada por Caja',
        concept: t.concept,
        amount: t.amount,
        notes: t.notes || 'Parte proporcional de una factura pagada desde Caja',
        isCommonShare: false,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const pendingExpenses = expenses.filter((e) => !e.approvalStatus || e.approvalStatus === 'pending');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#7A8E7E] pb-1">
            <span className="font-serif font-bold text-[#163323]">Fideicomiso El Desayuno</span>
            <span>·</span>
            <span>
              {canViewGeneral
                ? 'Gestión Integral de Caja y Cuentas de Copropietarios'
                : 'Mi Cuenta Particular, Ingresos Distribuidos y Débito Automático'}
            </span>
          </div>
          <h2
            className="text-xl sm:text-2xl font-serif font-bold text-[#163323] tracking-wide flex items-center gap-2.5"
            style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
          >
            <Wallet className="w-6 h-6 text-[#BFA270]" />
            <span>
              {canViewGeneral
                ? 'Caja Común, Ingresos Distribuidos y Cuentas de Socios'
                : `Mi Cuenta Particular: ${currentUser.name} (${currentUser.partName || 'Socio'})`}
            </span>
          </h2>
          <p className="text-xs text-[#526657] mt-1 max-w-3xl leading-relaxed">
            {canViewGeneral
              ? 'Panel reservado para Administrador, Intendente y Fiduciario. Control de caja común, distribución de ingresos y cuentas de los copropietarios.'
              : 'Consultá tu porcentaje de participación, los ingresos comunes distribuidos a tu favor, tus gastos adelantados y el estado del débito automático de tus cuotas mensuales.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canUpload && (
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="px-4 py-2.5 bg-[#FAF8F5] hover:bg-[#F2EDE1] border border-[#DDD5BF] text-[#163323] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
              title="Subir factura o gasto adelantado para aprobación"
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
                <span>+ Registrar Ingreso / Movimiento</span>
              </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs (Exclusive options for Admin, Intendente and Fiduciario) */}
      {canViewGeneral ? (
        <div className="flex border-b border-[#E3DFC8] bg-white px-4 pt-2 gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTabSub('caja')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTabSub === 'caja'
                ? 'border-[#1B3B2B] text-[#163323]'
                : 'border-transparent text-[#7A8E7E] hover:text-[#163323]'
            }`}
          >
            <Building2 className="w-4 h-4 text-[#BFA270]" />
            <span>🏛️ Cuenta General (Caja Común)</span>
          </button>

          {canUsePersonalAccount && (
            <button
              onClick={() => setActiveTabSub('mi_cuenta')}
              className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTabSub === 'mi_cuenta'
                  ? 'border-[#1B3B2B] text-[#163323]'
                  : 'border-transparent text-[#7A8E7E] hover:text-[#163323]'
              }`}
            >
              <UserCheck className="w-4 h-4 text-[#BFA270]" />
              <span>👤 Mi Cuenta Particular</span>
            </button>
          )}

          <button
            onClick={() => setActiveTabSub('cuentas_socios')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTabSub === 'cuentas_socios'
                ? 'border-[#1B3B2B] text-[#163323]'
                : 'border-transparent text-[#7A8E7E] hover:text-[#163323]'
            }`}
          >
            <Users className="w-4 h-4 text-[#BFA270]" />
            <span>👥 Cuentas de Copropietarios ({accountsSummary.length})</span>
          </button>

          <button
            onClick={() => setActiveTabSub('gastos_pendientes')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2 relative shrink-0 ${
              activeTabSub === 'gastos_pendientes'
                ? 'border-[#1B3B2B] text-[#163323]'
                : 'border-transparent text-[#7A8E7E] hover:text-[#163323]'
            }`}
          >
            <Receipt className="w-4 h-4 text-[#BFA270]" />
            <span>Facturas por Aprobar</span>
            {pendingExpenses.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-600 text-white font-mono text-[9px] font-bold flex items-center justify-center">
                {pendingExpenses.length}
              </span>
            )}
          </button>
        </div>
      ) : null}

      {/* ========================================================= */}
      {/* 1. VISTA: MI CUENTA PARTICULAR (PARA TODOS LOS COPROPIETARIOS) */}
      {/* ========================================================= */}
      {canUsePersonalAccount && activeTabSub === 'mi_cuenta' && (
        <div className="space-y-6">
          {/* KPI Summary Cards: Copropietario Particular */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 border-l-[#1B3B2B]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Saldo Disponible en Mi Cuenta
              </span>
              <div className="text-2xl font-bold font-mono text-[#163323] mt-1">
                ${myAccount.netAvailableBalance.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-[#526657] mt-1 flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${myAccount.netAvailableBalance > 0 ? 'bg-emerald-600 animate-pulse' : 'bg-neutral-400'}`} />
                <span>Monto disponible para reintegro o débito de cuotas</span>
              </p>
            </div>

            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 border-l-emerald-700">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Ingresos Distribuidos ({myAccount.sharePct.toFixed(2)}%)
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-800 mt-1">
                ${myAccount.distributedIncome.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-[#526657] mt-1">
                Acreditación automática de ingresos comunes
              </p>
            </div>

            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 border-l-blue-700">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Gastos Adelantados Aprobados
              </span>
              <div className="text-2xl font-bold font-mono text-blue-900 mt-1">
                ${myAccount.totalAdvanced.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-[#526657] mt-1">
                Compras y servicios pagados de tu bolsillo
              </p>
            </div>

            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 border-l-amber-700">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Débito Automático Aplicado
              </span>
              <div className="text-2xl font-bold font-mono text-amber-900 mt-1">
                ${myAccount.totalAutoDebited.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-[#526657] mt-1">
                Cuotas y expensas canceladas con tu saldo
              </p>
            </div>
          </div>

          {/* DÉBITO AUTOMÁTICO CARD & CONTROLS */}
          <div className="bg-[#FAF8F5] border border-[#DCD4C0] p-5 shadow-xs rounded-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-[#1B3B2B] text-[#BFA270] rounded-xs">
                  <Zap className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-sm text-[#163323] tracking-wide uppercase">
                  Débito Automático de Cuotas Mensuales y Expensas
                </h3>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-2xs ${
                    autoDebitEnabled
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-neutral-200 text-neutral-700 border border-neutral-300'
                  }`}
                >
                  {autoDebitEnabled ? '● ACTIVADO POR DEFECTO' : '○ PAUSADO'}
                </span>
              </div>
              <p className="text-xs text-[#526657] leading-relaxed">
                Cuando ingresa dinero común al fideicomiso (o registrás gastos adelantados a favor), tu porcentaje se acredita automáticamente en tu cuenta. Con el débito automático activado, el sistema cancela tus cuotas pendientes sin que tengas que transferir manualmente.
              </p>
              <div className="text-xs text-[#163323] font-medium pt-1">
                {myAccount.totalPendingDebt > 0 ? (
                  <span className="text-amber-800 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>
                      Registrás <strong>${myAccount.totalPendingDebt.toLocaleString()} ARS</strong> en cuotas pendientes ({myAccount.pendingAllocations.length} cuota/s).
                    </span>
                  </span>
                ) : (
                  <span className="text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tu cuenta está 100% al día. No tenés cuotas mensuales pendientes.</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => handleToggleAutoDebit(currentUser.id)}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 border shadow-xs ${
                  autoDebitEnabled
                    ? 'bg-emerald-800 hover:bg-emerald-900 text-white border-emerald-900'
                    : 'bg-white hover:bg-neutral-50 text-[#163323] border-[#DDD5BF]'
                }`}
                title="Activar o pausar débito automático"
              >
                <Zap className="w-4 h-4 text-[#BFA270]" />
                <span>{autoDebitEnabled ? 'Débito Automático: ON' : 'Activar Débito Automático'}</span>
              </button>

              {myAccount.netAvailableBalance > 0 && myAccount.totalPendingDebt > 0 && (
                <button
                  type="button"
                  disabled={isExecutingDebit}
                  onClick={() => handleExecuteAutoDebitNow(currentUser.id, myAccount.netAvailableBalance)}
                  className="px-4 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-2xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#BFA270] ${isExecutingDebit ? 'animate-spin' : ''}`} />
                  <span>{isExecutingDebit ? 'Aplicando...' : '⚡ Pagar Cuotas con Saldo Ahora'}</span>
                </button>
              )}
            </div>
          </div>

          {/* CUOTAS PENDIENTES & CUOTAS PAGADAS POR DÉBITO */}
          {myAccount.pendingAllocations.length > 0 && (
            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Cuotas Mensuales Pendientes de Pago</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {myAccount.pendingAllocations.map(({ collection, allocation, pendingAmount }) => (
                  <div key={collection.id} className="p-3 bg-[#FAF8F5] border border-amber-200 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#7A8E7E] block">{collection.category}</span>
                      <h5 className="font-bold text-xs text-[#163323] mt-0.5">{collection.concept}</h5>
                      <span className="text-[11px] text-[#637568] block mt-1">Vencimiento: {collection.dueDate}</span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-[#EFEAE0] flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-amber-900">Pendiente:</span>
                      <span className="font-mono font-bold text-sm text-amber-900">${pendingAmount.toLocaleString()} ARS</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HISTORIAL DETALLADO DE MI CUENTA PARTICULAR */}
          <div className="bg-white border border-[#E3DFC8] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#F8F5EE] border-b border-[#E3DFC8] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#163323] flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#BFA270]" />
                  <span>Mis Movimientos Detallados ({personalMovements.length})</span>
                </h3>
                <span className="text-[11px] text-[#637568]">
                  Ingresos comunes distribuidos ({myAccount.sharePct.toFixed(2)}%), adelantos aprobados, reintegros y cuotas debitadas.
                </span>
              </div>
            </div>

            <table className="w-full text-xs text-left">
              <thead className="bg-[#FAF8F5] border-b border-[#E3DFC8] text-[#55695B] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3">Categoría</th>
                  <th className="py-3 px-4">Concepto / Detalle</th>
                  <th className="py-3 px-4 text-right">Monto (ARS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0]">
                {personalMovements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-[#7A8E7E]">
                      <Coins className="w-8 h-8 text-[#DDD5BF] mx-auto mb-2" />
                      <span className="font-semibold text-sm text-[#163323] block">
                        No registrás movimientos en tu cuenta particular todavía.
                      </span>
                      <p className="text-[11px] text-[#7A8E7E] mt-1 max-w-md mx-auto">
                        Cuando la administración registre ingresos comunes o subas gastos adelantados con factura, se acreditarán en esta sección.
                      </p>
                    </td>
                  </tr>
                ) : (
                  personalMovements.map((mov) => {
                    const isCredit = mov.type === 'ingreso';
                    return (
                      <tr key={mov.id} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="py-3.5 px-4 font-mono text-[#637568]">{mov.date}</td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-2xs ${
                              isCredit
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {isCredit ? <TrendingUp className="w-3 h-3 text-emerald-700" /> : <TrendingDown className="w-3 h-3 text-amber-700" />}
                            <span>{isCredit ? 'Acreditación' : 'Débito / Pago'}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-[10px] text-[#526657] uppercase">
                          {mov.category}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-[#163323]">
                          <span>{mov.concept}</span>
                          {mov.notes && <span className="block text-[11px] text-[#7A8E7E] font-normal">{mov.notes}</span>}
                        </td>
                        <td className={`py-3.5 px-4 text-right font-mono font-bold text-sm ${isCredit ? 'text-emerald-700' : 'text-amber-900'}`}>
                          {isCredit ? '+' : '-'}${mov.amount.toLocaleString()}
                        </td>
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
      {/* 2. VISTA: CUENTA GENERAL (CAJA COMÚN) - SÓLO ADMIN / INTENDENTE / FIDUCIARIO */}
      {/* ========================================================= */}
      {activeTabSub === 'caja' && canViewGeneral && (
        <div className="space-y-6">
          {/* Global KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 border-l-[#1B3B2B]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Caja Disponible
              </span>
              <div className="text-2xl font-bold font-mono text-[#163323] mt-1">
                ${cajaBalanceGeneral.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-[#526657] mt-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>Dinero físico disponible en Caja/Banco</span>
              </p>
            </div>

            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 border-l-emerald-700">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Total Ingresos Comunes
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-800 mt-1">
                ${totalIngresosGeneral.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-[#526657] mt-1">
                Alquileres, pastaje, ventas e ingresos del fideicomiso
              </p>
            </div>

            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 border-l-amber-700">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Total Egresos & Proveedores
              </span>
              <div className="text-2xl font-bold font-mono text-amber-900 mt-1">
                ${totalEgresosGeneral.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-[#526657] mt-1">
                Gastos operativos, facturas y reintegros
              </p>
            </div>

            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 border-l-blue-700">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Adelantos a Reintegrar
              </span>
              <div className="text-2xl font-bold font-mono text-blue-900 mt-1">
                ${totalAdelantosPendientes.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-blue-800 mt-1">
                Compras personales pendientes de devolución
              </p>
            </div>

            <div className={`bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 ${saldoNetoComprometido < 0 ? 'border-l-red-700' : 'border-l-emerald-700'}`}>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Saldo Neto Comprometido
              </span>
              <div className={`text-2xl font-bold font-mono mt-1 ${saldoNetoComprometido < 0 ? 'text-red-800' : 'text-emerald-800'}`}>
                ${saldoNetoComprometido.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-[#526657] mt-1">
                Caja disponible menos adelantos pendientes
              </p>
            </div>
          </div>

          <p className="text-[11px] text-[#526657] bg-blue-50 border border-blue-200 px-3 py-2">
            Los adelantos son gastos reales pagados por copropietarios. No reducen Caja hasta que se emite un reintegro; por eso se muestran como compromiso pendiente y ajustan el saldo neto.
          </p>

          {/* LIBRO DIARIO GENERAL DE CAJA */}
          <div className="space-y-4">
            <div className="bg-white border border-[#E3DFC8] p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-[#8C7A53] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar en libro diario..."
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
                    <th className="py-3 px-3">Socio / Destino</th>
                    <th className="py-3 px-4 text-right">Monto (ARS)</th>
                    {fullAdmin && <th className="py-3 px-3 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEAE0]">
                  {filteredGeneralCashFlows.length === 0 ? (
                    <tr>
                      <td colSpan={fullAdmin ? 7 : 6} className="py-12 text-center text-xs text-[#7A8E7E]">
                        <Coins className="w-8 h-8 text-[#DDD5BF] mx-auto mb-2" />
                        <span className="font-semibold text-sm text-[#163323] block">
                          No se encontraron movimientos de caja con los filtros seleccionados.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    filteredGeneralCashFlows.map((tx) => {
                      const isIngreso = tx.type === 'ingreso';
                      const isCommon = isIngreso && (!tx.userId || tx.userId === '');
                      const incomeDistribution = incomeDistributionBySource.get(tx.id) || [];
                      const isExpanded = expandedTxId === tx.id;
                      return (
                        <React.Fragment key={tx.id}>
                          <tr className="hover:bg-[#FAF8F5] transition-colors">
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
                              {isCommon && (
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <span className={`inline-flex px-2 py-1 rounded-2xs text-[10px] font-bold uppercase tracking-wider border ${incomeDistribution.length > 0 ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-[#FAF8F5] text-[#637568] border-[#DDD5BF]'}`}>
                                    {incomeDistribution.length > 0 ? `Acreditado a ${incomeDistribution.length} socio(s)` : 'Ingreso general sin destino asignado'}
                                  </span>
                                  {incomeDistribution.length > 0 && (
                                    <button type="button" onClick={() => toggleExpandTx(tx.id)} className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1B3B2B] hover:underline cursor-pointer">
                                      <span>{isExpanded ? 'Ocultar detalle' : 'Ver detalle'}</span>
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>
                                  )}
                                </div>
                              )}
                              {tx.notes && <span className="block text-[11px] text-[#7A8E7E] font-normal mt-0.5">{tx.notes}</span>}
                            </td>
                            <td className="py-3.5 px-3">
                              {tx.userName ? (
                                <span className="font-medium text-[#163323]">{tx.userName} ({tx.partName})</span>
                              ) : (
                                <span className="font-medium text-emerald-800">Fideicomiso Común</span>
                              )}
                            </td>
                            <td className={`py-3.5 px-4 text-right font-mono font-bold text-sm ${isIngreso ? 'text-emerald-700' : 'text-amber-900'}`}>
                              {isIngreso ? '+' : '-'}${tx.amount.toLocaleString()}
                            </td>
                            {fullAdmin && (
                              <td className="py-3.5 px-3 text-right whitespace-nowrap">
                                {isCommon && (
                                  <button onClick={() => openIncomeAllocation(tx)} className="mr-2 px-2 py-1 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-[10px] font-bold uppercase tracking-wider cursor-pointer" title="Decidir qué hacer con este ingreso">
                                    Decidir destino
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    if (confirm('¿Eliminar este movimiento de caja?')) {
                                      const deleted = await storageService.deleteCashFlowWithDependencies(tx.id);
                                      if (!deleted) {
                                        alert('La base de datos no confirmó la eliminación completa del movimiento.');
                                      }
                                      await syncData();
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

                          {/* DESPLEGABLE CON LA TABLA DE DISTRIBUCIÓN POR COPROPIETARIO */}
                          {isCommon && incomeDistribution.length > 0 && isExpanded && (
                            <tr key={`${tx.id}-breakdown`} className="bg-[#FAF8F5]">
                              <td colSpan={fullAdmin ? 7 : 6} className="p-3 sm:p-4 border-b border-[#E3DFC8]">
                                <div className="bg-white border border-[#E3DFC8] p-4 shadow-xs space-y-3">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#EFEAE0]">
                                    <div>
                                      <h4 className="font-bold text-xs text-[#163323] flex items-center gap-1.5">
                                        <Coins className="w-4 h-4 text-[#BFA270]" />
                                        <span>Distribución de este Ingreso ({tx.concept}) entre los Copropietarios</span>
                                      </h4>
                                      <p className="text-[11px] text-[#637568]">
                                        Destino registrado para este ingreso. Sólo los socios acreditados aquí lo ven en su cuenta corriente:
                                      </p>
                                    </div>
                                    <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 border border-emerald-200">
                                      Total Ingreso: ${tx.amount.toLocaleString()} ARS
                                    </span>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                      <thead className="bg-[#FAF8F5] text-[#55695B] uppercase font-bold text-[10px] tracking-wider border-b border-[#E3DFC8]">
                                        <tr>
                                          <th className="py-2.5 px-3">Copropietario</th>
                                          <th className="py-2.5 px-3 text-center">Parte / Cabeza</th>
                                          <th className="py-2.5 px-3 text-center">Acciones (%)</th>
                                          <th className="py-2.5 px-3 text-right">Ingreso Distribuido</th>
                                          <th className="py-2.5 px-3 text-center">Débito Automático</th>
                                          <th className="py-2.5 px-3 text-right">Saldo a Favor</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#EFEAE0]">
                                        {accountsSummary.map((acc) => {
                                          const shareThisTx = incomeDistribution.find((entry) => entry.userId === acc.userId)?.amount || 0;
                                          return (
                                            <tr key={acc.userId} className="hover:bg-[#FAF8F5]">
                                              <td className="py-2.5 px-3 font-semibold text-[#163323]">{acc.userName}</td>
                                              <td className="py-2.5 px-3 text-center text-[#7A8E7E]">{acc.partName}</td>
                                              <td className="py-2.5 px-3 text-center font-mono font-bold text-[#163323]">{acc.sharePct.toFixed(2)}%</td>
                                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800">
                                                ${shareThisTx.toLocaleString()} ARS
                                              </td>
                                              <td className="py-2.5 px-3 text-center">
                                                <span
                                                  className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-2xs ${
                                                    acc.isAutoDebitOn
                                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                      : 'bg-neutral-200 text-neutral-600'
                                                  }`}
                                                >
                                                  {acc.isAutoDebitOn ? '⚡ Activado' : 'Pausado'}
                                                </span>
                                              </td>
                                              <td className="py-2.5 px-3 text-right font-mono font-bold text-[#163323]">
                                                ${acc.netAvailableBalance.toLocaleString()} ARS
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. VISTA: CUENTAS DE COPROPIETARIOS (SOLO ADMIN / FIDUCIARIO) */}
      {/* ========================================================= */}
      {activeTabSub === 'cuentas_socios' && canViewGeneral && (
        <div className="space-y-4">
          <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-4.5 space-y-2">
            <h3 className="text-sm font-bold text-[#163323] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#BFA270]" />
              <span>Cuentas Corrientes Particulares de Copropietarios ({accountsSummary.length} Socios)</span>
            </h3>
            <p className="text-xs text-[#526657] leading-relaxed">
              Consulte la cuenta particular de cada socio: sus ingresos comunes acreditados por porcentaje, adelantos, cuotas debitadas y la parte proporcional de cada factura abonada desde Caja.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accountsSummary.map((acc) => {
              const hasBalance = acc.netAvailableBalance > 0;
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
                          <span className="text-[11px] text-[#7A8E7E]">
                            {acc.partName} · {acc.sharePct.toFixed(2)}% Acciones
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-2xs ${
                            acc.isAutoDebitOn
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-neutral-200 text-neutral-600'
                          }`}
                        >
                          {acc.isAutoDebitOn ? '⚡ Débito ON' : 'Débito OFF'}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-2xs ${
                            hasBalance
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          {hasBalance ? 'Saldo a Favor' : 'Al Día'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2.5 bg-[#FAF8F5] border border-[#E8E2D2]">
                        <span className="text-[10px] text-[#7A8E7E] block uppercase">Ingresos %</span>
                        <span className="font-mono font-bold text-emerald-800 text-sm">${acc.distributedIncome.toLocaleString()}</span>
                      </div>
                      <div className="p-2.5 bg-[#FAF8F5] border border-[#E8E2D2]">
                        <span className="text-[10px] text-[#7A8E7E] block uppercase">Adelantos</span>
                        <span className="font-mono font-bold text-[#163323] text-sm">${acc.totalAdvanced.toLocaleString()}</span>
                      </div>
                      <div className="p-2.5 bg-[#FAF8F5] border border-[#E8E2D2]">
                        <span className="text-[10px] text-[#7A8E7E] block uppercase">Facturas Pagadas</span>
                        <span className="font-mono font-bold text-amber-800 text-sm">${acc.totalInvoicePayments.toLocaleString()}</span>
                      </div>
                      <div className="p-2.5 bg-[#FAF8F5] border border-[#E8E2D2]">
                        <span className="text-[10px] text-[#7A8E7E] block uppercase">Saldo Disponible</span>
                        <span className={`font-mono font-bold text-sm ${hasBalance ? 'text-emerald-800' : 'text-[#163323]'}`}>
                          ${acc.netAvailableBalance.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#637568] pt-1">
                      <span>Cuotas debitadas: <strong>${acc.totalAutoDebited.toLocaleString()} ARS</strong></span>
                      <span>Deuda pendiente: <strong className={acc.totalPendingDebt > 0 ? 'text-amber-800' : 'text-emerald-700'}>${acc.totalPendingDebt.toLocaleString()} ARS</strong></span>
                    </div>
                  </div>

                  {fullAdmin && hasBalance && (
                    <div className="pt-3 border-t border-[#EFEAE0] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleAutoDebit(acc.userId)}
                        className="text-[11px] text-[#1B3B2B] hover:underline cursor-pointer"
                      >
                        {acc.isAutoDebitOn ? 'Pausar Débito' : 'Activar Débito'}
                      </button>

                      <button
                        onClick={() => {
                          setReimburseModalUser({
                            userId: acc.userId,
                            userName: acc.userName,
                            balanceDue: acc.netAvailableBalance,
                          });
                          setReimburseAmount(acc.netAvailableBalance);
                        }}
                        className="px-3 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <span>Emitir Reintegro</span>
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
      {/* 4. VISTA: FACTURAS PENDIENTES DE APROBACIÓN                */}
      {/* ========================================================= */}
      {activeTabSub === 'gastos_pendientes' && canViewGeneral && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-300 p-4 text-xs text-amber-950 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Bandeja de Aprobación de Facturas y Gastos</strong>
              <span>Los copropietarios y cabezas de equipo pueden subir comprobantes de compras realizadas para la estancia. Una vez aprobados por usted, se acreditan a su cuenta corriente particular y se asientan como egresos en la caja común.</span>
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
                {pendingExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-[#7A8E7E]">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                      <span className="font-semibold text-sm text-[#163323] block">
                        No hay comprobantes pendientes de aprobación.
                      </span>
                    </td>
                  </tr>
                ) : (
                  pendingExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-[#FAF8F5]">
                      <td className="py-3 px-4">
                        <span className="font-mono text-[#637568] block">{exp.date}</span>
                        <strong className="text-[#163323]">{exp.userName}</strong>
                        <span className="block text-[10px] text-[#7A8E7E]">{exp.partName}</span>
                      </td>
                      <td className="py-3 px-3 uppercase text-[10px] font-semibold text-[#526657]">
                        {exp.category}
                      </td>
                      <td className="py-3 px-4">
                        <strong className="text-[#163323] block">{exp.concept}</strong>
                        <span className="text-[11px] text-[#7A8E7E]">Comercio: {exp.provider || 'No informado'}</span>
                        {exp.invoiceNumber && <span className="block text-[11px] text-[#7A8E7E] font-mono">Factura: {exp.invoiceNumber}</span>}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-sm text-[#163323]">
                        ${exp.amount.toLocaleString()} ARS
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApproveExpense(exp)}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] uppercase rounded-2xs cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Aprobar</span>
                          </button>
                          <button
                            onClick={() => handleRejectExpense(exp)}
                            className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 font-bold text-[10px] uppercase rounded-2xs cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Rechazar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DECIDIR DESTINO DE UN INGRESO GENERAL             */}
      {/* ========================================================= */}
      {incomeForAllocation && fullAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-5xl border border-[#DCD4C0] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold tracking-wide" style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}>¿Qué hacemos con este ingreso?</h3>
                <p className="text-[11px] text-[#C9D6CC] mt-0.5">{incomeForAllocation.concept} · ${incomeForAllocation.amount.toLocaleString()} ARS</p>
              </div>
              <button onClick={() => setIncomeForAllocation(null)} className="text-[#C9D6CC] hover:text-white p-1 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleIncomeAllocation} className="p-6 overflow-y-auto text-xs">
              <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5">
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#7A8E7E]">Destino principal del ingreso</p>
                  <label className={`block border p-3 cursor-pointer ${incomeAllocationMode === 'general' ? 'border-[#1B3B2B] bg-emerald-50' : 'border-[#DDD5BF] bg-[#FAF8F5]'}`}>
                <input type="radio" checked={incomeAllocationMode === 'general'} onChange={() => setIncomeAllocationMode('general')} className="mr-2 accent-[#1B3B2B]" />
                <strong>Dejar como ingreso general</strong>
                <span className="block ml-5 mt-1 text-[#637568]">Permanece íntegro en Caja. No se acredita a ningún copropietario ni se aplica a gastos.</span>
              </label>
              <label className={`block border p-3 cursor-pointer ${incomeAllocationMode === 'all' ? 'border-[#1B3B2B] bg-emerald-50' : 'border-[#DDD5BF] bg-[#FAF8F5]'}`}>
                <input type="radio" checked={incomeAllocationMode === 'all'} onChange={() => setIncomeAllocationMode('all')} className="mr-2 accent-[#1B3B2B]" />
                <strong>Dividir entre todos los copropietarios</strong>
                <span className="block ml-5 mt-1 text-[#637568]">Acredita el importe proporcional según el porcentaje de participación de cada uno.</span>
              </label>
              <label className={`block border p-3 cursor-pointer ${incomeAllocationMode === 'one' ? 'border-[#1B3B2B] bg-emerald-50' : 'border-[#DDD5BF] bg-[#FAF8F5]'}`}>
                <input type="radio" checked={incomeAllocationMode === 'one'} onChange={() => setIncomeAllocationMode('one')} className="mr-2 accent-[#1B3B2B]" />
                <strong>Acreditar a un solo copropietario</strong>
                <span className="block ml-5 mt-1 text-[#637568]">El ingreso se registra completo en la cuenta corriente de la persona elegida.</span>
              </label>
              {incomeAllocationMode === 'one' && (
                <select value={incomeAllocationUserId} onChange={(e) => setIncomeAllocationUserId(e.target.value)} className="w-full p-2.5 bg-white border border-[#DCD4C0] font-semibold focus:outline-none">
                  <option value="">Seleccionar copropietario…</option>
                  {activeOwners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} ({owner.partName})</option>)}
                </select>
              )}
              <label className={`block border p-3 cursor-pointer ${incomeAllocationMode === 'expenses' ? 'border-[#1B3B2B] bg-emerald-50' : 'border-[#DDD5BF] bg-[#FAF8F5]'}`}>
                <input type="radio" checked={incomeAllocationMode === 'expenses'} onChange={() => setIncomeAllocationMode('expenses')} className="mr-2 accent-[#1B3B2B]" />
                <strong>Aplicar a gastos registrados</strong>
                <span className="block ml-5 mt-1 text-[#637568]">Definí ahora qué porcentaje de este ingreso se destina a cada gasto cargado.</span>
              </label>
                </div>
                <div className="min-w-0">
              {incomeAllocationMode === 'expenses' && (() => {
                const selectedPct = Object.values(incomeExpensePercentages).reduce((sum, percentage) => sum + (Number(percentage) || 0), 0);
                const alreadyApplied = cashFlows
                  .filter((transaction) => transaction.id.startsWith(`cf-income-spend-${incomeForAllocation.id}-`))
                  .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
                const availableAmount = Math.max(0, incomeForAllocation.amount - alreadyApplied);
                const remainingPct = incomeForAllocation.amount > 0 ? Math.max(0, (availableAmount / incomeForAllocation.amount) * 100) : 0;
                return (
                  <div className="border border-blue-200 bg-blue-50 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold text-[#163323]">Asignación del ingreso a gastos</span>
                      <span className={`font-mono font-bold ${selectedPct > remainingPct + 0.01 ? 'text-red-700' : 'text-blue-900'}`}>{selectedPct.toFixed(2)}% elegido · ${(incomeForAllocation.amount * selectedPct / 100).toLocaleString()} ARS</span>
                    </div>
                    <p className="text-[11px] text-[#526657]">Disponible de este ingreso: ${availableAmount.toLocaleString()} ARS ({remainingPct.toFixed(2)}%). El saldo no asignado queda como dinero general en Caja.</p>
                    <div className="flex flex-wrap items-center gap-2 border-y border-blue-200 py-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#526657]">Cargar cada gasto por:</span>
                      <button
                        type="button"
                        onClick={() => setIncomeExpenseEntryMode('amount')}
                        className={`px-3 py-1.5 border text-[11px] font-bold cursor-pointer ${incomeExpenseEntryMode === 'amount' ? 'bg-[#1B3B2B] border-[#1B3B2B] text-white' : 'bg-white border-[#DCD4C0] text-[#526657]'}`}
                      >
                        Monto (ARS)
                      </button>
                      <button
                        type="button"
                        onClick={() => setIncomeExpenseEntryMode('percentage')}
                        className={`px-3 py-1.5 border text-[11px] font-bold cursor-pointer ${incomeExpenseEntryMode === 'percentage' ? 'bg-[#1B3B2B] border-[#1B3B2B] text-white' : 'bg-white border-[#DCD4C0] text-[#526657]'}`}
                      >
                        Porcentaje (%)
                      </button>
                      <span className="text-[10px] text-[#637568]">Ejemplo: para pagar veinticinco mil, escribí 25000 en Monto (ARS).</span>
                    </div>
                    {payableInvoices.length === 0 ? (
                      <p className="text-[11px] text-[#637568] py-2">No hay gastos cargados con saldo pendiente.</p>
                    ) : payableInvoices.map(({ expense, isOwnerAdvance, pendingAmount }) => {
                      const percentage = Number(incomeExpensePercentages[expense.id]) || 0;
                      const amount = Math.round((incomeForAllocation.amount * percentage / 100) * 100) / 100;
                      const maxPctForExpense = incomeForAllocation.amount > 0 ? Math.min(100, (pendingAmount / incomeForAllocation.amount) * 100) : 0;
                      const maxAmountForExpense = Math.min(pendingAmount, incomeForAllocation.amount);
                      const isAmountEntry = incomeExpenseEntryMode === 'amount';
                      const displayedValue = isAmountEntry ? amount : percentage;
                      return (
                        <div key={expense.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_180px] gap-4 items-center bg-white border border-blue-100 p-3.5">
                          <div>
                            <strong className="block text-[#163323]">{expense.concept}</strong>
                            <span className="block mt-1 text-[10px] text-[#637568]">{isOwnerAdvance ? `Adelanto de ${expense.userName || 'copropietario'} a reintegrar` : 'Factura de gasto'}</span>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                              <span className="text-amber-800">Pendiente: <strong>${pendingAmount.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS</strong></span>
                              <span className="text-emerald-800">Asignado: <strong>${amount.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS</strong></span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#526657] uppercase mb-1">{isAmountEntry ? 'Monto a aplicar (ARS)' : '% del ingreso'}</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max={isAmountEntry ? maxAmountForExpense : maxPctForExpense}
                                step={isAmountEntry ? '1' : '0.01'}
                                value={displayedValue || ''}
                                onChange={(e) => {
                                  const enteredValue = Math.max(0, Number(e.target.value) || 0);
                                  const cappedValue = Math.min(
                                    enteredValue,
                                    isAmountEntry ? maxAmountForExpense : maxPctForExpense
                                  );
                                  const nextPercentage = isAmountEntry && incomeForAllocation.amount > 0
                                    ? Math.round((cappedValue / incomeForAllocation.amount) * 100 * 1000000) / 1000000
                                    : cappedValue;
                                  setIncomeExpensePercentages({ ...incomeExpensePercentages, [expense.id]: nextPercentage });
                                }}
                                className="w-full p-2 border border-[#DCD4C0] bg-[#FAF8F5] font-mono font-bold focus:outline-none"
                                placeholder="0"
                              />
                              <span className="text-[#637568]">{isAmountEntry ? 'ARS' : '%'}</span>
                            </div>
                            <span className="mt-1 block text-[10px] text-[#637568]">Máximo: ${maxAmountForExpense.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS ({maxPctForExpense.toFixed(2)}%)</span>
                          </div>
                        </div>
                      );
                    })}
                    {(() => {
                      const selectedAmount = Math.round((incomeForAllocation.amount * selectedPct / 100) * 100) / 100;
                      const remainderAmount = Math.max(0, Math.round((availableAmount - selectedAmount) * 100) / 100);
                      return (
                        <div className="mt-3 border-t border-blue-200 pt-3 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="text-[#163323]">Saldo restante luego de gastos</strong>
                            <span className={`font-mono font-bold ${selectedAmount > availableAmount + 0.01 ? 'text-red-700' : 'text-emerald-800'}`}>${remainderAmount.toLocaleString()} ARS</span>
                          </div>
                          <p className="text-[11px] text-[#526657]">Elegí qué hacer con el saldo que no se destine a facturas o adelantos en esta misma operación.</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <label className={`border p-2 cursor-pointer text-[11px] ${incomeRemainderMode === 'general' ? 'bg-white border-[#1B3B2B]' : 'bg-blue-50 border-blue-100'}`}><input type="radio" checked={incomeRemainderMode === 'general'} onChange={() => setIncomeRemainderMode('general')} className="mr-1 accent-[#1B3B2B]" /><strong>Dejar general</strong></label>
                            <label className={`border p-2 cursor-pointer text-[11px] ${incomeRemainderMode === 'all' ? 'bg-white border-[#1B3B2B]' : 'bg-blue-50 border-blue-100'}`}><input type="radio" checked={incomeRemainderMode === 'all'} onChange={() => setIncomeRemainderMode('all')} className="mr-1 accent-[#1B3B2B]" /><strong>Dividir saldo</strong></label>
                            <label className={`border p-2 cursor-pointer text-[11px] ${incomeRemainderMode === 'one' ? 'bg-white border-[#1B3B2B]' : 'bg-blue-50 border-blue-100'}`}><input type="radio" checked={incomeRemainderMode === 'one'} onChange={() => setIncomeRemainderMode('one')} className="mr-1 accent-[#1B3B2B]" /><strong>Acreditar a uno</strong></label>
                          </div>
                          {incomeRemainderMode === 'one' && (
                            <select value={incomeRemainderUserId} onChange={(e) => setIncomeRemainderUserId(e.target.value)} className="w-full p-2 bg-white border border-[#DCD4C0] text-xs font-semibold focus:outline-none">
                              <option value="">Seleccionar copropietario para el saldo…</option>
                              {activeOwners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} ({owner.partName})</option>)}
                            </select>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
                </div>
              </div>
              <div className="pt-3 border-t border-[#EFEAE0] flex justify-end gap-3">
                <button type="button" onClick={() => setIncomeForAllocation(null)} className="px-4 py-2 text-xs font-semibold text-[#637568] cursor-pointer">Cancelar</button>
                <button type="submit" disabled={isSavingIncomeAllocation} className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] disabled:bg-[#637568] disabled:cursor-not-allowed text-white text-xs font-semibold uppercase tracking-wider cursor-pointer">{isSavingIncomeAllocation ? 'Guardando...' : incomeAllocationMode === 'expenses' ? 'Revisar y aplicar gastos' : 'Guardar decisión'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: APLICAR DINERO DE CAJA A GASTOS REGISTRADOS       */}
      {/* ========================================================= */}
      {isInvoicePaymentModalOpen && fullAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-3xl border border-[#DCD4C0] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold tracking-wide" style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}>Aplicar Dinero de Caja a Gastos y Adelantos</h3>
                <p className="text-[11px] text-[#C9D6CC] mt-0.5">
                  {incomeForExpensePayment
                    ? `Origen: ${incomeForExpensePayment.concept} · $${incomeForExpensePayment.amount.toLocaleString()} ARS`
                    : `Caja disponible: $${cajaBalanceGeneral.toLocaleString()} ARS`}
                  {' · '}Podés aplicar importes totales o parciales.
                </p>
              </div>
              <button onClick={() => { setIsInvoicePaymentModalOpen(false); setIncomeForExpensePayment(null); setPendingRemainderAllocation(null); }} className="text-[#C9D6CC] hover:text-white p-1 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handlePayInvoicesFromCaja} className="p-5 sm:p-6 space-y-4 overflow-y-auto text-xs">
              {payableInvoices.length === 0 ? (
                <div className="py-10 text-center text-[#637568]">No hay gastos registrados con saldo pendiente para aplicar.</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold uppercase text-[#35483A] mb-1">Fecha de pago *</label>
                      <input type="date" required value={invoicePaymentDate} onChange={(e) => setInvoicePaymentDate(e.target.value)} className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold focus:outline-none" />
                    </div>
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200">
                      <span className="block font-bold uppercase text-[10px] text-emerald-900">Total a aplicar</span>
                      <span className="font-mono font-bold text-lg text-emerald-800">${Object.values(invoicePaymentAmounts).reduce((sum, amount) => sum + (Number(amount) || 0), 0).toLocaleString()} ARS</span>
                    </div>
                  </div>
                  {incomeForExpensePayment && (() => {
                    const alreadyUsed = cashFlows
                      .filter((transaction) => transaction.id.startsWith(`cf-income-spend-${incomeForExpensePayment.id}-`))
                      .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
                    const available = Math.max(0, incomeForExpensePayment.amount - alreadyUsed);
                    return <p className="text-[11px] text-blue-900 bg-blue-50 border border-blue-200 px-3 py-2">De este ingreso quedan <strong>${available.toLocaleString()} ARS</strong> disponibles para aplicar a gastos. El remanente seguirá como dinero general en Caja.</p>;
                  })()}

                  <div className="border border-[#E3DFC8] divide-y divide-[#EFEAE0]">
                    {payableInvoices.map(({ expense, isOwnerAdvance, paidAmount, pendingAmount }) => {
                      const selectedAmount = Number(invoicePaymentAmounts[expense.id]) || 0;
                      return (
                        <div key={expense.id} className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-3 items-center">
                          <div>
                            <strong className="text-sm text-[#163323]">{expense.concept}</strong>
                            <span className="block text-[11px] text-[#637568]">{isOwnerAdvance ? `Adelanto pagado por ${expense.userName || 'copropietario'} · se reintegra a esa persona` : `${expense.provider || 'Proveedor no informado'}${expense.invoiceNumber ? ` · Factura N° ${expense.invoiceNumber}` : ''}`}</span>
                            <span className="block mt-1 text-[11px] text-amber-800">Total: ${Number(expense.amount).toLocaleString()} · {isOwnerAdvance ? 'Reintegrado' : 'Ya pagado'}: ${paidAmount.toLocaleString()} · Pendiente: <strong>${pendingAmount.toLocaleString()}</strong></span>
                            {selectedAmount > 0 && (
                              <span className="block mt-1 text-[10px] text-blue-800">Se repartirá entre los copropietarios según su porcentaje de participación.</span>
                            )}
                          </div>
                          <div>
                            <label className="block font-semibold uppercase text-[#35483A] mb-1">{isOwnerAdvance ? 'Reintegrar ahora (ARS)' : 'Pagar ahora (ARS)'}</label>
                            <input
                              type="number"
                              min="0"
                              max={pendingAmount}
                              step="0.01"
                              value={selectedAmount || ''}
                              onChange={(e) => setInvoicePaymentAmounts({ ...invoicePaymentAmounts, [expense.id]: Math.min(pendingAmount, Math.max(0, Number(e.target.value) || 0)) })}
                              className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-bold text-sm focus:outline-none"
                              placeholder="0"
                            />
                            <button type="button" onClick={() => setInvoicePaymentAmounts({ ...invoicePaymentAmounts, [expense.id]: pendingAmount })} className="mt-1 text-[10px] font-bold text-[#1B3B2B] hover:underline cursor-pointer">Pagar total</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">Observaciones</label>
                    <textarea rows={2} value={invoicePaymentNotes} onChange={(e) => setInvoicePaymentNotes(e.target.value)} placeholder="Transferencia, número de comprobante u observación..." className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] focus:outline-none" />
                  </div>
                </>
              )}
              <div className="pt-3 border-t border-[#EFEAE0] flex items-center justify-end gap-3">
                <button type="button" onClick={() => { setIsInvoicePaymentModalOpen(false); setIncomeForExpensePayment(null); setPendingRemainderAllocation(null); }} className="px-4 py-2 text-xs font-semibold text-[#637568] hover:text-[#163323] cursor-pointer">Cancelar</button>
                {payableInvoices.length > 0 && <button type="submit" disabled={isConfirmingPayments} className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] disabled:bg-[#637568] disabled:cursor-not-allowed text-white text-xs font-semibold uppercase tracking-wider cursor-pointer flex items-center gap-2 shadow-xs"><Check className="w-4 h-4 text-[#BFA270]" /><span>{isConfirmingPayments ? 'Confirmando...' : 'Confirmar Pagos'}</span></button>}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: REGISTRAR MOVIMIENTO DE CAJA / INGRESO           */}
      {/* ========================================================= */}
      {isTransactionModalOpen && fullAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DCD4C0] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold tracking-wide" style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}>
                Registrar Movimiento de Caja / Ingreso
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
                    <option value="ingreso">Ingreso (Entrada de Dinero)</option>
                    <option value="egreso">Egreso (Salida de Dinero)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Categoría *</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value as CashFlowCategory)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-xs focus:outline-none uppercase"
                  >
                    <option value="otro_ingreso">Ingreso Común / Alquiler / Pastaje</option>
                    <option value="aporte_socio">Aporte de Socio / Cuota</option>
                    <option value="fondo_reserva">Fondo de Reserva</option>
                    <option value="pago_proveedor">Pago a Proveedor</option>
                    <option value="servicio">Servicio (Luz, Gas, etc.)</option>
                    <option value="mantenimiento">Mantenimiento</option>
                    <option value="otro_egreso">Otro Egreso</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Concepto o Detalle *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Cobro de Alquiler / Pastaje de campo ($1.000.000)"
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
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Destino / Vincular a Copropietario
                </label>
                <select
                  value={txLinkedUserId}
                  onChange={(e) => setTxLinkedUserId(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-xs focus:outline-none"
                >
                  <option value="">
                    🏛️ Ingreso General de Caja (sin destino asignado)
                  </option>
                  {users
                    .filter((u) => u.active !== false && u.role !== 'intendente')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        👤 {u.name} ({u.partName})
                      </option>
                    ))}
                </select>
                <span className="block text-[11px] text-[#7A8E7E] mt-1">
                  💡 El ingreso general queda en Caja sin distribuir. Después, desde su fila en el libro diario, Administración puede decidir si lo deja general, lo reparte, lo acredita a una persona o lo aplica a gastos cargados.
                </span>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Observaciones / Notas</label>
                <textarea
                  rows={2}
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder="Número de comprobante, transferencia, etc..."
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
                💡 <strong>Aviso:</strong> Como {currentUser.partName || 'Socio'}, al subir este gasto quedará acreditado a tu favor en tu cuenta particular y sujeto a aprobación de la administración.
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
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">👤 ¿Quién pagó el gasto?</label>
                  {fullAdmin ? (
                    <select
                      value={expPayerUserId}
                      onChange={(e) => setExpPayerUserId(e.target.value)}
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-semibold text-xs focus:outline-none"
                    >
                      <option value="">{currentUser.name} ({currentUser.partName}) [Tú]</option>
                      {users.filter((u) => u.id !== currentUser.id && u.active !== false).map((u) => (
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
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">🧾 N° Factura / Ticket</label>
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
      {reimburseModalUser && fullAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-md border border-[#DCD4C0] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold tracking-wide" style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}>
                Reintegro de Saldo a {reimburseModalUser.userName}
              </h3>
              <button onClick={() => setReimburseModalUser(null)} className="text-[#C9D6CC] hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteReimbursement} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-950 text-xs">
                Saldo total disponible a favor del socio: <strong>${reimburseModalUser.balanceDue.toLocaleString()} ARS</strong>.
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Monto a Reintegrar (ARS) *</label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  max={reimburseModalUser.balanceDue}
                  required
                  value={reimburseAmount || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setReimburseAmount(val);
                  }}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-bold text-base focus:outline-none text-[#163323]"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Concepto / Comprobante de Transferencia</label>
                <textarea
                  rows={2}
                  value={reimburseNotes}
                  onChange={(e) => setReimburseNotes(e.target.value)}
                  placeholder="ej. Transferencia bancaria Banco Galicia N° 821940"
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] focus:outline-none"
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
