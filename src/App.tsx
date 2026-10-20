/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { User, Booking, DateBlock, TrustSettings, NotificationPush, InventoryItem, IncidentReport, hasFinancialAccess, isUserIntendente, isUserAdmin, canViewGeneralFinancialAccount } from './types';
import { storageService } from './services/storageService';
import { LoginScreen } from './components/LoginScreen';
import { TopBar } from './components/TopBar';
import { OwnerQuotaSummary } from './components/OwnerQuotaSummary';
import { CalendarView } from './components/CalendarView';
import { BookingModal } from './components/BookingModal';
import { MyBookingsView } from './components/MyBookingsView';
import { HouseGuideView } from './components/HouseGuideView';
import { InventoryStockView } from './components/InventoryStockView';
import { IncidentReportsView } from './components/IncidentReportsView';
import { CobranzasView } from './components/CobranzasView';
import { ExpensesView } from './components/ExpensesView';
import { CashFlowView } from './components/CashFlowView';
import { ActasView } from './components/ActasView';
import { AdminPanel, AdminSectionType } from './components/AdminPanel';
import { UnifiedSettingsPanel, SettingsTabId } from './components/UnifiedSettingsPanel';
import { APP_VERSION } from './version';
import {
  PushNotificationToast,
  NotificationCenterDrawer,
} from './components/PushNotificationToast';
import {
  Calendar,
  Users,
  ShieldCheck,
  CalendarDays,
  FileSpreadsheet,
  Lock,
  ArrowUpRight,
  TrendingUp,
  Database,
  Image as ImageIcon,
  Boxes,
  AlertTriangle,
  DollarSign,
  CreditCard,
  Receipt,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<DateBlock[]>([]);
  const [settings, setSettings] = useState<TrustSettings>(storageService.getSettings());
  const [notifications, setNotifications] = useState<NotificationPush[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);

  // Navigation state
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [adminSection, setAdminSection] = useState<AdminSectionType>('reservations');
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'owner'>(() => {
    if (typeof window === 'undefined') return 'admin';
    return (localStorage.getItem('el_desayuno_admin_view_mode') as 'admin' | 'owner') || 'admin';
  });

  const handleToggleAdminViewMode = (mode: 'admin' | 'owner') => {
    setAdminViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('el_desayuno_admin_view_mode', mode);
    }
    setActiveTab('dashboard');
  };

  // Booking Modal State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [initialBookingDates, setInitialBookingDates] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  });

  // Notification Drawer State
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);

  // Sync with storage service
  const refreshData = () => {
    setUsers(storageService.getUsers());
    setBookings(storageService.getBookings());
    setBlocks(storageService.getBlocks());
    setSettings(storageService.getSettings());
    setNotifications(storageService.getNotifications());
    setInventory(storageService.getInventory());

    const loggedIn = storageService.getCurrentUser();
    setCurrentUser(loggedIn);
  };

  useEffect(() => {
    refreshData();
    void storageService.fetchIncidentsFromDatabase().then(setIncidents);
    // Direct authoritative database query on application open
    storageService.fetchLatestSettingsFromDatabase().then((dbSettings) => {
      if (dbSettings) setSettings(dbSettings);
      refreshData();
    });
    storageService.hydrateFromAppStateAsync().finally(() => {
      refreshData();
      void storageService.fetchIncidentsFromDatabase().then(setIncidents);
    });
    const unsubscribe = storageService.subscribe(() => {
      refreshData();
      void storageService.fetchIncidentsFromDatabase().then(setIncidents);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Handle Login
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
    refreshData();
    storageService.fetchLatestSettingsFromDatabase().then((dbSettings) => {
      if (dbSettings) setSettings(dbSettings);
      refreshData();
    });
    storageService.hydrateFromAppStateAsync().finally(() => {
      refreshData();
    });
  };

  // Handle Logout
  const handleLogout = () => {
    storageService.logout();
    setCurrentUser(null);
  };

  // Handle Date Range Click from Calendar
  const handleCalendarSelectRange = (start: string, end: string) => {
    setInitialBookingDates({ start, end });
    setIsBookingModalOpen(true);
  };

  // Handle Open New Booking from any button
  const handleOpenNewBooking = () => {
    setInitialBookingDates({ start: null, end: null });
    setIsBookingModalOpen(true);
  };

  // El Intendente recibe toda la actividad. Los copropietarios ven reservas
  // comunes y sólo los movimientos que afectan su propia cuenta.
  const userNotifications = useMemo(() => {
    if (!currentUser) return [];
    return notifications.filter((n) => {
      if (isUserIntendente(currentUser)) return true;
      if (n.targetUserId) return n.targetUserId === currentUser.id;
      return n.type === 'booking_created' || n.type === 'booking_approved' || n.type === 'booking_cancelled';
    });
  }, [notifications, currentUser]);

  // If user is not logged in, display strictly the private login gate
  if (!currentUser) {
    return (
      <>
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
        <PushNotificationToast />
      </>
    );
  }

  const isIntendente = isUserIntendente(currentUser);
  const isMasterIntendente = isIntendente && adminViewMode === 'admin';
  const isFinancialAdmin = isUserAdmin(currentUser);

  // Metrics for Admin Dashboard
  const activeBookingsCount = bookings.filter((b) => b.status === 'confirmed').length;
  const totalDaysReserved = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + b.totalDays, 0);
  const totalQuotaAllOwners = users
    .filter((u) => u.active !== false)
    .reduce((sum, u) => sum + u.annualQuotaDays, 0);

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#19231A] flex flex-col font-sans">
      {/* Top Header Contract */}
      <TopBar
        currentUser={currentUser}
        activeTab={activeTab}
        logoUrl={settings.logoUrl}
        adminViewMode={adminViewMode}
        onToggleAdminViewMode={handleToggleAdminViewMode}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (
            tab === 'owners' ||
            tab === 'blocks' ||
            tab === 'reservations' ||
            tab === 'settings' ||
            tab === 'd1' ||
            tab === 'logo'
          ) {
            setAdminSection(tab as AdminSectionType);
          }
        }}
        onLogout={handleLogout}
        onOpenNewBooking={handleOpenNewBooking}
        notifications={userNotifications}
        onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
      />

      {/* Main Viewport Container (1440px target, zero collapse) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Banner indicating Copropietario Mode for Intendente when toggled */}
        {isIntendente && adminViewMode === 'owner' && (
          <div className="mb-6 p-3 bg-teal-50 border border-teal-200 text-teal-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-teal-700 text-white font-bold text-[10px] uppercase tracking-wider">
                👤 VISTA COPROPIETARIO (INTENDENTE)
              </span>
              <span>
                Estás visualizando el sistema como socio copropietario: <strong>{currentUser.name}</strong> ({currentUser.partName}).
              </span>
            </div>
            <button
              onClick={() => handleToggleAdminViewMode('admin')}
              className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white font-bold text-[11px] uppercase tracking-wider shrink-0 cursor-pointer shadow-2xs"
            >
              Volver a Consola 100% ⚙️
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* UNIFIED ROLE-ACCURATE TAB ROUTING                        */}
        {/* Intendente: 100% Consola, Ajustes, Bloqueos y Finanzas   */}
        {/* Administrador: Finanzas (Gastos, Cobranzas, Caja) + Socio */}
        {/* Fiduciante / Copropietario: Societario, Estadías, Info   */}
        {/* ========================================================= */}

        {/* 1. DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          isMasterIntendente ? (
            <div className="space-y-6">
              {/* Admin Welcome Hero */}
              <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 sm:p-8 shadow-[0_4px_20px_-4px_rgba(23,43,26,0.06)]">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#EFEAE0]">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#7A8E7E]">
                      <span>Fideicomiso El Desayuno</span>
                      <span>·</span>
                      <span>Temporada 2026</span>
                      <span>·</span>
                      <span className="font-semibold text-[#0F766E]">Intendencia General (100% Acceso)</span>
                    </div>
                    <h1
                      className="text-2xl sm:text-3xl font-bold text-[#163323] mt-1.5"
                      style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
                    >
                      Consola General de Intendencia
                    </h1>
                    <p className="text-sm text-[#4E6152] mt-1 max-w-2xl leading-relaxed">
                      Control integral del 100% del sistema: ocupación de la estancia, auditoría de reservas, bloqueo de fechas por mantenimiento, inventario, reportes de daños, finanzas y configuración de base de datos.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => {
                        setActiveTab('blocks');
                        setAdminSection('blocks');
                      }}
                      className="px-4 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <Lock className="w-3.5 h-3.5 text-[#BFA270]" />
                      <span>Bloquear Fechas</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('calendar')}
                      className="px-4 py-2.5 bg-[#F6F2E8] hover:bg-[#EDE6D7] text-[#1B3B2B] border border-[#DDD5BF] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Ver Calendario</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Administrative KPI grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-6">
                  <div className="border-l-2 border-[#1B3B2B] pl-3">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#6C7E70] block">
                      Copropietarios
                    </span>
                    <div className="text-2xl font-bold font-mono tabular-nums text-[#19231A] mt-1">
                      {users.filter((u) => u.active !== false).length}
                    </div>
                    <p className="text-[10px] text-[#7A8E7E] mt-0.5">Padrón activo</p>
                  </div>

                  <div className="border-l-2 border-emerald-700 pl-3">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#6C7E70] block">
                      Estadías
                    </span>
                    <div className="text-2xl font-bold font-mono tabular-nums text-emerald-800 mt-1">
                      {activeBookingsCount}
                    </div>
                    <p className="text-[10px] text-[#7A8E7E] mt-0.5">En agenda 2026</p>
                  </div>

                  <div className="border-l-2 border-[#BFA270] pl-3">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#6C7E70] block">
                      Noches Ocupadas
                    </span>
                    <div className="text-2xl font-bold font-mono tabular-nums text-[#8F6F3A] mt-1">
                      {totalDaysReserved}
                    </div>
                    <p className="text-[10px] text-[#7A8E7E] mt-0.5">
                      Noches totales 2026
                    </p>
                  </div>

                  <div className="border-l-2 border-amber-600 pl-3">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#6C7E70] block">
                      Bloqueos
                    </span>
                    <div className="text-2xl font-bold font-mono tabular-nums text-amber-800 mt-1">
                      {blocks.length}
                    </div>
                    <p className="text-[10px] text-[#7A8E7E] mt-0.5">Mantenimiento</p>
                  </div>

                  <div className="border-l-2 border-blue-700 pl-3">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#6C7E70] block">
                      Stock de la Casa
                    </span>
                    <div className="text-2xl font-bold font-mono tabular-nums text-blue-900 mt-1">
                      {inventory.length}
                    </div>
                    <p className="text-[10px] text-[#7A8E7E] mt-0.5">Ítems inventariados</p>
                  </div>

                  <div className="border-l-2 border-red-600 pl-3">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#6C7E70] block">
                      Novedades / Daños
                    </span>
                    <div className="text-2xl font-bold font-mono tabular-nums text-red-800 mt-1">
                      {incidents.filter((i) => i.status !== 'resuelto' && i.status !== 'desestimado').length}
                    </div>
                    <p className="text-[10px] text-[#7A8E7E] mt-0.5">Pendientes</p>
                  </div>
                </div>
              </div>

              {/* Quick Shortcuts to Master Modules */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div
                  onClick={() => {
                    setActiveTab('reservations');
                    setAdminSection('reservations');
                  }}
                  className="p-6 bg-white border border-[#E3DFC8] hover:border-[#1B3B2B] shadow-xs cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE0]">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#163323] flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-800" />
                      Planilla de Reservas
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-[#8C7A53] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                  <p className="text-xs text-[#526657] mt-3 leading-relaxed">
                    Audite y filtre todas las reservas del año de cada socio. Permite exportar en CSV e imprimir el reporte oficial con membrete.
                  </p>
                  <span className="text-[11px] font-semibold text-[#1B3B2B] mt-4 block group-hover:underline">
                    Abrir listado exportable →
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('inventory')}
                  className="p-6 bg-white border border-[#E3DFC8] hover:border-[#1B3B2B] shadow-xs cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE0]">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#163323] flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-blue-800" />
                      Stock & Inventario
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-[#8C7A53] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                  <p className="text-xs text-[#526657] mt-3 leading-relaxed">
                    Consulte y audite el listado de bienes en la estancia: vajilla, muebles, televisores, bombas, ropa blanca y reposeras.
                  </p>
                  <span className="text-[11px] font-semibold text-[#1B3B2B] mt-4 block group-hover:underline">
                    Ver inventario ({inventory.length} ítems) →
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('incidents')}
                  className="p-6 bg-white border border-[#E3DFC8] hover:border-[#1B3B2B] shadow-xs cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE0]">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#163323] flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-700" />
                      Novedades & Daños Reportados
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-[#8C7A53] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                  <p className="text-xs text-[#526657] mt-3 leading-relaxed">
                    Avisos y reclamos cargados por los copropietarios con fotografías de roturas o faltantes, con asignación directa al casero Don Raúl.
                  </p>
                  <span className="text-[11px] font-semibold text-[#1B3B2B] mt-4 block group-hover:underline">
                    Revisar novedades ({incidents.filter((i) => i.status !== 'resuelto').length} activas) →
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('settings')}
                  className="p-6 bg-white border border-[#E3DFC8] hover:border-[#1B3B2B] shadow-xs cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE0]">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#163323] flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#1B3B2B]" />
                      Configuración Integral (100%)
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-[#8C7A53] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                  <p className="text-xs text-[#526657] mt-3 leading-relaxed">
                    Parametrice socios, cabezas, cupos, reglas, teléfonos de guardia, Wi-Fi, logo, y base de datos en un único panel centralizado.
                  </p>
                  <span className="text-[11px] font-semibold text-[#1B3B2B] mt-4 block group-hover:underline">
                    Abrir configuración general →
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('cobranzas')}
                  className="p-6 bg-white border border-[#E3DFC8] hover:border-[#1B3B2B] shadow-xs cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE0]">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#163323] flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-800" />
                      Cobranzas & Expensas
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-[#8C7A53] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                  <p className="text-xs text-[#526657] mt-3 leading-relaxed">
                    Emita cuotas de expensas, audite pagos recibidos de copropietarios y parametrice vencimientos y cuentas bancarias.
                  </p>
                  <span className="text-[11px] font-semibold text-[#1B3B2B] mt-4 block group-hover:underline">
                    Abrir panel de cobranzas →
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('gastos')}
                  className="p-6 bg-white border border-[#E3DFC8] hover:border-[#1B3B2B] shadow-xs cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE0]">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#163323] flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-[#BFA270]" />
                      Gastos & Costos Operativos
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-[#8C7A53] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                  <p className="text-xs text-[#526657] mt-3 leading-relaxed">
                    Registro auditado de servicios, sueldos, parquización e impuestos, con traslado de sumas del mes a liquidación de expensas.
                  </p>
                  <span className="text-[11px] font-semibold text-[#1B3B2B] mt-4 block group-hover:underline">
                    Abrir gestor de gastos →
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <OwnerQuotaSummary
              currentUser={currentUser}
              bookings={bookings}
              blocks={blocks}
              settings={settings}
              onOpenNewBooking={handleOpenNewBooking}
              onGoToCalendar={() => setActiveTab('calendar')}
              onGoToMyBookings={() => setActiveTab('my-bookings')}
              onGoToCobranzas={() => setActiveTab('cobranzas')}
              onGoToGastos={() => setActiveTab('gastos')}
              onGoToCashflow={() => setActiveTab('cashflow')}
            />
          )
        )}

        {/* 2. CALENDAR VIEW (ACCESSIBLE TO ALL) */}
        {activeTab === 'calendar' && (
          <CalendarView
            bookings={bookings}
            blocks={blocks}
            users={users}
            currentUser={currentUser}
            onSelectDateRange={handleCalendarSelectRange}
            onOpenBookingModal={handleOpenNewBooking}
          />
        )}

        {/* 3. MY BOOKINGS VIEW (PERSONAL STAYS) */}
        {activeTab === 'my-bookings' && (
          <MyBookingsView
            currentUser={currentUser}
            bookings={bookings}
            settings={settings}
            onOpenNewBooking={handleOpenNewBooking}
          />
        )}

        {/* 4. GASTOS & FACTURAS (ADMINISTRADOR & INTENDENTE WRITE; OTHERS READ/AUDIT) */}
        {activeTab === 'gastos' && (
          <ExpensesView
            currentUser={currentUser}
            settings={settings}
            isAdmin={hasFinancialAccess(currentUser) && adminViewMode !== 'owner'}
            onNavigateToCobranzas={() => setActiveTab('cobranzas')}
          />
        )}

        {/* 5. COBRANZAS & EXPENSAS (ADMINISTRADOR & INTENDENTE WRITE; OTHERS READ/PAY) */}
        {activeTab === 'cobranzas' && (
          <CobranzasView
            currentUser={currentUser}
            users={users}
            settings={settings}
            isAdmin={hasFinancialAccess(currentUser) && adminViewMode !== 'owner'}
          />
        )}

        {/* 6. CAJA & CUENTAS (ADMINISTRADOR & INTENDENTE WRITE; OTHERS AUDIT) */}
        {activeTab === 'cashflow' && (
          <CashFlowView
            currentUser={currentUser}
            settings={settings}
            isAdmin={hasFinancialAccess(currentUser) && adminViewMode !== 'owner'}
            canViewGeneral={canViewGeneralFinancialAccount(currentUser) && adminViewMode !== 'owner'}
            onNavigateToCobranzas={() => setActiveTab('cobranzas')}
          />
        )}

        {/* 7. INVENTARIO & STOCK */}
        {activeTab === 'inventory' && (
          <InventoryStockView currentUser={currentUser} settings={settings} />
        )}

        {/* 8. NOVEDADES & DAÑOS */}
        {activeTab === 'incidents' && (
          <IncidentReportsView
            currentUser={currentUser}
            bookings={bookings}
            settings={settings}
          />
        )}

        {/* 9. ACTAS NOTARIALES & FIDEICOMISO */}
        {activeTab === 'actas' && (
          <ActasView
            currentUser={currentUser}
            settings={settings}
            onGoBack={() => setActiveTab('dashboard')}
          />
        )}

        {/* 10. REGLAMENTO & GUÍA */}
        {activeTab === 'guide' && <HouseGuideView settings={settings} />}

        {/* 11. UNIFIED SETTINGS (EXCLUSIVELY FOR INTENDENTE: 100% ACCESS) */}
        {(activeTab === 'settings' ||
          activeTab === 'owners' ||
          activeTab === 'logo' ||
          activeTab === 'identity' ||
          activeTab === 'd1' ||
          activeTab === 'database' ||
          activeTab === 'rules' ||
          activeTab === 'contacts' ||
          activeTab === 'property' ||
          activeTab === 'engine' ||
          activeTab === 'documents') && (
          isIntendente ? (
            <UnifiedSettingsPanel
              currentUser={currentUser}
              users={users}
              bookings={bookings}
              blocks={blocks}
              settings={settings}
              initialTab={
                activeTab === 'owners'
                  ? 'owners'
                  : activeTab === 'logo' || activeTab === 'identity'
                  ? 'identity'
                  : activeTab === 'd1' || activeTab === 'database'
                  ? 'database'
                  : activeTab === 'rules'
                  ? 'rules'
                  : activeTab === 'contacts'
                  ? 'contacts'
                  : activeTab === 'property'
                  ? 'property'
                  : activeTab === 'documents'
                  ? 'documents'
                  : activeTab === 'engine'
                  ? 'engine'
                  : 'owners'
              }
            />
          ) : (
            <div className="bg-white border border-[#DDD5BF] p-8 text-center space-y-4 max-w-xl mx-auto my-12 shadow-sm">
              <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-[#163323]" style={{ fontFamily: "'Cinzel', serif" }}>
                Acceso Exclusivo de Intendencia
              </h2>
              <p className="text-xs text-[#526657] leading-relaxed">
                La configuración integral de la plataforma, padrón general de socios y parámetros de base de datos están reservados exclusivamente para el <strong>Intendente</strong> (único rol con acceso al 100% del sistema).
              </p>
              {isFinancialAdmin && (
                <p className="text-xs text-blue-900 bg-blue-50 p-3 border border-blue-200">
                  Como <strong>Administrador</strong>, contás con facultades plenas en <strong>Gastos</strong>, <strong>Cobranzas</strong>, y <strong>Caja & Cuentas</strong>, además de las funciones de un copropietario.
                </p>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider cursor-pointer"
              >
                Volver al Inicio
              </button>
            </div>
          )
        )}

        {/* 12. OPERATIONAL AUDIT (RESERVAS GLOBALES & BLOQUEOS: EXCLUSIVELY FOR INTENDENTE) */}
        {(activeTab === 'reservations' || activeTab === 'blocks') && (
          isIntendente ? (
            <AdminPanel
              currentUser={currentUser}
              users={users}
              bookings={bookings}
              blocks={blocks}
              settings={settings}
              activeSection={adminSection}
              onOpenNewBooking={handleOpenNewBooking}
              onNavigateSection={(sec) => {
                setAdminSection(sec);
                setActiveTab(sec);
              }}
            />
          ) : (
            <div className="bg-white border border-[#DDD5BF] p-8 text-center space-y-4 max-w-xl mx-auto my-12 shadow-sm">
              <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-[#163323]" style={{ fontFamily: "'Cinzel', serif" }}>
                Acceso Exclusivo de Intendencia
              </h2>
              <p className="text-xs text-[#526657] leading-relaxed">
                La planilla general de reservas y el bloqueo de fechas por mantenimiento están reservados exclusivamente para el <strong>Intendente</strong>.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider cursor-pointer"
              >
                Ir al Calendario
              </button>
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="w-full bg-[#FFFFFF] border-t border-[#E3DFC8] py-4 text-center text-xs text-[#7A8E7E]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-[#163323]">EL DESAYUNO SOCIEDAD</span>
            <span>·</span>
            <span>Cuatro Partes, Un Mismo Objetivo</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span>Sistema Privado de Gestión de Estadías y Reserva de Turnos © {new Date().getFullYear()}</span>
            <span>·</span>
            <span
              className="font-mono font-bold text-[#163323] bg-[#EFE9DB] px-1.5 py-0.5 rounded text-[11px] border border-[#D5CDBC]"
              title={`Versión de producción: ${APP_VERSION}`}
            >
              {APP_VERSION}
            </span>
          </div>
        </div>
      </footer>

      {/* Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        currentUser={currentUser}
        users={users}
        bookings={bookings}
        blocks={blocks}
        initialStartDate={initialBookingDates.start}
        initialEndDate={initialBookingDates.end}
        onBookingSuccess={() => {
          refreshData();
        }}
      />

      {/* Notifications Drawer */}
      <NotificationCenterDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        notifications={userNotifications}
        onMarkAllRead={() => storageService.markAllNotificationsAsRead()}
        currentUser={currentUser}
      />

      {/* Toast Notification Provider */}
      <PushNotificationToast currentUser={currentUser} />
    </div>
  );
}
