/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, Booking, DateBlock, TrustSettings, NotificationPush } from './types';
import { storageService } from './services/storageService';
import { LoginScreen } from './components/LoginScreen';
import { TopBar } from './components/TopBar';
import { OwnerQuotaSummary } from './components/OwnerQuotaSummary';
import { CalendarView } from './components/CalendarView';
import { BookingModal } from './components/BookingModal';
import { MyBookingsView } from './components/MyBookingsView';
import { HouseGuideView } from './components/HouseGuideView';
import { AdminPanel } from './components/AdminPanel';
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
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<DateBlock[]>([]);
  const [settings, setSettings] = useState<TrustSettings>(storageService.getSettings());
  const [notifications, setNotifications] = useState<NotificationPush[]>([]);

  // Navigation state
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [adminSection, setAdminSection] = useState<'owners' | 'blocks' | 'reservations' | 'settings'>('reservations');

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

    const loggedIn = storageService.getCurrentUser();
    setCurrentUser(loggedIn);
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = storageService.subscribe(() => {
      refreshData();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Handle Login
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
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

  // If user is not logged in, display strictly the private login gate
  if (!currentUser) {
    return (
      <>
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
        <PushNotificationToast />
      </>
    );
  }

  const isAdmin = currentUser.role === 'admin';

  // Metrics for Admin Dashboard
  const activeBookingsCount = bookings.filter((b) => b.status === 'confirmed').length;
  const totalDaysReserved = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + b.totalDays, 0);
  const totalQuotaAllOwners = users
    .filter((u) => u.role === 'owner')
    .reduce((sum, u) => sum + u.annualQuotaDays, 0);

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#19231A] flex flex-col font-sans">
      {/* Top Header Contract */}
      <TopBar
        currentUser={currentUser}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'owners') {
            setActiveTab('owners');
            setAdminSection('owners');
          } else if (tab === 'blocks') {
            setActiveTab('blocks');
            setAdminSection('blocks');
          } else if (tab === 'reservations') {
            setActiveTab('reservations');
            setAdminSection('reservations');
          }
        }}
        onLogout={handleLogout}
        onOpenNewBooking={handleOpenNewBooking}
        notifications={notifications}
        onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
      />

      {/* Main Viewport Container (1440px target, zero collapse) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* ========================================================= */}
        {/* OWNER VIEWS */}
        {/* ========================================================= */}
        {!isAdmin && (
          <>
            {activeTab === 'dashboard' && (
              <OwnerQuotaSummary
                currentUser={currentUser}
                bookings={bookings}
                blocks={blocks}
                onOpenNewBooking={handleOpenNewBooking}
                onGoToCalendar={() => setActiveTab('calendar')}
                onGoToMyBookings={() => setActiveTab('my-bookings')}
              />
            )}

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

            {activeTab === 'my-bookings' && (
              <MyBookingsView
                currentUser={currentUser}
                bookings={bookings}
                settings={settings}
                onOpenNewBooking={handleOpenNewBooking}
              />
            )}

            {activeTab === 'guide' && <HouseGuideView settings={settings} />}
          </>
        )}

        {/* ========================================================= */}
        {/* ADMINISTRATOR VIEWS */}
        {/* ========================================================= */}
        {isAdmin && (
          <>
            {activeTab === 'dashboard' && (
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
                        <span className="font-semibold text-[#8C6D3B]">Panel Fiduciario</span>
                      </div>
                      <h1
                        className="text-2xl sm:text-3xl font-bold text-[#163323] mt-1.5"
                        style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
                      >
                        Consola General de Administración
                      </h1>
                      <p className="text-sm text-[#4E6152] mt-1 max-w-2xl leading-relaxed">
                        Control integral de ocupación de la casa de veraneo, auditoría de turnos de los copropietarios, bloqueos por mantenimiento edilicio y asignación de cupos anuales.
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
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 pt-6">
                    <div className="border-l-2 border-[#1B3B2B] pl-4">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6C7E70] block">
                        Copropietarios Activos
                      </span>
                      <div className="text-3xl font-bold font-mono tabular-nums text-[#19231A] mt-1">
                        {users.filter((u) => u.role === 'owner' && u.active).length}
                      </div>
                      <p className="text-xs text-[#7A8E7E] mt-1">Cuatro partes indivisas (100%)</p>
                    </div>

                    <div className="border-l-2 border-emerald-700 pl-4">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6C7E70] block">
                        Estadías Confirmadas
                      </span>
                      <div className="text-3xl font-bold font-mono tabular-nums text-emerald-800 mt-1">
                        {activeBookingsCount}
                      </div>
                      <p className="text-xs text-[#7A8E7E] mt-1">En agenda para el año</p>
                    </div>

                    <div className="border-l-2 border-[#BFA270] pl-4">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6C7E70] block">
                        Días Consumidos (Total)
                      </span>
                      <div className="text-3xl font-bold font-mono tabular-nums text-[#8F6F3A] mt-1">
                        {totalDaysReserved} / {totalQuotaAllOwners}
                      </div>
                      <p className="text-xs text-[#7A8E7E] mt-1">
                        {Math.round((totalDaysReserved / (totalQuotaAllOwners || 1)) * 100)}% de ocupación teórica
                      </p>
                    </div>

                    <div className="border-l-2 border-amber-600 pl-4">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6C7E70] block">
                        Bloqueos Técnicos
                      </span>
                      <div className="text-3xl font-bold font-mono tabular-nums text-amber-800 mt-1">
                        {blocks.length}
                      </div>
                      <p className="text-xs text-[#7A8E7E] mt-1">Caldera, pileta y pintura</p>
                    </div>
                  </div>
                </div>

                {/* Quick Shortcuts to Admin Modules */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Shortcut 1: Consolidado de Reservas */}
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
                      Vea y filtre todas las reservas del año de cada socio. Permite exportar en CSV
                      e imprimir el reporte oficial con membrete del Fideicomiso.
                    </p>
                    <span className="text-[11px] font-semibold text-[#1B3B2B] mt-4 block group-hover:underline">
                      Abrir listado exportable →
                    </span>
                  </div>

                  {/* Shortcut 2: Padrón y Cupos */}
                  <div
                    onClick={() => {
                      setActiveTab('owners');
                      setAdminSection('owners');
                    }}
                    className="p-6 bg-white border border-[#E3DFC8] hover:border-[#1B3B2B] shadow-xs cursor-pointer transition-all group"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE0]">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#163323] flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#1B3B2B]" />
                        Padrón y Cupos
                      </span>
                      <ArrowUpRight className="w-4 h-4 text-[#8C7A53] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                    <p className="text-xs text-[#526657] mt-3 leading-relaxed">
                      Gestión de propietarios, alta y baja de beneficiarios, asignación de los 30
                      días anuales por parte y configuración del color del calendario.
                    </p>
                    <span className="text-[11px] font-semibold text-[#1B3B2B] mt-4 block group-hover:underline">
                      Gestionar propietarios →
                    </span>
                  </div>

                  {/* Shortcut 3: Bloqueos y Mantenimiento */}
                  <div
                    onClick={() => {
                      setActiveTab('blocks');
                      setAdminSection('blocks');
                    }}
                    className="p-6 bg-white border border-[#E3DFC8] hover:border-[#1B3B2B] shadow-xs cursor-pointer transition-all group"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE0]">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#163323] flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-700" />
                        Bloqueos Técnicos
                      </span>
                      <ArrowUpRight className="w-4 h-4 text-[#8C7A53] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                    <p className="text-xs text-[#526657] mt-3 leading-relaxed">
                      Inhabilite rangos de fechas por reformas, pintura, reparaciones urgentes o
                      apertura de pileta para que ningún socio reserve esos días.
                    </p>
                    <span className="text-[11px] font-semibold text-[#1B3B2B] mt-4 block group-hover:underline">
                      Ver bloqueos vigentes →
                    </span>
                  </div>
                </div>
              </div>
            )}

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

            {(activeTab === 'reservations' ||
              activeTab === 'blocks' ||
              activeTab === 'owners' ||
              activeTab === 'settings') && (
              <AdminPanel
                currentUser={currentUser}
                users={users}
                bookings={bookings}
                blocks={blocks}
                settings={settings}
                activeSection={adminSection}
                onNavigateSection={(sec) => {
                  setAdminSection(sec);
                  setActiveTab(sec);
                }}
              />
            )}

            {activeTab === 'guide' && <HouseGuideView settings={settings} />}
          </>
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
          <div>
            <span>Sistema Privado de Gestión de Estadías y Reserva de Turnos © {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {/* Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        currentUser={currentUser}
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
        notifications={notifications}
        onMarkAllRead={() => storageService.markAllNotificationsAsRead()}
      />

      {/* Toast Notification Provider */}
      <PushNotificationToast />
    </div>
  );
}
