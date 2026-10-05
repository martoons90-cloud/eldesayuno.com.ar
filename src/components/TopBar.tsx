import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { User, NotificationPush } from '../types';
import { Bell, LogOut, UserCheck, Shield, PlusCircle, Menu, X, Home } from 'lucide-react';

interface TopBarProps {
  currentUser: User;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  onOpenNewBooking: () => void;
  notifications: NotificationPush[];
  onOpenNotifications: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  activeTab,
  onSelectTab,
  onLogout,
  onOpenNewBooking,
  notifications,
  onOpenNotifications,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const isAdmin = currentUser.role === 'admin';

  // Navigation tabs based on role
  const navItems = isAdmin
    ? [
        { id: 'dashboard', label: 'Resumen' },
        { id: 'calendar', label: 'Calendario' },
        { id: 'reservations', label: 'Reservas' },
        { id: 'blocks', label: 'Bloqueos' },
        { id: 'owners', label: 'Copropietarios' },
        { id: 'guide', label: 'Reglamento & Docs' },
      ]
    : [
        { id: 'dashboard', label: 'Mi Saldo' },
        { id: 'calendar', label: 'Calendario & Ocupación' },
        { id: 'my-bookings', label: 'Mis Estadías' },
        { id: 'guide', label: 'Reglamento & Casa' },
      ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FFFFFF] border-b border-[#E3DFC8] shadow-[0_2px_10px_rgba(20,38,24,0.04)]">
      {/* Accent top line */}
      <div className="h-1 w-full bg-gradient-to-r from-[#17341B] via-[#2A4D32] to-[#BFA270]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Zone 1: Single text element wordmark with seal */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectTab('dashboard')}
              className="flex items-center gap-2.5 text-left cursor-pointer group focus:outline-none"
            >
              <BrandLogo size="sm" variant="seal-only" />
              <div className="flex flex-col">
                <span
                  className="text-base sm:text-lg font-bold tracking-wider text-[#163323] leading-none group-hover:text-[#2A4D32] transition-colors"
                  style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
                >
                  EL DESAYUNO
                </span>
                <span className="text-[9px] tracking-[0.22em] text-[#9E8252] font-semibold uppercase leading-tight mt-0.5">
                  FIDEICOMISO
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Navigation Links (Clean text with subtle active indicator) */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`px-3 py-2 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors relative cursor-pointer ${
                    isActive
                      ? 'text-[#163323]'
                      : 'text-[#56685B] hover:text-[#163323]'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#163323]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Actions & User Status */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Booking CTA for owners */}
            {!isAdmin && (
              <button
                onClick={onOpenNewBooking}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-[#FAF8F5] text-xs font-semibold uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#BFA270]" />
                <span>Reservar Turno</span>
              </button>
            )}

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 text-[#46574B] hover:text-[#163323] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
              title="Centro de Notificaciones Push"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#BFA270] text-[#163323] font-mono text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* User Pill / Identity */}
            <div className="hidden lg:flex items-center gap-2.5 pl-2.5 border-l border-[#E6E0CF]">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xs shrink-0"
                style={{ backgroundColor: currentUser.color }}
              >
                {currentUser.avatarInitials}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-[#163323] leading-tight truncate max-w-[120px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-[#7A8E7E] leading-none flex items-center gap-1 mt-0.5">
                  {isAdmin ? (
                    <span className="text-[#A68853] font-semibold flex items-center gap-0.5">
                      <Shield className="w-2.5 h-2.5" /> Administrador
                    </span>
                  ) : (
                    <span>{currentUser.partName}</span>
                  )}
                </span>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={onLogout}
              className="p-2 text-[#7A8E7E] hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile menu hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-[#46574B] hover:text-[#163323] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#FAF8F5] border-t border-[#E3DFC8] px-4 pt-3 pb-5 space-y-2 animate-fade-in">
          {/* User profile strip in mobile */}
          <div className="flex items-center gap-3 p-3 bg-white border border-[#E3DFC8] mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: currentUser.color }}
            >
              {currentUser.avatarInitials}
            </div>
            <div>
              <p className="text-xs font-bold text-[#163323]">{currentUser.name}</p>
              <p className="text-[11px] text-[#637568]">
                {isAdmin ? 'Fiduciario Administrador' : `${currentUser.partName} · Cupo: ${currentUser.annualQuotaDays - currentUser.usedDays}d restantes`}
              </p>
            </div>
          </div>

          {!isAdmin && (
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
          )}

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
        </div>
      )}
    </header>
  );
};
