import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import {
  BookOpen,
  Box,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Fuel,
  Leaf,
  LayoutDashboard,
  Plus,
  ReceiptText,
  Settings2,
  Shield,
  TriangleAlert,
  WalletCards,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  User,
  hasPrivilegedAccess,
  getModuleAccess,
  isUserAdmin,
  isUserIntendente,
} from '../types';
import { APP_VERSION } from '../version';

interface AppSidebarProps {
  currentUser: User;
  activeTab: string;
  logoUrl?: string;
  adminViewMode: 'admin' | 'owner';
  onToggleAdminViewMode: (mode: 'admin' | 'owner') => void;
  onSelectTab: (tab: string) => void;
  onOpenNewBooking: () => void;
}

const iconByTab = {
  dashboard: LayoutDashboard,
  calendar: CalendarDays,
  reservations: ClipboardList,
  'my-bookings': ClipboardList,
  gastos: ReceiptText,
  ingresos: CircleDollarSign,
  fuel: Fuel,
  forestry: Leaf,
  cashflow: WalletCards,
  cobranzas: CircleDollarSign,
  inventory: Box,
  incidents: TriangleAlert,
  settings: Settings2,
  actas: FileText,
  guide: BookOpen,
};

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentUser,
  activeTab,
  logoUrl,
  adminViewMode,
  onToggleAdminViewMode,
  onSelectTab,
  onOpenNewBooking,
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Principal: true,
    'Operación': true,
    Finanzas: true,
    Sistema: false,
  });
  const isIntendente = isUserIntendente(currentUser);
  const isFinancialAdmin = isUserAdmin(currentUser);
  const privileged = hasPrivilegedAccess(currentUser);

  const navigation = isIntendente && adminViewMode === 'admin'
    ? [
        { id: 'dashboard', label: 'Consola general', section: 'Principal' },
        { id: 'calendar', label: 'Calendario', section: 'Principal' },
        { id: 'reservations', label: 'Reservas', section: 'Operación' },
        { id: 'gastos', label: 'Gastos', section: 'Finanzas' },
        { id: 'ingresos', label: 'Ingresos', section: 'Finanzas' },
        { id: 'cobranzas', label: 'Cobranzas', section: 'Finanzas' },
        { id: 'cashflow', label: 'Caja y cuentas', section: 'Finanzas' },
        { id: 'fuel', label: 'Combustible', section: 'Finanzas' },
        { id: 'forestry', label: 'Forestal', section: 'Operación' },
        { id: 'inventory', label: 'Stock general', section: 'Operación' },
        { id: 'incidents', label: 'Novedades', section: 'Operación' },
        { id: 'settings', label: 'Configuración', section: 'Sistema' },
        ...(privileged ? [{ id: 'actas', label: 'Actas', section: 'Sistema' }] : []),
        { id: 'guide', label: 'Reglamento', section: 'Sistema' },
      ]
    : isFinancialAdmin
    ? [
        { id: 'dashboard', label: 'Inicio', section: 'Principal' },
        { id: 'calendar', label: 'Calendario', section: 'Principal' },
        { id: 'my-bookings', label: 'Mis estadías', section: 'Operación' },
        { id: 'gastos', label: 'Gastos', section: 'Finanzas' },
        { id: 'ingresos', label: 'Ingresos', section: 'Finanzas' },
        { id: 'cobranzas', label: 'Cobranzas', section: 'Finanzas' },
        { id: 'cashflow', label: 'Caja y cuentas', section: 'Finanzas' },
        { id: 'fuel', label: 'Combustible', section: 'Finanzas' },
        { id: 'forestry', label: 'Forestal', section: 'Operación' },
        { id: 'inventory', label: 'Stock general', section: 'Operación' },
        { id: 'incidents', label: 'Novedades', section: 'Operación' },
        ...(privileged ? [{ id: 'actas', label: 'Actas', section: 'Sistema' }] : []),
        { id: 'guide', label: 'Reglamento', section: 'Sistema' },
      ]
    : [
        { id: 'dashboard', label: 'Inicio', section: 'Principal' },
        { id: 'calendar', label: 'Calendario', section: 'Principal' },
        { id: 'my-bookings', label: 'Mis estadías', section: 'Operación' },
        { id: 'gastos', label: 'Gastos', section: 'Finanzas' },
        { id: 'cashflow', label: 'Caja y cuentas', section: 'Finanzas' },
        { id: 'cobranzas', label: 'Pagos y cuotas', section: 'Finanzas' },
        { id: 'inventory', label: 'Stock general', section: 'Operación' },
        { id: 'incidents', label: 'Novedades', section: 'Operación' },
        ...(privileged ? [{ id: 'actas', label: 'Actas', section: 'Sistema' }] : []),
        { id: 'guide', label: 'Reglamento', section: 'Sistema' },
      ];

  const sections = ['Principal', 'Operación', 'Finanzas', 'Sistema'];

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:w-[276px] lg:flex-col overflow-hidden bg-[#18332F] text-white shadow-[12px_0_36px_rgba(24,51,47,0.16)]">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full border-[32px] border-[#315D5B] opacity-80" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full border-[34px] border-[#264B49] opacity-90" />

      <div className="relative px-6 pt-7 pb-5 border-b border-white/15">
        <button onClick={() => onSelectTab('dashboard')} className="text-left cursor-pointer" title="Ir al inicio">
          <BrandLogo size="md" theme="light" logoUrl={logoUrl} showTagline={false} />
        </button>
        <p className="mt-4 text-[10px] tracking-[0.16em] uppercase text-[#C8D3D1]">Gestión integral</p>
      </div>

      <div className="relative px-5 pt-4">
        <button
          type="button"
          onClick={onOpenNewBooking}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#F4F1E9] px-3 py-3 text-[11px] font-bold tracking-[0.08em] uppercase text-[#18332F] transition-transform hover:-translate-y-0.5 hover:bg-white cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Nueva reserva
        </button>
      </div>

      <nav className="relative flex-1 overflow-y-auto px-3 py-4 scrollbar-thin" aria-label="Navegación principal">
        {sections.map((section) => {
          const items = navigation.filter((item) => item.section === section && getModuleAccess(currentUser, item.id as any) !== 'none');
          if (!items.length) return null;
          return (
            <div key={section} className="mb-5">
              <button
                type="button"
                onClick={() => setExpandedSections((current) => ({ ...current, [section]: !current[section] }))}
                className="w-full flex items-center justify-between px-3 mb-1.5 text-[9px] font-bold tracking-[0.16em] uppercase text-[#AABBB8] hover:text-white cursor-pointer"
                aria-expanded={expandedSections[section] !== false}
              >
                <span>{section}</span>
                {expandedSections[section] !== false ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              <div className={expandedSections[section] !== false ? 'space-y-0.5' : 'hidden'}>
                {items.map((item) => {
                  const Icon = iconByTab[item.id as keyof typeof iconByTab];
                  const selected = activeTab === item.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => onSelectTab(item.id)}
                      className={`group relative w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'bg-white text-[#18332F] shadow-[0_4px_12px_rgba(0,0,0,0.14)]'
                          : 'text-[#D9E3E0] hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {selected && <span className="absolute left-0 h-5 w-1 rounded-r bg-[#B9A487]" />}
                      {Icon && <Icon className={`w-4 h-4 shrink-0 ${selected ? 'text-[#315D5B]' : 'text-[#AABBB8] group-hover:text-[#F4F1E9]'}`} />}
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="relative m-4 mt-0 rounded-xl border border-white/15 bg-white/7 p-3">
        {isIntendente && (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/15 p-1 mb-3">
            <button
              onClick={() => onToggleAdminViewMode('admin')}
              className={`rounded-md px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide cursor-pointer ${adminViewMode === 'admin' ? 'bg-white text-[#18332F]' : 'text-[#C8D3D1]'}`}
            >
              Gestión
            </button>
            <button
              onClick={() => onToggleAdminViewMode('owner')}
              className={`rounded-md px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide cursor-pointer ${adminViewMode === 'owner' ? 'bg-white text-[#18332F]' : 'text-[#C8D3D1]'}`}
            >
              Mi parte
            </button>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-white/30" style={{ backgroundColor: currentUser.color }}>
            {currentUser.avatarInitials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold">{currentUser.name}</p>
            <p className="truncate text-[9px] text-[#C8D3D1]">{isIntendente ? 'Intendencia general' : currentUser.partName || 'Copropietario'}</p>
          </div>
        </div>
        <p className="mt-2 text-[8px] tracking-wide text-[#AABBB8]">{APP_VERSION} · EL DESAYUNO</p>
      </div>
    </aside>
  );
};
