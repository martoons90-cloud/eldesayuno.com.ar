import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { User, NotificationPush } from '../types';
import { d1Service } from '../services/d1Service';
import { PasswordManagementModal } from './PasswordManagementModal';
import { APP_VERSION } from '../version';
import {
  Bell,
  LogOut,
  UserCheck,
  Shield,
  PlusCircle,
  Menu,
  X,
  Database,
  Image as ImageIcon,
  KeyRound,
} from 'lucide-react';

interface TopBarProps {
  currentUser: User;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  onOpenNewBooking: () => void;
  notifications: NotificationPush[];
  onOpenNotifications: () => void;
  logoUrl?: string;
  adminViewMode?: 'admin' | 'owner';
  onToggleAdminViewMode?: (mode: 'admin' | 'owner') => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  activeTab,
  onSelectTab,
  onLogout,
  onOpenNewBooking,
  notifications,
  onOpenNotifications,
  logoUrl,
  adminViewMode = 'admin',
  onToggleAdminViewMode,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const isUserAdmin = currentUser.role === 'admin';
  const isAdmin = isUserAdmin;
  const effectiveIsAdmin = isUserAdmin && adminViewMode === 'admin';
  const isD1Active = d1Service.isConnected();

  // Navigation tabs based on active mode (shortened for crisp fitting)
  const navItems = effectiveIsAdmin
    ? [
        { id: 'dashboard', label: 'Resumen' },
        { id: 'calendar', label: 'Calendario' },
        { id: 'reservations', label: 'Reservas' },
        { id: 'gastos', label: 'Gastos' },
        { id: 'cobranzas', label: 'Cobranzas' },
        { id: 'inventory', label: 'Inventario' },
        { id: 'incidents', label: 'Novedades' },
        { id: 'settings', label: 'Ajustes' },
        { id: 'guide', label: 'Reglamento' },
      ]
    : [
        { id: 'dashboard', label: 'Inicio' },
        { id: 'calendar', label: 'Calendario' },
        { id: 'my-bookings', label: 'Mis Estadías' },
        { id: 'gastos', label: 'Gastos' },
        { id: 'cobranzas', label: 'Pagos & Cuotas' },
        { id: 'inventory', label: 'Inventario' },
        { id: 'incidents', label: 'Novedades' },
        { id: 'guide', label: 'Reglamento' },
      ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FFFFFF] border-b border-[#E3DFC8] shadow-[0_2px_10px_rgba(20,38,24,0.04)]">
      {/* Accent top line */}
      <div className="h-1 w-full bg-gradient-to-r from-[#17341B] via-[#2A4D32] to-[#BFA270]" />

      <div className="max-w-[1440px] mx-auto px-2 sm:px-4 lg:px-5">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 overflow-x-hidden">
          {/* Zone 1: Wordmark & Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onSelectTab('dashboard')}
              className="flex items-center gap-2 text-left cursor-pointer group focus:outline-none"
            >
              <BrandLogo size="sm" variant="seal-only" logoUrl={logoUrl} />
              <div className="flex flex-col">
                <span
                  className="text-sm sm:text-base font-bold tracking-wider text-[#163323] leading-none group-hover:text-[#2A4D32] transition-colors"
                  style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
                >
                  EL DESAYUNO
                </span>
                <span className="text-[8px] tracking-[0.2em] text-[#9E8252] font-semibold uppercase leading-tight mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>FIDEICOMISO</span>
                  <span
                    className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-[#EFE9DB] text-[#163323] rounded border border-[#D5CDBC] shadow-2xs"
                    title={`Versión activa del ERP: ${APP_VERSION}`}
                  >
                    {APP_VERSION}
                  </span>
                  <span
                    className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200 flex items-center gap-1"
                    title="Sincronizado en tiempo real con la Base de Datos Central del Servidor"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    <span>BD Sincronizada</span>
                  </span>
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Inline Navigation Links (visible on xl screens >= 1150px) */}
          <nav className="hidden xl:flex items-center gap-1 shrink-0">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`px-2 py-1.5 text-[11px] xl:text-xs font-semibold tracking-wide whitespace-nowrap transition-colors relative cursor-pointer ${
                    isActive
                      ? 'text-[#163323] font-bold'
                      : 'text-[#56685B] hover:text-[#163323]'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1.5 right-1.5 h-0.5 bg-[#163323]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Actions & User Status */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Booking CTA */}
            <button
              onClick={onOpenNewBooking}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-[#FAF8F5] text-[11px] font-semibold uppercase tracking-wider transition-colors shadow-2xs cursor-pointer shrink-0"
              title="Solicitar nueva reserva de estadía"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#BFA270]" />
              <span>+ Reservar</span>
            </button>

            {/* Mode Switcher for Administrators */}
            {isUserAdmin && onToggleAdminViewMode && (
              <div className="hidden lg:flex items-center bg-[#FAF8F5] border border-[#DDD5BF] p-0.5 shadow-2xs shrink-0">
                <button
                  onClick={() => onToggleAdminViewMode('admin')}
                  className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                    adminViewMode === 'admin'
                      ? 'bg-[#1B3B2B] text-white shadow-2xs'
                      : 'text-[#637568] hover:text-[#163323]'
                  }`}
                  title="Consola de Administración Fiduciaria"
                >
                  <Shield className="w-3 h-3 text-[#BFA270]" />
                  <span>Admin</span>
                </button>
                <button
                  onClick={() => onToggleAdminViewMode('owner')}
                  className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                    adminViewMode === 'owner'
                      ? 'bg-[#2563EB] text-white shadow-2xs'
                      : 'text-[#637568] hover:text-[#163323]'
                  }`}
                  title="Modo Copropietario (Reservas personales y mi cuota)"
                >
                  <UserCheck className="w-3 h-3 text-white" />
                  <span>Copropietario</span>
                </button>
              </div>
            )}

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="relative p-1.5 text-[#46574B] hover:text-[#163323] hover:bg-[#F4EFE6] transition-colors cursor-pointer shrink-0"
              title="Centro de Notificaciones Push"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-[#BFA270] text-[#163323] font-mono text-[8px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Password Change Button */}
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="p-1.5 text-[#46574B] hover:text-[#163323] hover:bg-[#F4EFE6] transition-colors cursor-pointer shrink-0"
              title="Cambiar mi Contraseña"
            >
              <KeyRound className="w-4 h-4 text-[#BFA270]" />
            </button>

            {/* User Pill / Identity */}
            <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-[#E6E0CF] shrink-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs shrink-0"
                style={{ backgroundColor: currentUser.color }}
              >
                {currentUser.avatarInitials}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-semibold text-[#163323] leading-tight truncate max-w-[110px]">
                  {currentUser.name}
                </span>
                <span className="text-[9px] text-[#7A8E7E] leading-none flex items-center gap-0.5 mt-0.5">
                  {effectiveIsAdmin ? (
                    <span className="text-[#A68853] font-semibold flex items-center gap-0.5">
                      <Shield className="w-2.5 h-2.5" /> Admin
                    </span>
                  ) : (
                    <span className="truncate max-w-[100px]">{currentUser.partName}</span>
                  )}
                </span>
              </div>
            </div>

            {/* Subtle Logout icon button */}
            <button
              onClick={onLogout}
              className="p-2 text-[#637568] hover:text-red-700 hover:bg-red-50 transition-colors rounded-full cursor-pointer shrink-0"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile menu hamburger (visible on screens < 1150px) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-1.5 text-[#46574B] hover:text-[#163323] hover:bg-[#F4EFE6] transition-colors cursor-pointer shrink-0"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-[#FAF8F5] border-t border-[#E3DFC8] px-4 pt-3 pb-5 space-y-2 animate-fade-in">
          {/* User profile strip in mobile */}
          <div className="flex items-center justify-between p-3 bg-white border border-[#E3DFC8] mb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: currentUser.color }}
              >
                {currentUser.avatarInitials}
              </div>
              <div>
                <p className="text-xs font-bold text-[#163323]">{currentUser.name}</p>
                <p className="text-[11px] text-[#637568]">
                  {isAdmin ? 'Administrador Fiduciario' : currentUser.partName}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setIsPasswordModalOpen(true);
              }}
              className="px-2 py-1 bg-[#F4EFE6] border border-[#DDD5BF] text-[10px] font-semibold text-[#163323] flex items-center gap-1"
            >
              <KeyRound className="w-3 h-3 text-[#BFA270]" />
              <span>Clave</span>
            </button>
          </div>

          {/* Mobile Mode Switcher for Admin */}
          {isUserAdmin && onToggleAdminViewMode && (
            <div className="flex items-center justify-between p-2 bg-[#EFE9DB] border border-[#DDD5BF] mb-2">
              <span className="text-xs font-bold text-[#163323] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#BFA270]" /> Modo de Navegación:
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onToggleAdminViewMode('admin')}
                  className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${
                    adminViewMode === 'admin'
                      ? 'bg-[#1B3B2B] text-white'
                      : 'bg-white text-[#163323] border border-[#DDD5BF]'
                  }`}
                >
                  Admin
                </button>
                <button
                  onClick={() => onToggleAdminViewMode('owner')}
                  className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${
                    adminViewMode === 'owner'
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-white text-[#163323] border border-[#DDD5BF]'
                  }`}
                >
                  Copropietario
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenNewBooking();
            }}
            className="w-full mb-2 py-2.5 px-4 bg-[#1B3B2B] text-[#FAF8F5] text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <PlusCircle className="w-4 h-4 text-[#BFA270]" />
            <span>Solicitar Nueva Reserva</span>
          </button>

          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 text-xs font-semibold tracking-wide transition-colors cursor-pointer flex items-center justify-between ${
                activeTab === item.id
                  ? 'bg-[#1B3B2B] text-white'
                  : 'text-[#445649] hover:bg-[#EFE9DB]'
              }`}
            >
              <span>{item.label}</span>
              {activeTab === item.id && <span className="text-xs">●</span>}
            </button>
          ))}

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onLogout();
            }}
            className="w-full mt-3 py-2.5 px-4 bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <LogOut className="w-4 h-4 text-red-700" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      )}

      {/* Password Management Modal */}
      {isPasswordModalOpen && (
        <PasswordManagementModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          targetUser={currentUser}
          isSelfChange={true}
        />
      )}
    </header>
  );
};
