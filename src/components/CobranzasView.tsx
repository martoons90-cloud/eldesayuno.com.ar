import React, { useState, useEffect } from 'react';
import { User, TrustSettings, FeeCollection, OwnerFeeAllocation, DistributionMode, RecurrenceType, PaymentStatus } from '../types';
import { storageService } from '../services/storageService';
import { r2Service } from '../services/r2Service';
import {
  DollarSign,
  CreditCard,
  Calendar,
  PieChart,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Upload,
  Copy,
  Check,
  FileText,
  ChevronDown,
  ChevronUp,
  Building,
  ArrowRight,
  Edit3,
  Trash2,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  X,
  Wallet,
} from 'lucide-react';

interface CobranzasViewProps {
  currentUser: User;
  users: User[];
  settings: TrustSettings;
  isAdmin: boolean;
}

export const CobranzasView: React.FC<CobranzasViewProps> = ({
  currentUser,
  users,
  settings,
  isAdmin,
}) => {
  const [feeCollections, setFeeCollections] = useState<FeeCollection[]>([]);
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'active' | 'completed' | 'my_pending'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);

  // Copy Feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<FeeCollection | null>(null);

  // Payment Recording Modal
  const [recordPaymentState, setRecordPaymentState] = useState<{
    open: boolean;
    collectionId: string;
    userAllocation: OwnerFeeAllocation | null;
  }>({
    open: false,
    collectionId: '',
    userAllocation: null,
  });

  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash' | 'check' | 'mercadopago' | 'other'>('transfer');
  const [paidAtDate, setPaidAtDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [isUploadingVoucher, setIsUploadingVoucher] = useState(false);

  // Load collections
  const loadCollections = () => {
    setFeeCollections(storageService.getFeeCollections());
  };

  useEffect(() => {
    loadCollections();
    const unsub = storageService.subscribe(loadCollections);
    return () => unsub();
  }, []);

  // Copy helper
  const handleCopyText = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Helper calculation for equal cabezas and equal owners
  const calculateAllocationsForMode = (
    mode: DistributionMode,
    total: number,
    allUsers: User[],
    customPercentages?: Record<string, number>,
    customAmounts?: Record<string, number>
  ): OwnerFeeAllocation[] => {
    const activeUsers = allUsers.filter((u) => u.active !== false);
    if (activeUsers.length === 0) return [];

    if (mode === 'equal_cabezas') {
      // Divided into 4 Cabezas equal parts (25% per Cabeza)
      // Group users by cabezaNumber (1, 2, 3, 4)
      const cabezaGroups: Record<number, User[]> = { 1: [], 2: [], 3: [], 4: [] };
      activeUsers.forEach((u) => {
        const cNum = u.cabezaNumber || 1;
        if (!cabezaGroups[cNum]) cabezaGroups[cNum] = [];
        cabezaGroups[cNum].push(u);
      });

      const allocations: OwnerFeeAllocation[] = [];
      const cabezasCount = 4;
      const amountPerCabeza = total / cabezasCount;
      const percentagePerCabeza = 100 / cabezasCount;

      [1, 2, 3, 4].forEach((cNum) => {
        const members = cabezaGroups[cNum] || [];
        if (members.length > 0) {
          const amountPerMember = Math.round((amountPerCabeza / members.length) * 100) / 100;
          const pctPerMember = Math.round((percentagePerCabeza / members.length) * 10000) / 10000;

          members.forEach((m) => {
            allocations.push({
              userId: m.id,
              userName: m.name,
              partName: m.partName,
              cabezaNumber: m.cabezaNumber,
              percentage: pctPerMember,
              assignedAmount: amountPerMember,
              paidAmount: 0,
              status: 'pending',
            });
          });
        }
      });
      return allocations;
    } else if (mode === 'equal_owners') {
      // Divided in N equal parts
      const N = activeUsers.length;
      const amountPerOwner = Math.round((total / N) * 100) / 100;
      const pctPerOwner = Math.round((100 / N) * 10000) / 10000;

      return activeUsers.map((m) => ({
        userId: m.id,
        userName: m.name,
        partName: m.partName,
        cabezaNumber: m.cabezaNumber,
        percentage: pctPerOwner,
        assignedAmount: amountPerOwner,
        paidAmount: 0,
        status: 'pending',
      }));
    } else if (mode === 'percentage') {
      return activeUsers.map((m) => {
        const pct = customPercentages?.[m.id] || 0;
        const assigned = Math.round((total * (pct / 100)) * 100) / 100;
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
        const assigned = customAmounts?.[m.id] || 0;
        const pct = total > 0 ? Math.round((assigned / total) * 10000) / 100 : 0;
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

  // Open Payment Recording Modal
  const handleOpenRecordPayment = (collectionId: string, alloc: OwnerFeeAllocation) => {
    setRecordPaymentState({
      open: true,
      collectionId,
      userAllocation: alloc,
    });
    setPaymentAmount(alloc.assignedAmount);
    setPaymentStatus(alloc.status === 'pending' ? 'paid' : alloc.status);
    setPaymentMethod(alloc.paymentMethod || 'transfer');
    setPaidAtDate(alloc.paidAt || new Date().toISOString().split('T')[0]);
    setPaymentNotes(alloc.notes || '');
    setReceiptUrl(alloc.receiptUrl || '');
  };

  // Save Payment
  const handleSavePaymentRecord = () => {
    if (!recordPaymentState.userAllocation) return;

    storageService.updateOwnerAllocationStatus(
      recordPaymentState.collectionId,
      recordPaymentState.userAllocation.userId,
      {
        assignedAmount: recordPaymentState.userAllocation.assignedAmount,
        paidAmount: paymentAmount,
        status: paymentStatus,
        paidAt: paidAtDate,
        paymentMethod,
        notes: paymentNotes,
        receiptUrl,
      }
    );

    setRecordPaymentState({ open: false, collectionId: '', userAllocation: null });
  };

  // Upload Voucher / Receipt
  const handleVoucherFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingVoucher(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await r2Service.uploadPhoto(base64, `voucher-${Date.now()}-${file.name}`, 'comprobantes');
        if (res.success && res.url) {
          setReceiptUrl(res.url);
        } else {
          setReceiptUrl(base64);
        }
      } catch {
        setReceiptUrl(base64);
      } finally {
        setIsUploadingVoucher(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Filter collections
  const filteredCollections = feeCollections.filter((c) => {
    // Search
    const matchesSearch =
      c.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.allocations.some((a) => a.userName.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // Category
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;

    // Active Tab Filter
    if (activeTabFilter === 'active') return c.status === 'active';
    if (activeTabFilter === 'completed') return c.status === 'completed';
    if (activeTabFilter === 'my_pending') {
      return c.allocations.some(
        (a) => a.userId === currentUser.id && (a.status === 'pending' || a.status === 'overdue' || a.status === 'partial')
      );
    }

    return true;
  });

  // Calculate Metrics
  const totalCollectionsAmount = feeCollections.reduce((sum, c) => sum + c.totalAmount, 0);
  const totalCollectedAmount = feeCollections.reduce((sum, c) => {
    return sum + c.allocations.reduce((aSum, a) => aSum + (a.paidAmount || 0), 0);
  }, 0);
  const totalPendingAmount = totalCollectionsAmount - totalCollectedAmount;
  const overallCollectionProgress = totalCollectionsAmount > 0
    ? Math.round((totalCollectedAmount / totalCollectionsAmount) * 100)
    : 100;

  // My pending fees summary
  const myPendingAllocations = feeCollections.flatMap((c) =>
    c.allocations
      .filter((a) => a.userId === currentUser.id && a.status !== 'paid')
      .map((a) => ({ collection: c, allocation: a }))
  );
  const myTotalPending = myPendingAllocations.reduce((sum, item) => sum + (item.allocation.assignedAmount - item.allocation.paidAmount), 0);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-5 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-[#FAF8F5] to-transparent pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-[#1B3B2B] text-[#FAF8F5] font-mono text-[10px] font-bold uppercase tracking-wider">
                Fideicomiso El Desayuno
              </span>
              <span className="text-xs font-medium text-[#637568]">● Módulo de Cobranzas y Expensas</span>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-bold text-[#163323]"
              style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
            >
              Gestión de Cobranzas y Gastos
            </h1>
            <p className="text-xs sm:text-sm text-[#46574B] mt-1 max-w-2xl">
              Control transparente de expensas ordinarias, fondos extraordinarios y servicios. Distribución de cuotas por Cabezas o partes en partes iguales o proporcionales.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                onClick={() => {
                  setEditingCollection(null);
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-[#FAF8F5] text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#BFA270]" />
                <span>+ Nueva Cobranza</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CBU & Bank Account Box */}
      <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[#1B3B2B] text-[#BFA270] rounded flex items-center justify-center shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#163323] uppercase tracking-wider">
              Datos Bancarios para Transferencias de Cuotas
            </p>
            <p className="text-xs text-[#56685B] mt-0.5">
              Titular: <span className="font-semibold text-[#163323]">{settings.titularCuenta || 'Fideicomiso Estancia El Desayuno'}</span>
              {settings.cuitFideicomiso && <span className="ml-2">• CUIT: <span className="font-mono">{settings.cuitFideicomiso}</span></span>}
              {settings.bancoNombre && <span className="ml-2">• Banco: <span className="font-semibold text-[#163323]">{settings.bancoNombre}</span></span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {settings.cbu && (
            <button
              onClick={() => handleCopyText(settings.cbu!, 'cbu')}
              className="px-3 py-1.5 bg-white border border-[#DDD5BF] hover:border-[#1B3B2B] text-xs font-mono font-medium text-[#163323] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copiar CBU al portapapeles"
            >
              {copiedField === 'cbu' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-sans font-bold">¡CBU Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>CBU: {settings.cbu}</span>
                </>
              )}
            </button>
          )}

          {settings.aliasBancario && (
            <button
              onClick={() => handleCopyText(settings.aliasBancario!, 'alias')}
              className="px-3 py-1.5 bg-[#1B3B2B] text-[#FAF8F5] hover:bg-[#132A1F] text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copiar ALIAS Bancario"
            >
              {copiedField === 'alias' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-sans font-bold">¡Alias Copiado!</span>
                </>
              ) : (
                <>
                  <Wallet className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>ALIAS: {settings.aliasBancario}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E3DFC8] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#637568] font-semibold uppercase tracking-wider mb-2">
            <span>Total Emitido</span>
            <DollarSign className="w-4 h-4 text-[#163323]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#163323]">
            ${totalCollectionsAmount.toLocaleString()} <span className="text-xs font-sans text-[#7A8E7E]">ARS</span>
          </div>
          <p className="text-[11px] text-[#7A8E7E] mt-1">
            {feeCollections.length} cobranzas registradas
          </p>
        </div>

        <div className="bg-white border border-[#E3DFC8] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold uppercase tracking-wider mb-2">
            <span>Recaudado / Cobrado</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700">
            ${totalCollectedAmount.toLocaleString()} <span className="text-xs font-sans text-emerald-600">ARS</span>
          </div>
          <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-emerald-600 h-full transition-all duration-500"
              style={{ width: `${overallCollectionProgress}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-[#E3DFC8] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-amber-800 font-semibold uppercase tracking-wider mb-2">
            <span>Pendiente de Cobro</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-700">
            ${totalPendingAmount.toLocaleString()} <span className="text-xs font-sans text-amber-600">ARS</span>
          </div>
          <p className="text-[11px] text-amber-700 mt-1 font-medium">
            {100 - overallCollectionProgress}% por cobrar
          </p>
        </div>

        <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#163323] font-semibold uppercase tracking-wider mb-2">
            <span>Mi Estado Personal</span>
            <Users className="w-4 h-4 text-[#BFA270]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#163323]">
            {myTotalPending > 0 ? (
              <span className="text-amber-700">${myTotalPending.toLocaleString()} ARS</span>
            ) : (
              <span className="text-emerald-700 flex items-center gap-1">
                <Check className="w-5 h-5 text-emerald-600" /> $0 (Al día)
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#637568] mt-1">
            {myPendingAllocations.length > 0
              ? `${myPendingAllocations.length} cuota(s) pendiente(s)`
              : 'Sin cuotas adeudadas'}
          </p>
        </div>
      </div>

      {/* Main Filter & Search Toolbar */}
      <div className="bg-white border border-[#E3DFC8] p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        {/* Navigation Filter Tabs */}
        <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveTabFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors cursor-pointer ${
              activeTabFilter === 'all'
                ? 'bg-[#1B3B2B] text-white'
                : 'text-[#56685B] hover:bg-[#F4EFE6]'
            }`}
          >
            Todas ({feeCollections.length})
          </button>
          <button
            onClick={() => setActiveTabFilter('active')}
            className={`px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors cursor-pointer ${
              activeTabFilter === 'active'
                ? 'bg-[#1B3B2B] text-white'
                : 'text-[#56685B] hover:bg-[#F4EFE6]'
            }`}
          >
            En Curso ({feeCollections.filter((c) => c.status === 'active').length})
          </button>
          <button
            onClick={() => setActiveTabFilter('completed')}
            className={`px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors cursor-pointer ${
              activeTabFilter === 'completed'
                ? 'bg-[#1B3B2B] text-white'
                : 'text-[#56685B] hover:bg-[#F4EFE6]'
            }`}
          >
            Completadas ({feeCollections.filter((c) => c.status === 'completed').length})
          </button>
          <button
            onClick={() => setActiveTabFilter('my_pending')}
            className={`px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors cursor-pointer ${
              activeTabFilter === 'my_pending'
                ? 'bg-[#2563EB] text-white'
                : 'text-blue-800 hover:bg-blue-50'
            }`}
          >
            Mis Cuotas Pendientes ({myPendingAllocations.length})
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-[#7A8E7E] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por concepto o usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-medium text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
          >
            <option value="all">Todas las Categorías</option>
            <option value="expensas_ordinarias">Expensas Ordinarias</option>
            <option value="obras_extraordinarias">Obras Extraordinarias</option>
            <option value="servicios">Servicios y Mantenimiento</option>
            <option value="impuestos">Impuestos y Tasas</option>
            <option value="otro">Otros Gastos</option>
          </select>
        </div>
      </div>

      {/* Fee Collections Accordion List */}
      <div className="space-y-4">
        {filteredCollections.length === 0 ? (
          <div className="bg-white border border-[#E3DFC8] p-8 text-center">
            <CreditCard className="w-10 h-10 text-[#BFA270] mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold text-[#163323]">No se encontraron cobranzas registradas</p>
            <p className="text-xs text-[#637568] mt-1">
              Pruebe ajustando los filtros de búsqueda o cree una nueva emisión de cobranza.
            </p>
          </div>
        ) : (
          filteredCollections.map((collection) => {
            const isExpanded = expandedCollectionId === collection.id;
            const collectedAmount = collection.allocations.reduce((sum, a) => sum + (a.paidAmount || 0), 0);
            const progressPct = Math.round((collectedAmount / collection.totalAmount) * 100);
            const paidCount = collection.allocations.filter((a) => a.status === 'paid').length;
            const myAlloc = collection.allocations.find((a) => a.userId === currentUser.id);

            // Recurrence Badge
            const getRecurrenceLabel = (rec: RecurrenceType, days?: number) => {
              switch (rec) {
                case 'monthly':
                  return 'Mensual (Cada 30 días)';
                case 'days_45':
                  return 'Cada 45 días';
                case 'days_60':
                  return 'Cada 60 días';
                case 'custom_days':
                  return `Personalizado: Cada ${days || 30} días`;
                case 'one_time':
                  return 'Pago Único / Extraordinario';
                default:
                  return 'Periódico';
              }
            };

            // Distribution Mode Badge
            const getDistributionLabel = (mode: DistributionMode) => {
              switch (mode) {
                case 'equal_cabezas':
                  return 'Por Cabezas (4 partes)';
                case 'equal_owners':
                  return 'Partes Iguales por Copropietario (1/15)';
                case 'percentage':
                  return 'Porcentual Asignado';
                case 'custom_amount':
                  return 'Monto Fijo Individual';
                default:
                  return mode;
              }
            };

            return (
              <div
                key={collection.id}
                className="bg-white border border-[#E3DFC8] shadow-xs overflow-hidden transition-all"
              >
                {/* Collection Summary Header */}
                <div className="p-4 bg-white hover:bg-[#FAF8F5] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E3DFC8]">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#1B3B2B] text-[#FAF8F5] font-mono text-[10px] font-bold uppercase tracking-wider">
                        {collection.category.replace('_', ' ')}
                      </span>

                      <span className="px-2 py-0.5 bg-[#F4EFE6] border border-[#DDD5BF] text-[10px] font-bold text-[#163323] flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5 text-[#BFA270]" />
                        {getRecurrenceLabel(collection.recurrence, collection.customRecurrenceDays)}
                      </span>

                      <span className="px-2 py-0.5 bg-[#F4EFE6] border border-[#DDD5BF] text-[10px] font-medium text-[#56685B]">
                        {getDistributionLabel(collection.distributionMode)}
                      </span>

                      {collection.status === 'completed' ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                          100% Cobrado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold uppercase tracking-wider">
                          En Cobranza ({progressPct}%)
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-[#163323]">
                      {collection.concept}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-[#637568]">
                      <span>Emisión: <strong className="text-[#163323] font-mono">{collection.issueDate}</strong></span>
                      <span>Vencimiento: <strong className="text-[#163323] font-mono">{collection.dueDate}</strong></span>
                      {collection.notes && <span className="italic text-[#7A8E7E]">"{collection.notes}"</span>}
                    </div>
                  </div>

                  {/* Financial Breakdown Summary */}
                  <div className="flex flex-wrap lg:flex-nowrap items-center gap-6 border-t lg:border-t-0 pt-3 lg:pt-0 border-[#E3DFC8]">
                    <div className="text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#7A8E7E]">Monto Total</div>
                      <div className="text-lg font-bold font-mono text-[#163323]">
                        ${collection.totalAmount.toLocaleString()} {collection.currency}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-medium">
                        ${collectedAmount.toLocaleString()} cobrados
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#7A8E7E]">Copropietarios</div>
                      <div className="text-sm font-bold text-[#163323]">
                        {paidCount} / {collection.allocations.length} al día
                      </div>
                      <div className="text-[11px] text-amber-700 font-medium">
                        {collection.allocations.length - paidCount} pendientes
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {myAlloc && myAlloc.status !== 'paid' && (
                        <button
                          onClick={() => handleOpenRecordPayment(collection.id, myAlloc)}
                          className="px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Informar Mi Pago (${(myAlloc.assignedAmount - myAlloc.paidAmount).toLocaleString()})</span>
                        </button>
                      )}

                      <button
                        onClick={() => setExpandedCollectionId(isExpanded ? null : collection.id)}
                        className="px-3 py-1.5 bg-[#F4EFE6] hover:bg-[#EFE9DB] border border-[#DDD5BF] text-xs font-bold text-[#163323] transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>{isExpanded ? 'Ocultar Detalle' : 'Ver Padrón Completo'}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => {
                            if (confirm('¿Desea eliminar esta orden de cobranza?')) {
                              storageService.deleteFeeCollection(collection.id);
                            }
                          }}
                          className="p-1.5 text-neutral-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Eliminar Cobranza"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-neutral-100 h-1">
                  <div
                    className="bg-[#1B3B2B] h-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Expanded Detail Table of All 15 Owners */}
                {isExpanded && (
                  <div className="p-4 bg-[#FAF8F5] border-t border-[#E3DFC8] space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#163323] uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#BFA270]" />
                        Padrón de Distribución y Estado de Pago Individual ({collection.allocations.length} Copropietarios)
                      </h4>

                      <span className="text-[11px] text-[#637568]">
                        Modo de división: <strong>{getDistributionLabel(collection.distributionMode)}</strong>
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-[#E3DFC8] bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#1B3B2B] text-[#FAF8F5] font-mono text-[11px]">
                          <tr>
                            <th className="py-2 px-3">Copropietario</th>
                            <th className="py-2 px-3">Cabeza / Parte</th>
                            <th className="py-2 px-3 text-right">% Asignado</th>
                            <th className="py-2 px-3 text-right">Monto Cuota ($)</th>
                            <th className="py-2 px-3 text-right">Monto Pagado ($)</th>
                            <th className="py-2 px-3 text-center">Estado</th>
                            <th className="py-2 px-3">Método / Fecha</th>
                            <th className="py-2 px-3 text-center">Comprobante</th>
                            <th className="py-2 px-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E3DFC8]">
                          {collection.allocations.map((alloc) => {
                            const isMe = alloc.userId === currentUser.id;

                            return (
                              <tr
                                key={alloc.userId}
                                className={`hover:bg-[#FAF8F5] transition-colors ${
                                  isMe ? 'bg-amber-50/60 font-medium' : ''
                                }`}
                              >
                                <td className="py-2 px-3 font-semibold text-[#163323] flex items-center gap-1.5">
                                  <span>{alloc.userName}</span>
                                  {isMe && (
                                    <span className="px-1.5 py-0.2 bg-[#1B3B2B] text-white text-[9px] uppercase rounded">
                                      Tú
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-[#56685B]">{alloc.partName}</td>
                                <td className="py-2 px-3 text-right font-mono text-[#56685B]">
                                  {alloc.percentage.toFixed(2)}%
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-[#163323]">
                                  ${alloc.assignedAmount.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                                  ${alloc.paidAmount.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {alloc.status === 'paid' && (
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded-full">
                                      Pagado
                                    </span>
                                  )}
                                  {alloc.status === 'pending' && (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded-full">
                                      Pendiente
                                    </span>
                                  )}
                                  {alloc.status === 'partial' && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold uppercase rounded-full">
                                      Parcial
                                    </span>
                                  )}
                                  {alloc.status === 'overdue' && (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold uppercase rounded-full">
                                      Vencido
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-[#637568] text-[11px]">
                                  {alloc.paidAt ? (
                                    <div>
                                      <span className="font-mono">{alloc.paidAt}</span>
                                      {alloc.paymentMethod && <span className="block text-[10px] uppercase text-[#7A8E7E]">{alloc.paymentMethod}</span>}
                                    </div>
                                  ) : (
                                    <span className="text-neutral-400 italic">Sin fecha</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {alloc.receiptUrl ? (
                                    <a
                                      href={alloc.receiptUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-[#2563EB] hover:underline font-semibold flex items-center justify-center gap-1"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span>Ver</span>
                                    </a>
                                  ) : (
                                    <span className="text-neutral-300">-</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {(isAdmin || isMe) && (
                                    <button
                                      onClick={() => handleOpenRecordPayment(collection.id, alloc)}
                                      className="px-2 py-1 bg-white border border-[#DDD5BF] hover:border-[#1B3B2B] text-[11px] font-semibold text-[#163323] transition-colors cursor-pointer"
                                    >
                                      {isAdmin ? 'Editar Pago' : 'Cargar Pago'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create or Edit Fee Collection */}
      {isCreateModalOpen && (
        <CreateFeeCollectionModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          users={users}
          currentUser={currentUser}
          onSave={(col) => {
            storageService.saveFeeCollection(col);
            setIsCreateModalOpen(false);
          }}
          calculateAllocationsForMode={calculateAllocationsForMode}
        />
      )}

      {/* Modal: Record / Update Payment Details */}
      {recordPaymentState.open && recordPaymentState.userAllocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white border border-[#E3DFC8] max-w-md w-full p-6 shadow-xl relative">
            <button
              onClick={() => setRecordPaymentState({ open: false, collectionId: '', userAllocation: null })}
              className="absolute top-4 right-4 p-1 text-[#637568] hover:text-[#163323] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#1B3B2B] text-[#BFA270] rounded flex items-center justify-center font-bold text-xs">
                $
              </div>
              <div>
                <h3 className="text-base font-bold text-[#163323]">
                  Registrar Pago de Cuota
                </h3>
                <p className="text-xs text-[#637568]">
                  Copropietario: <strong>{recordPaymentState.userAllocation.userName}</strong> ({recordPaymentState.userAllocation.partName})
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#637568]">Cuota Asignada:</span>
                  <span className="font-mono font-bold text-[#163323]">
                    ${recordPaymentState.userAllocation.assignedAmount.toLocaleString()} ARS
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#637568]">Porcentaje de la Cobranza:</span>
                  <span className="font-mono text-[#56685B]">
                    {recordPaymentState.userAllocation.percentage.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">Monto Pagado ($ ARS)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-sm font-bold text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163323] mb-1">Estado de Pago</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-semibold text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                  >
                    <option value="paid">Pagado (100%)</option>
                    <option value="pending">Pendiente</option>
                    <option value="partial">Parcial</option>
                    <option value="overdue">Vencido</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#163323] mb-1">Medio de Pago</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                  >
                    <option value="transfer">Transferencia Bancaria</option>
                    <option value="cash">Efectivo</option>
                    <option value="mercadopago">MercadoPago</option>
                    <option value="check">Cheque</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">Fecha de Pago</label>
                <input
                  type="date"
                  value={paidAtDate}
                  onChange={(e) => setPaidAtDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">Comprobante / Voucher (Foto o PDF)</label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-semibold text-[#163323] flex items-center justify-center gap-2 cursor-pointer hover:bg-[#F4EFE6] transition-colors">
                    <Upload className="w-4 h-4 text-[#BFA270]" />
                    <span>{isUploadingVoucher ? 'Subiendo...' : 'Adjuntar Comprobante'}</span>
                    <input type="file" accept="image/*,.pdf" onChange={handleVoucherFileUpload} className="hidden" />
                  </label>
                </div>
                {receiptUrl && (
                  <p className="text-[11px] text-emerald-700 font-medium mt-1 truncate">
                    ✓ Comprobante cargado correctamente
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">Notas o Referencia</label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Ej: Nro de comprobante o referencia de transferencia..."
                  className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E3DFC8]">
                <button
                  onClick={() => setRecordPaymentState({ open: false, collectionId: '', userAllocation: null })}
                  className="px-4 py-2 border border-[#DDD5BF] text-xs font-bold text-[#637568] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSavePaymentRecord}
                  className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
                >
                  Guardar Registro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for Creating Fee Collection
interface CreateFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  currentUser: User;
  onSave: (collection: FeeCollection) => void;
  calculateAllocationsForMode: (
    mode: DistributionMode,
    total: number,
    allUsers: User[],
    customPercentages?: Record<string, number>,
    customAmounts?: Record<string, number>
  ) => OwnerFeeAllocation[];
}

const CreateFeeCollectionModal: React.FC<CreateFeeModalProps> = ({
  onClose,
  users,
  currentUser,
  onSave,
  calculateAllocationsForMode,
}) => {
  const [concept, setConcept] = useState('');
  const [category, setCategory] = useState<FeeCollection['category']>('expensas_ordinarias');
  const [totalAmount, setTotalAmount] = useState<number>(1500000);
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('monthly');
  const [customRecurrenceDays, setCustomRecurrenceDays] = useState<number>(45);
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [distributionMode, setDistributionMode] = useState<DistributionMode>('equal_cabezas');
  const [notes, setNotes] = useState('');

  // Custom percentages & amounts mapping
  const [customPercentages, setCustomPercentages] = useState<Record<string, number>>({});
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});

  const activeUsers = users.filter((u) => u.active !== false);

  // Computed allocations for live preview
  const liveAllocations = calculateAllocationsForMode(
    distributionMode,
    totalAmount,
    activeUsers,
    customPercentages,
    customAmounts
  );

  const totalCalculatedPercentages = liveAllocations.reduce((s, a) => s + a.percentage, 0);
  const totalCalculatedAmounts = liveAllocations.reduce((s, a) => s + a.assignedAmount, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!concept.trim()) {
      alert('Por favor, ingrese un concepto claro para la cobranza.');
      return;
    }

    if (totalAmount <= 0) {
      alert('El monto total debe ser mayor a cero.');
      return;
    }

    const newCollection: FeeCollection = {
      id: 'fee-' + Date.now(),
      concept: concept.trim(),
      category,
      totalAmount,
      currency,
      recurrence,
      customRecurrenceDays: recurrence === 'custom_days' ? customRecurrenceDays : undefined,
      issueDate,
      dueDate,
      distributionMode,
      allocations: liveAllocations,
      status: 'active',
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
      notes: notes.trim(),
    };

    onSave(newCollection);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white border border-[#E3DFC8] max-w-3xl w-full p-6 shadow-xl relative my-8">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 text-[#637568] hover:text-[#163323] cursor-pointer">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4 border-b border-[#E3DFC8] pb-3">
          <div className="w-9 h-9 bg-[#1B3B2B] text-[#BFA270] rounded flex items-center justify-center font-bold">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#163323]">Nueva Emisión de Cobranza / Expensa</h2>
            <p className="text-xs text-[#637568]">Defina el monto total, periodicidad y forma de división entre los 15 copropietarios.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Concept and Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-[#163323] mb-1">Concepto de la Cobranza *</label>
              <input
                type="text"
                required
                placeholder="Ej: Expensas Ordinarias Noviembre 2026 - Mantenimiento General"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#163323] mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
              >
                <option value="expensas_ordinarias">Expensas Ordinarias</option>
                <option value="obras_extraordinarias">Obras Extraordinarias</option>
                <option value="servicios">Servicios y Mantenimiento</option>
                <option value="impuestos">Impuestos y Tasas</option>
                <option value="otro">Otro Concepto</option>
              </select>
            </div>
          </div>

          {/* Amount, Currency and Recurrence */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-[#163323] mb-1">Monto Total a Cobrar *</label>
              <div className="flex items-center">
                <span className="px-3 py-2 bg-[#EFE9DB] border border-r-0 border-[#DDD5BF] font-mono font-bold text-[#163323]">
                  $
                </span>
                <input
                  type="number"
                  required
                  min={1}
                  step={100}
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-sm font-bold text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#163323] mb-1">Moneda</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-bold text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
              >
                <option value="ARS">ARS ($ Pesos)</option>
                <option value="USD">USD ($ Dólares)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#163323] mb-1">Periodicidad / Recurrencia</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
              >
                <option value="monthly">Mensual (Cada 30 días)</option>
                <option value="days_45">Cada 45 Días</option>
                <option value="days_60">Cada 60 Días</option>
                <option value="custom_days">Personalizar Días</option>
                <option value="one_time">Pago Único / Extraordinario</option>
              </select>
            </div>
          </div>

          {/* Custom Days Input if custom_days selected */}
          {recurrence === 'custom_days' && (
            <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-3 flex items-center gap-3">
              <label className="font-bold text-[#163323]">Frecuencia de Cobro en Días:</label>
              <input
                type="number"
                min={1}
                max={365}
                value={customRecurrenceDays}
                onChange={(e) => setCustomRecurrenceDays(parseInt(e.target.value) || 30)}
                className="w-24 px-3 py-1 bg-white border border-[#DDD5BF] font-mono font-bold text-[#163323]"
              />
              <span className="text-xs text-[#637568]">Días entre cada cuota</span>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#163323] mb-1">Fecha de Emisión</label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-[#163323]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#163323] mb-1">Fecha Limite de Vencimiento</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-[#163323]"
              />
            </div>
          </div>

          {/* Distribution Mode */}
          <div>
            <label className="block font-bold text-[#163323] mb-1">Modo de División entre Copropietarios *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setDistributionMode('equal_cabezas')}
                className={`p-2.5 border text-left transition-all cursor-pointer ${
                  distributionMode === 'equal_cabezas'
                    ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                    : 'bg-[#FAF8F5] text-[#163323] border-[#DDD5BF] hover:bg-[#F4EFE6]'
                }`}
              >
                <div className="font-bold text-xs">Por Cabezas (25% x Cabeza)</div>
                <div className="text-[10px] opacity-80 mt-0.5">Divide el monto en 4 partes iguales (Cabeza 1, 2, 3, 4) y prorratea según integrantes.</div>
              </button>

              <button
                type="button"
                onClick={() => setDistributionMode('equal_owners')}
                className={`p-2.5 border text-left transition-all cursor-pointer ${
                  distributionMode === 'equal_owners'
                    ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                    : 'bg-[#FAF8F5] text-[#163323] border-[#DDD5BF] hover:bg-[#F4EFE6]'
                }`}
              >
                <div className="font-bold text-xs">Igual por Copropietario</div>
                <div className="text-[10px] opacity-80 mt-0.5">Divide el monto en 15 partes exactas iguales para todos ({ (100/15).toFixed(2) }% c/u).</div>
              </button>

              <button
                type="button"
                onClick={() => setDistributionMode('percentage')}
                className={`p-2.5 border text-left transition-all cursor-pointer ${
                  distributionMode === 'percentage'
                    ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                    : 'bg-[#FAF8F5] text-[#163323] border-[#DDD5BF] hover:bg-[#F4EFE6]'
                }`}
              >
                <div className="font-bold text-xs">Porcentaje Personalizado</div>
                <div className="text-[10px] opacity-80 mt-0.5">Permite ingresar un % específico para cada uno de los 15 copropietarios.</div>
              </button>

              <button
                type="button"
                onClick={() => setDistributionMode('custom_amount')}
                className={`p-2.5 border text-left transition-all cursor-pointer ${
                  distributionMode === 'custom_amount'
                    ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                    : 'bg-[#FAF8F5] text-[#163323] border-[#DDD5BF] hover:bg-[#F4EFE6]'
                }`}
              >
                <div className="font-bold text-xs">Monto Fijo Personalizado</div>
                <div className="text-[10px] opacity-80 mt-0.5">Permite ingresar un importe en pesos exacto para cada persona.</div>
              </button>
            </div>
          </div>

          {/* Inputs for Custom Percentage or Custom Amount */}
          {distributionMode === 'percentage' && (
            <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-3 space-y-2 max-h-48 overflow-y-auto">
              <div className="flex justify-between items-center font-bold text-[#163323]">
                <span>Ajustar Porcentajes Individuales:</span>
                <span className={`font-mono text-xs ${Math.abs(totalCalculatedPercentages - 100) < 0.1 ? 'text-emerald-700' : 'text-red-600'}`}>
                  Suma Total: {totalCalculatedPercentages.toFixed(2)}% / 100%
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activeUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 bg-white p-1.5 border border-[#DDD5BF]">
                    <span className="text-[11px] font-semibold text-[#163323] truncate flex-1">{u.name}</span>
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={100}
                      value={customPercentages[u.id] ?? 0}
                      onChange={(e) => setCustomPercentages({ ...customPercentages, [u.id]: parseFloat(e.target.value) || 0 })}
                      className="w-16 px-1 py-0.5 font-mono text-right border border-[#DDD5BF]"
                    />
                    <span className="text-[10px] text-[#7A8E7E]">%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {distributionMode === 'custom_amount' && (
            <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-3 space-y-2 max-h-48 overflow-y-auto">
              <div className="flex justify-between items-center font-bold text-[#163323]">
                <span>Ajustar Montos Individuales ($):</span>
                <span className={`font-mono text-xs ${totalCalculatedAmounts === totalAmount ? 'text-emerald-700' : 'text-amber-700'}`}>
                  Suma Montos: ${totalCalculatedAmounts.toLocaleString()} / ${totalAmount.toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activeUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 bg-white p-1.5 border border-[#DDD5BF]">
                    <span className="text-[11px] font-semibold text-[#163323] truncate flex-1">{u.name}</span>
                    <input
                      type="number"
                      step={1000}
                      min={0}
                      value={customAmounts[u.id] ?? 0}
                      onChange={(e) => setCustomAmounts({ ...customAmounts, [u.id]: parseFloat(e.target.value) || 0 })}
                      className="w-20 px-1 py-0.5 font-mono text-right border border-[#DDD5BF]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Calculated Breakdown Table Preview */}
          <div>
            <label className="block font-bold text-[#163323] mb-1">
              Previsualización de la Distribución Calculada ({liveAllocations.length} Copropietarios)
            </label>
            <div className="border border-[#E3DFC8] max-h-40 overflow-y-auto bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1B3B2B] text-white font-mono text-[10px] sticky top-0">
                  <tr>
                    <th className="p-1.5">Copropietario</th>
                    <th className="p-1.5">Cabeza</th>
                    <th className="p-1.5 text-right">% Asignado</th>
                    <th className="p-1.5 text-right">Monto Cuota ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3DFC8]">
                  {liveAllocations.map((alloc) => (
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
            <label className="block font-bold text-[#163323] mb-1">Observaciones o Instrucciones</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles adicionales, número de cuenta de destino o instrucciones de pago..."
              className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3DFC8]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#DDD5BF] text-xs font-bold text-[#637568] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
            >
              Emitir Cobranza
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
