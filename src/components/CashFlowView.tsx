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
      const [freshCF, freshExp, freshFees] = await Promise.all([
        storageService.fetchCashFlowFromDatabase(),
        storageService.fetchExpensesFromDatabase(),
        storageService.fetchFeesFromDatabase(),
      ]);
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
    if (!canViewGeneral && activeTabSub !== 'mi_cuenta') {
      setActiveTabSub('mi_cuenta');
    }
  }, [canViewGeneral, activeTabSub]);

  // Combine registered cash flows with all approved/paid expenses from Gastos
  const effectiveCashFlows = useMemo(() => {
    // Los movimientos "ledger-" representan saldo entre el proyecto y un socio,
    // no dinero que haya ingresado o salido físicamente de Caja/Banco.
    const list = cashFlows.filter((transaction) => !transaction.id.startsWith('ledger-'));
    expenses
      .filter(
        (e) =>
          (e.approvalStatus === 'approved' || e.status === 'paid' || !e.approvalStatus) &&
          e.approvalStatus !== 'rejected' &&
          // Si un socio pagó de su bolsillo, la salida de dinero todavía no fue
          // de Caja/Banco: queda registrada como adelanto a su favor.
          (e.reimbursementStatus === 'not_applicable' || !e.userId)
      )
      .forEach((e) => {
        const alreadyInCashFlow = list.some((t) => t.expenseId === e.id || t.id === `cf-exp-${e.id}`);
        if (!alreadyInCashFlow) {
          list.push({
            id: `cf-exp-${e.id}`,
            type: 'egreso',
            category: (e.category === 'servicios' ? 'servicio' : e.category === 'mantenimiento' ? 'mantenimiento' : 'pago_proveedor') as CashFlowCategory,
            concept: `${e.concept}${e.provider ? ` (${e.provider})` : ''}`,
            amount: Number(e.amount),
            currency: e.currency || 'ARS',
            date: e.date,
            userId: e.userId,
            userName: e.userName,
            partName: e.partName,
            expenseId: e.id,
            notes: e.invoiceNumber ? `Factura N° ${e.invoiceNumber}` : (e.notes || 'Gasto auditado del fideicomiso'),
            createdBy: e.createdBy || e.userName || 'Sistema Gastos',
            createdAt: e.createdAt || e.date,
          });
        }
      });
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [cashFlows, expenses]);

  // Helper: Share Percentage of an owner
  const getOwnerSharePct = (u: User): number => {
    if (typeof u.sharePercentage === 'number' && u.sharePercentage > 0) {
      return u.sharePercentage;
    }
    return 6.25; // 100% / 16 copropietarios
  };

  // Common Incomes (no specific user linked -> distributed proportionally)
  const commonIncomes = useMemo(() => {
    return effectiveCashFlows.filter(
      (t) => t.type === 'ingreso' && (!t.userId || t.userId === '')
    );
  }, [effectiveCashFlows]);

  // Global cash totals (for General Account)
  const totalIngresosGeneral = effectiveCashFlows
    .filter((t) => t.type === 'ingreso')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalEgresosGeneral = effectiveCashFlows
    .filter((t) => t.type === 'egreso')
    .reduce((sum, t) => sum + t.amount, 0);

  const cajaBalanceGeneral = totalIngresosGeneral - totalEgresosGeneral;

  // Compute particular account details for all eligible owners
  const activeOwners = users.filter((u) => u.active !== false && u.role !== 'intendente');
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

    // 1. Proportional share from common incomes (e.g. 6.25% of 1,000,000 = 62,500)
    const distributedIncome = commonIncomes.reduce(
      (sum, t) => sum + Math.round(t.amount * (sharePct / 100)),
      0
    );

    // 2. Direct personal incomes
    const directIncomes = cashFlows.filter(
      (t) =>
        t.type === 'ingreso' &&
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

    // 6. Net available balance in owner's particular account
    // (+) Incomes credited + (+) Expenses advanced - (-) Reimbursements - (-) Auto debits applied
    const totalCredited = totalUserIncome + totalAdvanced;
    const totalDeductions = totalReimbursed + totalAutoDebited;
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
      netAvailableBalance: 0,
      totalPendingDebt: 0,
      pendingAllocations: [],
      autoDebitedAllocations: [],
      pendingExpensesCount: 0,
      isAutoDebitOn: true,
    };

  // Toggle Auto Debit
  const handleToggleAutoDebit = (userId: string) => {
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

    // If it's a common income (no single owner linked), distribute and auto-debit pending fees
    if (txType === 'ingreso' && !linkedUser) {
      const activeOwnersList = users.filter((u) => u.active !== false && u.role !== 'intendente');
      let debitedTotalAll = 0;
      let affectedCount = 0;

      for (const owner of activeOwnersList) {
        if (storageService.isAutoDebitEnabled(owner.id)) {
          const ownerPct = getOwnerSharePct(owner);
          const ownerCredit = Math.round(Number(txAmount) * (ownerPct / 100));
          if (ownerCredit > 0) {
            const result = await storageService.executeAutoDebitForUser(owner.id, ownerCredit);
            if (result.debitedTotal > 0) {
              debitedTotalAll += result.debitedTotal;
              affectedCount++;
            }
          }
        }
      }

      if (debitedTotalAll > 0) {
        alert(
          `Ingreso común de $${Number(txAmount).toLocaleString()} ARS distribuido a los copropietarios.\n\n` +
          `⚡ Se ejecutó débito automático para ${affectedCount} copropietario(s) con cuotas pendientes por un total de $${debitedTotalAll.toLocaleString()} ARS.`
        );
      } else {
        alert(
          `Ingreso común de $${Number(txAmount).toLocaleString()} ARS registrado con éxito.\n` +
          `Se acreditó a cada copropietario la parte proporcional según su porcentaje de participación.`
        );
      }
    }

    setIsTransactionModalOpen(false);
    setTxConcept('');
    setTxAmount(0);
    setTxNotes('');
    setTxLinkedUserId('');
    await syncData();
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
  const personalMovements = [
    // Common incomes distributed
    ...commonIncomes.map((t) => {
      const shareAmount = Math.round(t.amount * (myAccount.sharePct / 100));
      return {
        id: `dist-${t.id}`,
        date: t.date,
        type: 'ingreso' as CashFlowType,
        category: 'Ingreso Común Distribuido',
        concept: `Participación ${myAccount.sharePct.toFixed(2)}%: ${t.concept}`,
        amount: shareAmount,
        notes: `Total ingresado a caja común: $${t.amount.toLocaleString()} ARS`,
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
                ? 'Gestión Integral de Caja, Cuentas Generales y Particulares'
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
              ? 'Panel reservado para Administrador, Intendente y Fiduciario. Control de caja común, distribución de ingresos por porcentaje accionario, débitos automáticos y cuentas particulares.'
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
      {activeTabSub === 'mi_cuenta' && (
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs border-l-4 border-l-[#1B3B2B]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A8E7E] block">
                Saldo Total en Caja Común
              </span>
              <div className="text-2xl font-bold font-mono text-[#163323] mt-1">
                ${cajaBalanceGeneral.toLocaleString()} <span className="text-xs text-[#7A8E7E]">ARS</span>
              </div>
              <p className="text-[11px] text-[#526657] mt-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>Total ingresos generales menos egresos ejecutados</span>
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
          </div>

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
                                <div className="mt-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandTx(tx.id)}
                                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-2xs text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                                      isExpanded
                                        ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                                    }`}
                                    title="Ver distribución por porcentaje entre los 16 socios"
                                  >
                                    <Coins className="w-3 h-3 text-[#BFA270]" />
                                    <span>Distribuido entre los 16 copropietarios por porcentaje</span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                                    )}
                                  </button>
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

                          {/* DESPLEGABLE CON LA TABLA DE DISTRIBUCIÓN POR COPROPIETARIO */}
                          {isCommon && isExpanded && (
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
                                        Acreditación porcentual automática según las acciones de cada uno de los 16 copropietarios:
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
                                          const shareThisTx = Math.round(tx.amount * (acc.sharePct / 100));
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
              Consulte la cuenta particular de cada socio: sus gastos adelantados, sus ingresos comunes acreditados por porcentaje accionario, débitos automáticos aplicados a expensas y reintegros emitidos desde caja común.
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

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 bg-[#FAF8F5] border border-[#E8E2D2]">
                        <span className="text-[10px] text-[#7A8E7E] block uppercase">Ingresos %</span>
                        <span className="font-mono font-bold text-emerald-800 text-sm">${acc.distributedIncome.toLocaleString()}</span>
                      </div>
                      <div className="p-2.5 bg-[#FAF8F5] border border-[#E8E2D2]">
                        <span className="text-[10px] text-[#7A8E7E] block uppercase">Adelantos</span>
                        <span className="font-mono font-bold text-[#163323] text-sm">${acc.totalAdvanced.toLocaleString()}</span>
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
                    🏛️ Ingreso Común General (Se divide por % entre los 16 copropietarios)
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
                  💡 Si seleccionás "Ingreso Común General", se acreditará a cada copropietario según su porcentaje (ej. 6.25%) y cancelará automáticamente cuotas pendientes con débito automático activo.
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
