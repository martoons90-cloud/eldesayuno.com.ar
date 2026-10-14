import React from 'react';
import { User, isUserAdmin, isUserIntendente, isUserFiduciante, isUserCabezaDeEquipo, hasPrivilegedAccess } from '../types';
import { UserRoleBadge, AvatarRolePin } from './UserRoleBadge';
import {
  X,
  ShieldCheck,
  Landmark,
  Award,
  Wrench,
  KeyRound,
  Mail,
  Phone,
  PieChart,
  Calendar,
  Lock,
  CheckCircle2,
  Receipt,
  FileText,
  UserCheck,
} from 'lucide-react';

interface UserProfileModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onOpenPasswordModal?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onOpenPasswordModal,
  onNavigateTab,
}) => {
  if (!isOpen) return null;

  const isAdmin = isUserAdmin(user);
  const isIntendente = isUserIntendente(user);
  const isFid = isUserFiduciante(user);
  const isLeader = isUserCabezaDeEquipo(user);
  const privileged = hasPrivilegedAccess(user);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DCD4C0] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between border-b border-[#BFA270]/40">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md border-2 border-white/20"
                style={{ backgroundColor: user.color }}
              >
                {user.avatarInitials}
              </div>
              <AvatarRolePin user={user} size="md" />
            </div>
            <div>
              <h3
                className="text-lg font-bold tracking-wide"
                style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
              >
                {user.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-[#D7CFBA]">{user.partName}</span>
                <span className="text-[10px] text-[#A68853] font-mono">
                  {(user.sharePercentage ?? 6.25).toFixed(4)}% de Acciones
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#C9D6CC] hover:text-white p-1.5 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
          {/* Roles & Special Distinction Banner */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#637568]">
                Designación Societaria & Fiduciaria
              </span>
              <UserRoleBadge user={user} size="md" />
            </div>

            {isAdmin && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <strong className="text-emerald-950 block text-[11px]">
                    Administrador General del Fideicomiso
                  </strong>
                  <span className="text-emerald-800 text-[11px]">
                    Facultades plenipotenciarias: Aprobación y cancelación de reservas, control operativo, liquidación de gastos y emisión de expensas.
                  </span>
                </div>
              </div>
            )}

            {isIntendente && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xs flex items-start gap-2.5">
                <Wrench className="w-4 h-4 text-teal-800 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <strong className="text-teal-950 block text-[11px]">
                    Intendente General de la Estancia
                  </strong>
                  <span className="text-teal-800 text-[11px]">
                    Operación 100% en el campo: Mantenimiento del predio, coordinación de caseros, inventarios, novedades, compras operativas y logística.
                  </span>
                </div>
              </div>
            )}

            {isFid && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xs flex items-start gap-2.5">
                <Landmark className="w-4 h-4 text-indigo-800 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <strong className="text-indigo-950 block text-[11px]">
                    Fiduciante del Fideicomiso
                  </strong>
                  <span className="text-indigo-800 text-[11px]">
                    Órgano Fiduciario Constitutivo: Acceso habilitado a libros societarios, rendiciones de gastos y todas las actas de asamblea notariales.
                  </span>
                </div>
              </div>
            )}

            {isLeader && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xs flex items-start gap-2.5">
                <Award className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <strong className="text-amber-950 block text-[11px]">
                    ★ Cabeza de Equipo (Líder Designado)
                  </strong>
                  <span className="text-amber-900 text-[11px]">
                    Representante oficial de {user.partName} ante el Fideicomiso. Cuenta con acceso especial habilitado al Libro de Gastos y las Actas de Asamblea.
                  </span>
                </div>
              </div>
            )}

            {!privileged && (
              <div className="p-3 bg-[#FAF8F5] border border-[#E5DEC9] rounded-xs flex items-start gap-2.5">
                <UserCheck className="w-4 h-4 text-[#163323] shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <strong className="text-[#163323] block text-[11px]">
                    Copropietario Beneficiario
                  </strong>
                  <span className="text-[#637568] text-[11px]">
                    Titular de cuota parte en la estancia con derecho a solicitud de turnos anuales, calendario compartido y rendición de sus expensas.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Contact & Credentials */}
          <div className="p-4 bg-[#FAF8F5] border border-[#E5DEC9] space-y-2.5">
            <h4 className="font-bold text-[11px] text-[#163323] uppercase tracking-wider pb-1 border-b border-[#E8E2D2]">
              Datos de Contacto y Acceso
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-[#7A8E7E] block">Correo Electrónico</span>
                <span className="font-semibold text-[#163323] flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>{user.email}</span>
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#7A8E7E] block">Usuario de Acceso</span>
                <span className="font-mono font-bold text-[#163323] block mt-0.5">
                  {user.username || user.email.split('@')[0]}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#7A8E7E] block">Teléfono / WhatsApp</span>
                <span className="font-medium text-[#163323] flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>{user.phone || 'No registrado'}</span>
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#7A8E7E] block">Estado en Padrón</span>
                <span
                  className={`inline-block font-bold text-[10px] px-2 py-0.5 mt-0.5 rounded-2xs ${
                    user.active
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}
                >
                  {user.active ? 'Socio Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>

          {/* Privileged Access Summary */}
          <div className="p-4 bg-white border border-[#E5DEC9] space-y-2">
            <h4 className="font-bold text-[11px] text-[#163323] uppercase tracking-wider pb-1 border-b border-[#E8E2D2] flex items-center justify-between">
              <span>Permisos de Acceso al Sistema</span>
              <span className="font-mono text-[10px] text-[#A68853]">
                {privileged ? 'Privilegiado' : 'Estándar'}
              </span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-[#163323]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Solicitud de Reservas</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#163323]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Calendario de Estancia</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#163323]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Inventario & Vajilla</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#163323]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Pago de Expensas</span>
              </div>

              {/* Special Access: Gastos & Actas */}
              <div
                className={`flex items-center gap-1.5 ${
                  privileged ? 'text-emerald-900 font-bold' : 'text-[#8C9B90]'
                }`}
              >
                {privileged ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-neutral-400" />
                )}
                <span>Libro de Gastos ({privileged ? 'Habilitado' : 'Reservado'})</span>
              </div>
              <div
                className={`flex items-center gap-1.5 ${
                  privileged ? 'text-emerald-900 font-bold' : 'text-[#8C9B90]'
                }`}
              >
                {privileged ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-neutral-400" />
                )}
                <span>Actas de Asamblea ({privileged ? 'Habilitado' : 'Reservado'})</span>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts if Privileged */}
          {privileged && onNavigateTab && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateTab('gastos');
                }}
                className="flex-1 py-2 px-3 bg-[#FAF8F5] hover:bg-[#F2EDE1] border border-[#DDD5BF] text-[#163323] font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5 text-[#BFA270]" />
                <span>Ir a Gastos</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateTab('actas');
                }}
                className="flex-1 py-2 px-3 bg-[#FAF8F5] hover:bg-[#F2EDE1] border border-[#DDD5BF] text-[#163323] font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-[#BFA270]" />
                <span>Ir a Actas</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#FAF8F5] border-t border-[#E5DEC9] flex items-center justify-between">
          {onOpenPasswordModal && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPasswordModal();
              }}
              className="text-xs text-[#163323] hover:underline font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#BFA270]" />
              <span>Cambiar mi Contraseña</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ml-auto"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
