import React, { useState } from 'react';
import { User, Booking, DateBlock, TrustSettings } from '../types';
import { storageService } from '../services/storageService';
import { pushService } from '../services/notificationService';
import {
  Users,
  Calendar,
  Lock,
  Download,
  Printer,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Sparkles,
  Sliders,
  FileSpreadsheet,
  Search,
  Filter,
  XCircle,
} from 'lucide-react';

interface AdminPanelProps {
  currentUser: User;
  users: User[];
  bookings: Booking[];
  blocks: DateBlock[];
  settings: TrustSettings;
  activeSection: 'owners' | 'blocks' | 'reservations' | 'settings';
  onNavigateSection: (sec: 'owners' | 'blocks' | 'reservations' | 'settings') => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  users,
  bookings,
  blocks,
  settings,
  activeSection,
  onNavigateSection,
}) => {
  // --- Section 1: User / Owner Management State ---
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    phone: '',
    partName: 'Parte V (25% indiviso)',
    annualQuotaDays: 30,
    color: '#3A5A40',
  });

  // --- Section 2: Date Blocks State ---
  const [isNewBlockModalOpen, setIsNewBlockModalOpen] = useState(false);
  const [blockFormData, setBlockFormData] = useState({
    startDate: '',
    endDate: '',
    title: '',
    reason: 'maintenance' as DateBlock['reason'],
    notes: '',
  });

  // --- Section 3: Consolidated Bookings Filters ---
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // --- Section 4: Settings State ---
  const [settingsFormData, setSettingsFormData] = useState<TrustSettings>(settings);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false);

  // Cancellation Modal for Admin
  const [adminCancelBookingId, setAdminCancelBookingId] = useState<string | null>(null);
  const [adminCancelReason, setAdminCancelReason] = useState('');

  // Handle User Edit / Save
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      storageService.saveUser({
        ...editingUser,
        name: userFormData.name,
        email: userFormData.email,
        phone: userFormData.phone,
        partName: userFormData.partName,
        annualQuotaDays: Number(userFormData.annualQuotaDays),
        color: userFormData.color,
      });
      setEditingUser(null);
    } else {
      const newUser: User = {
        id: 'user-' + Date.now(),
        name: userFormData.name,
        email: userFormData.email,
        phone: userFormData.phone,
        partName: userFormData.partName,
        role: 'owner',
        annualQuotaDays: Number(userFormData.annualQuotaDays),
        usedDays: 0,
        pendingDays: 0,
        color: userFormData.color,
        avatarInitials: userFormData.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
        active: true,
        createdAt: new Date().toISOString().split('T')[0],
      };
      storageService.saveUser(newUser);
      setIsNewUserModalOpen(false);
    }
  };

  const handleToggleUserActive = (user: User) => {
    if (user.id === currentUser.id) {
      alert('No puede desactivar su propio usuario administrador.');
      return;
    }
    storageService.saveUser({
      ...user,
      active: !user.active,
    });
  };

  // Handle Date Block Save
  const handleSaveBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockFormData.startDate || !blockFormData.endDate || blockFormData.endDate < blockFormData.startDate) {
      alert('Las fechas de bloqueo no son válidas.');
      return;
    }

    const s = new Date(blockFormData.startDate + 'T00:00:00');
    const end = new Date(blockFormData.endDate + 'T00:00:00');
    const days = Math.round((end.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    storageService.createBlock({
      startDate: blockFormData.startDate,
      endDate: blockFormData.endDate,
      totalDays: days,
      reason: blockFormData.reason,
      title: blockFormData.title,
      notes: blockFormData.notes || undefined,
      createdBy: `${currentUser.name} (Administrador)`,
    });

    setIsNewBlockModalOpen(false);
    setBlockFormData({
      startDate: '',
      endDate: '',
      title: '',
      reason: 'maintenance',
      notes: '',
    });
  };

  const handleDeleteBlock = (blockId: string) => {
    if (confirm('¿Está seguro de desbloquear estas fechas?')) {
      storageService.deleteBlock(blockId);
    }
  };

  // Handle Admin Cancel Booking
  const handleAdminCancelBooking = () => {
    if (!adminCancelBookingId) return;
    storageService.cancelBooking(
      adminCancelBookingId,
      adminCancelReason || 'Cancelación de oficio por Administración Fiduciaria',
      `${currentUser.name} (Admin)`
    );
    setAdminCancelBookingId(null);
    setAdminCancelReason('');
  };

  // Filtered Bookings for consolidated list
  const filteredBookings = bookings.filter((b) => {
    if (filterOwner !== 'all' && b.userId !== filterOwner) return false;
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        b.userName.toLowerCase().includes(q) ||
        b.partName.toLowerCase().includes(q) ||
        b.checkInDate.includes(q) ||
        (b.notes && b.notes.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Export Bookings to CSV
  const handleExportCSV = () => {
    const headers = [
      'ID Reserva',
      'Copropietario',
      'Parte Indivisa',
      'Check-in',
      'Check-out',
      'Días Totales',
      'Huéspedes',
      'Estado',
      'Sanitización Buffer',
      'Fecha Creación',
      'Observaciones',
    ];

    const rows = filteredBookings.map((b) => [
      b.id,
      `"${b.userName}"`,
      `"${b.partName}"`,
      b.checkInDate,
      b.checkOutDate,
      b.totalDays,
      b.guestsCount,
      b.status,
      b.cleaningBufferApplied ? 'Sí (24h)' : 'No',
      b.createdAt.split('T')[0],
      `"${(b.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `reporte_ocupacion_el_desayuno_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report Handler
  const handlePrintReport = () => {
    window.print();
  };

  // Handle Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    storageService.saveSettings(settingsFormData);
    setSettingsSavedMessage(true);
    setTimeout(() => setSettingsSavedMessage(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Admin Sub Navigation Bar */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-[#F4EFE6] border border-[#DCD4C0] flex-wrap">
          <button
            onClick={() => onNavigateSection('owners')}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              activeSection === 'owners'
                ? 'bg-[#1B3B2B] text-white shadow-xs'
                : 'text-[#4F6254] hover:text-[#19231A]'
            }`}
          >
            Gestión Copropietarios
          </button>
          <button
            onClick={() => onNavigateSection('reservations')}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              activeSection === 'reservations'
                ? 'bg-[#1B3B2B] text-white shadow-xs'
                : 'text-[#4F6254] hover:text-[#19231A]'
            }`}
          >
            Consolidado Reservas
          </button>
          <button
            onClick={() => onNavigateSection('blocks')}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              activeSection === 'blocks'
                ? 'bg-[#1B3B2B] text-white shadow-xs'
                : 'text-[#4F6254] hover:text-[#19231A]'
            }`}
          >
            Bloqueos Mantenimiento
          </button>
          <button
            onClick={() => onNavigateSection('settings')}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              activeSection === 'settings'
                ? 'bg-[#1B3B2B] text-white shadow-xs'
                : 'text-[#4F6254] hover:text-[#19231A]'
            }`}
          >
            Configuración Fideicomiso
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeSection === 'owners' && (
            <button
              onClick={() => {
                setEditingUser(null);
                setUserFormData({
                  name: '',
                  email: '',
                  phone: '',
                  partName: 'Parte Indivisa',
                  annualQuotaDays: 30,
                  color: '#3D5A40',
                });
                setIsNewUserModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-[#BFA270]" />
              <span>Alta Propietario</span>
            </button>
          )}

          {activeSection === 'blocks' && (
            <button
              onClick={() => setIsNewBlockModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-[#BFA270]" />
              <span>Nuevo Bloqueo</span>
            </button>
          )}

          {activeSection === 'reservations' && (
            <>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-semibold text-[#163323] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-800" />
                <span>Exportar CSV</span>
              </button>
              <button
                onClick={handlePrintReport}
                className="px-3 py-1.5 bg-[#F6F2E8] hover:bg-[#EDE6D7] border border-[#DDD5BF] text-xs font-semibold text-[#163323] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. GESTIÓN DE COPROPIETARIOS / BENEFICIARIOS */}
      {/* ========================================================= */}
      {activeSection === 'owners' && (
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs">
          <div className="pb-4 mb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#163323]">
                Padrón de Copropietarios y Asignación de Cupos
              </h3>
              <p className="text-xs text-[#7A8E7E]">
                Configuración del saldo de días anuales y color asignado en el calendario.
              </p>
            </div>
            <div className="text-xs text-[#526657] font-medium">
              Total partes activas: {users.filter((u) => u.role === 'owner' && u.active).length}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8F5EE] border-b border-[#E3DFC8] text-[#55695B] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3">Copropietario</th>
                  <th className="py-3 px-3">Participación / Cuota</th>
                  <th className="py-3 px-3">Color Calendario</th>
                  <th className="py-3 px-3">Cupo Asignado</th>
                  <th className="py-3 px-3">Días Consumidos</th>
                  <th className="py-3 px-3">Saldo Restante</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0]">
                {users.map((u) => {
                  const remaining = Math.max(0, u.annualQuotaDays - u.usedDays);
                  return (
                    <tr key={u.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ backgroundColor: u.color }}
                          >
                            {u.avatarInitials}
                          </div>
                          <div>
                            <span className="font-semibold text-[#163323] block leading-tight">
                              {u.name}
                            </span>
                            <span className="text-[11px] text-[#7A8E7E] block">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium text-[#4F6254]">{u.partName}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: u.color }}
                          />
                          <span className="font-mono text-[11px] text-[#7A8E7E]">{u.color}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-[#19231A]">
                        {u.role === 'admin' ? 'Ilimitado' : `${u.annualQuotaDays} días`}
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-[#8C6D3B]">
                        {u.role === 'admin' ? '-' : `${u.usedDays} días`}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold tabular-nums">
                        {u.role === 'admin' ? (
                          <span className="text-xs text-[#7A8E7E]">Fiduciario</span>
                        ) : (
                          <span
                            className={remaining > 0 ? 'text-emerald-800' : 'text-red-700'}
                          >
                            {remaining} días
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                            u.active ? 'bg-emerald-50 text-emerald-800' : 'bg-neutral-100 text-neutral-500'
                          }`}
                        >
                          {u.active ? 'Habilitado' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingUser(u);
                              setUserFormData({
                                name: u.name,
                                email: u.email,
                                phone: u.phone,
                                partName: u.partName,
                                annualQuotaDays: u.annualQuotaDays,
                                color: u.color,
                              });
                            }}
                            className="p-1 text-[#637568] hover:text-[#163323] cursor-pointer"
                            title="Modificar cupo y datos"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => handleToggleUserActive(u)}
                              className={`p-1 cursor-pointer ${
                                u.active
                                  ? 'text-amber-700 hover:text-amber-900'
                                  : 'text-emerald-700 hover:text-emerald-900'
                              }`}
                              title={u.active ? 'Desactivar acceso' : 'Habilitar acceso'}
                            >
                              {u.active ? 'Deshabilitar' : 'Activar'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. CONSOLIDADO DE TODAS LAS RESERVAS */}
      {/* ========================================================= */}
      {activeSection === 'reservations' && (
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs">
          <div className="pb-4 mb-4 border-b border-[#EFEAE0]">
            <h3 className="text-base font-bold text-[#163323]">
              Planilla Consolidada de Ocupación Anual
            </h3>
            <p className="text-xs text-[#7A8E7E]">
              Listado auditable de todas las reservas de los 4 propietarios para el año 2026.
            </p>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 p-3 bg-[#FAF8F5] border border-[#E6E0CF]">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-[#637568] mb-1">
                Filtrar por Copropietario
              </label>
              <select
                value={filterOwner}
                onChange={(e) => setFilterOwner(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#DCD4C0] text-xs focus:outline-none"
              >
                <option value="all">Todos los propietarios</option>
                {users
                  .filter((u) => u.role === 'owner')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.partName})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-[#637568] mb-1">
                Estado del Turno
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#DCD4C0] text-xs focus:outline-none"
              >
                <option value="all">Todos los estados</option>
                <option value="confirmed">Confirmadas</option>
                <option value="completed">Completadas / Pasadas</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-[#637568] mb-1">
                Búsqueda Rápida
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7A8E7E]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, nota o fecha..."
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-[#DCD4C0] text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Bookings Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8F5EE] border-b border-[#E3DFC8] text-[#55695B] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3">Copropietario</th>
                  <th className="py-3 px-3">Rango de Estadía</th>
                  <th className="py-3 px-3">Noches</th>
                  <th className="py-3 px-3">Huéspedes</th>
                  <th className="py-3 px-3">Limpieza 24h</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-3">Notas</th>
                  <th className="py-3 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0]">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#7A8E7E]">
                      No se encontraron reservas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-[#FAF8F5]">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: b.userColor }}
                          />
                          <div>
                            <span className="font-semibold text-[#163323] block leading-tight">
                              {b.userName}
                            </span>
                            <span className="text-[10px] text-[#7A8E7E] block">{b.partName}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#19231A] whitespace-nowrap">
                        {b.checkInDate} <span className="text-[#BFA270]">→</span> {b.checkOutDate}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold tabular-nums">
                        {b.totalDays} noches
                      </td>
                      <td className="py-3 px-3 text-[#4F6254]">{b.guestsCount} pax</td>
                      <td className="py-3 px-3">
                        {b.cleaningBufferApplied ? (
                          <span className="text-emerald-800 font-semibold text-[10px] flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> Bloqueada
                          </span>
                        ) : (
                          <span className="text-[#7A8E7E] text-[10px]">No</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                            b.status === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-800'
                              : b.status === 'completed'
                              ? 'bg-blue-50 text-blue-800'
                              : 'bg-red-50 text-red-800 line-through'
                          }`}
                        >
                          {b.status === 'confirmed'
                            ? 'Confirmada'
                            : b.status === 'completed'
                            ? 'Completada'
                            : 'Cancelada'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#637568] max-w-xs truncate">
                        {b.notes || '-'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {b.status === 'confirmed' && (
                          <button
                            onClick={() => {
                              setAdminCancelBookingId(b.id);
                              setAdminCancelReason('');
                            }}
                            className="px-2 py-1 bg-white hover:bg-red-50 border border-red-200 text-red-700 text-[10px] uppercase font-bold tracking-wider cursor-pointer"
                          >
                            Cancelar
                          </button>
                        )}
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
      {/* 3. BLOQUEO MANUAL DE FECHAS (OBRAS, MANTENIMIENTO) */}
      {/* ========================================================= */}
      {activeSection === 'blocks' && (
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs">
          <div className="pb-4 mb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#163323]">
                Bloqueos Administrativos y de Mantenimiento
              </h3>
              <p className="text-xs text-[#7A8E7E]">
                Inhabilite fechas para reparaciones, pintura, mantenimiento de pileta o imprevistos.
              </p>
            </div>
            <button
              onClick={() => setIsNewBlockModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Lock className="w-3.5 h-3.5 text-[#BFA270]" />
              <span>Inhabilitar Rango de Fechas</span>
            </button>
          </div>

          <div className="space-y-3">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="p-4 bg-[#FFFDF7] border-l-4 border-amber-500 border-y border-r border-[#E8E2D2] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-amber-900 uppercase text-[10px] tracking-wider">
                      {block.reason.toUpperCase()}
                    </span>
                    <span className="text-[#7A8E7E]">·</span>
                    <span className="font-mono font-bold text-[#163323]">
                      {block.startDate} al {block.endDate} ({block.totalDays} días)
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-[#163323] mt-0.5">{block.title}</h4>
                  {block.notes && <p className="text-xs text-[#4F6254] mt-1">{block.notes}</p>}
                  <span className="text-[10px] text-[#7A8E7E] block mt-1">
                    Registrado por {block.createdBy}
                  </span>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteBlock(block.id)}
                    className="px-3 py-1.5 bg-white hover:bg-red-50 border border-red-200 text-red-700 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Desbloquear Fechas</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. CONFIGURACIÓN DEL FIDEICOMISO */}
      {/* ========================================================= */}
      {activeSection === 'settings' && (
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs">
          <div className="pb-4 mb-4 border-b border-[#EFEAE0]">
            <h3 className="text-base font-bold text-[#163323]">
              Parámetros Operativos del Fideicomiso El Desayuno
            </h3>
            <p className="text-xs text-[#7A8E7E]">
              Reglas de margen de sanitización post check-out, límites y credenciales de la estancia.
            </p>
          </div>

          {settingsSavedMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Configuración guardada exitosamente y actualizada en tiempo real.</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                  Horas de Bloqueo de Sanitización Automática
                </label>
                <select
                  value={settingsFormData.autoCleaningBufferHours}
                  onChange={(e) =>
                    setSettingsFormData({
                      ...settingsFormData,
                      autoCleaningBufferHours: Number(e.target.value),
                    })
                  }
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none"
                >
                  <option value={12}>12 horas (Mismo día)</option>
                  <option value={24}>24 horas (Día siguiente completo - Recomendado)</option>
                  <option value={48}>48 horas (Sanitización especial fin de semana)</option>
                </select>
                <span className="text-[10px] text-[#7A8E7E] block mt-1">
                  Acondicionamiento del servicio de limpieza entre turnos.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                  Anticipación Mínima para Cancelar
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settingsFormData.cancellationMinDays}
                  onChange={(e) =>
                    setSettingsFormData({
                      ...settingsFormData,
                      cancellationMinDays: Number(e.target.value),
                    })
                  }
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none"
                />
                <span className="text-[10px] text-[#7A8E7E] block mt-1">
                  Días mínimos previos al check-in para que el dueño pueda cancelar en el portal.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                  Red Wi-Fi (SSID)
                </label>
                <input
                  type="text"
                  value={settingsFormData.wifiSsid}
                  onChange={(e) =>
                    setSettingsFormData({ ...settingsFormData, wifiSsid: e.target.value })
                  }
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                  Contraseña de Wi-Fi
                </label>
                <input
                  type="text"
                  value={settingsFormData.wifiPassword}
                  onChange={(e) =>
                    setSettingsFormData({ ...settingsFormData, wifiPassword: e.target.value })
                  }
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                Dirección Legal y Coordenadas para Emergencias
              </label>
              <input
                type="text"
                value={settingsFormData.emergencyAddress}
                onChange={(e) =>
                  setSettingsFormData({ ...settingsFormData, emergencyAddress: e.target.value })
                }
                className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none"
              />
            </div>

            <div className="pt-4 border-t border-[#EFEAE0]">
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Guardar Parámetros Fiduciarios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALS */}
      {/* ========================================================= */}

      {/* Modal: Add or Edit Owner */}
      {(isNewUserModalOpen || editingUser) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DED7C2] shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#163323] pb-3 border-b border-[#EFEAE0]">
              {editingUser ? 'Modificar Copropietario' : 'Alta de Nuevo Copropietario'}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  required
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Email de Acceso
                  </label>
                  <input
                    type="email"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Teléfono Celular
                  </label>
                  <input
                    type="text"
                    value={userFormData.phone}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Denominación de Parte
                  </label>
                  <input
                    type="text"
                    value={userFormData.partName}
                    onChange={(e) => setUserFormData({ ...userFormData, partName: e.target.value })}
                    placeholder="Parte I (25%)"
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Cupo Anual de Días
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={userFormData.annualQuotaDays}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, annualQuotaDays: Number(e.target.value) })
                    }
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Color Identificador en Calendario
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={userFormData.color}
                    onChange={(e) => setUserFormData({ ...userFormData, color: e.target.value })}
                    className="w-10 h-8 border cursor-pointer"
                  />
                  <span className="font-mono text-xs">{userFormData.color}</span>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#EFEAE0]">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewUserModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 text-[#637568] hover:text-[#19231A]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1B3B2B] text-white font-semibold uppercase tracking-wider hover:bg-[#132A1F]"
                >
                  Guardar Copropietario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Date Block */}
      {isNewBlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DED7C2] shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#163323] pb-3 border-b border-[#EFEAE0] flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-700" />
              <span>Bloquear Rango de Fechas por Mantenimiento</span>
            </h3>

            <form onSubmit={handleSaveBlock} className="space-y-3 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    value={blockFormData.startDate}
                    onChange={(e) =>
                      setBlockFormData({ ...blockFormData, startDate: e.target.value })
                    }
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Fecha de Fin
                  </label>
                  <input
                    type="date"
                    min={blockFormData.startDate}
                    value={blockFormData.endDate}
                    onChange={(e) => setBlockFormData({ ...blockFormData, endDate: e.target.value })}
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Motivo Principal
                </label>
                <select
                  value={blockFormData.reason}
                  onChange={(e) =>
                    setBlockFormData({
                      ...blockFormData,
                      reason: e.target.value as DateBlock['reason'],
                    })
                  }
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                >
                  <option value="maintenance">Mantenimiento Preventivo Edilicio</option>
                  <option value="repairs">Reparaciones Urgentes (Bombas / Caldera)</option>
                  <option value="deep_cleaning">Limpieza y Desinfección Profunda</option>
                  <option value="seasonal_prep">Apertura / Cierre de Temporada de Pileta</option>
                  <option value="extraordinary">Causa Extraordinaria / Climatológica</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Título Descriptivo
                </label>
                <input
                  type="text"
                  value={blockFormData.title}
                  onChange={(e) => setBlockFormData({ ...blockFormData, title: e.target.value })}
                  placeholder="ej. Service Oficial de Caldera y Pintura de Deck"
                  required
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Detalles y Contratista (Opcional)
                </label>
                <textarea
                  value={blockFormData.notes}
                  onChange={(e) => setBlockFormData({ ...blockFormData, notes: e.target.value })}
                  rows={2}
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#EFEAE0]">
                <button
                  type="button"
                  onClick={() => setIsNewBlockModalOpen(false)}
                  className="px-4 py-2 text-[#637568] hover:text-[#19231A]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-800 text-white font-semibold uppercase tracking-wider hover:bg-amber-900"
                >
                  Inhabilitar Fechas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Cancel Booking */}
      {adminCancelBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-md border border-[#DED7C2] shadow-2xl p-6">
            <h3 className="text-base font-bold text-red-800 pb-3 border-b border-[#EFEAE0] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>Cancelación Extraordinaria de Reserva</span>
            </h3>

            <p className="text-xs text-[#4F6254] mt-3 leading-relaxed">
              Como Administrador Fiduciario, al cancelar esta reserva las fechas quedarán
              inmediatamente liberadas en el calendario y los días se reintegrarán al saldo del
              propietario.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                Motivo Oficial de la Cancelación
              </label>
              <textarea
                value={adminCancelReason}
                onChange={(e) => setAdminCancelReason(e.target.value)}
                placeholder="Indique la causa legal o imprevisto de fuerza mayor..."
                rows={3}
                required
                className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-[#EFEAE0]">
              <button
                type="button"
                onClick={() => setAdminCancelBookingId(null)}
                className="px-3.5 py-2 text-xs font-semibold text-[#637568] hover:text-[#19231A]"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleAdminCancelBooking}
                className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white text-xs font-semibold uppercase tracking-wider"
              >
                Ejecutar Cancelación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
