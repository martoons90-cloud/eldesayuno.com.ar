import React, { useState } from 'react';
import { User } from '../types';
import { storageService } from '../services/storageService';
import { Shield, ShieldAlert, Check, X, AlertTriangle, ArrowRight } from 'lucide-react';

interface TransferAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAdmin: User;
  users: User[];
  onTransferSuccess: (newAdminUser: User) => void;
}

export const TransferAdminModal: React.FC<TransferAdminModalProps> = ({
  isOpen,
  onClose,
  currentAdmin,
  users,
  onTransferSuccess,
}) => {
  const eligibleUsers = users.filter((u) => u.id !== currentAdmin.id && u.active);
  const [selectedUserId, setSelectedUserId] = useState<string>(eligibleUsers[0]?.id || '');
  const [confirmStep, setConfirmStep] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const handleExecuteTransfer = () => {
    if (!selectedUserId) {
      setError('Seleccione un copropietario para transferir la administración.');
      return;
    }

    const res = storageService.transferAdminRole(selectedUserId, currentAdmin.id);
    if (res.success && selectedUser) {
      onTransferSuccess(selectedUser);
      onClose();
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-[#D5CDBC] max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1B3B2B] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#BFA270]" />
            <h3 className="text-sm font-bold uppercase tracking-wider">
              Transferir Poder de Administración Fiduciaria
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#C7D3C9] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          {/* Current Admin Notice */}
          <div className="p-3.5 bg-[#FAF8F5] border border-[#E6E0CF] flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#A68853] block">
                Administrador Actual
              </span>
              <span className="font-bold text-[#163323] text-sm">{currentAdmin.name}</span>
              <span className="text-[11px] text-[#7A8E7E] block">{currentAdmin.email}</span>
            </div>
            <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold uppercase text-[9px] tracking-wider">
              Poder Activo
            </span>
          </div>

          {!confirmStep ? (
            <>
              <div>
                <label className="block font-bold uppercase tracking-wider text-[#35483A] mb-1.5">
                  Seleccionar Nuevo Administrador
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#DCD4C0] text-xs text-[#163323] focus:outline-none focus:border-[#1E3F20]"
                >
                  {eligibleUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.partName} ({u.email})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#7A8E7E] mt-1.5 leading-relaxed">
                  El usuario seleccionado asumirá todos los permisos de gestión, bloqueos de fechas, parámetros del fideicomiso y administración de contraseñas.
                </p>
              </div>

              {selectedUser && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900">
                  <span className="font-bold block">Nuevo Administrador Designado:</span>
                  <span className="text-xs">
                    {selectedUser.name} ({selectedUser.partName}) — Clave: <span className="font-mono font-bold">{selectedUser.password}</span>
                  </span>
                </div>
              )}

              {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 text-xs">
                  {error}
                </div>
              )}

              {/* Step 1 Actions */}
              <div className="pt-4 border-t border-[#EAE3D3] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-white hover:bg-[#FAF8F5] border border-[#DDD5BF] text-[#163323] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmStep(true)}
                  disabled={!selectedUserId}
                  className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <span>Continuar Traspaso</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Step 2 Confirmation */}
              <div className="p-4 bg-amber-50 border border-amber-300 text-amber-950 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
                  <span>¿Confirmar Traspaso de Administración?</span>
                </div>
                <p className="leading-relaxed text-xs">
                  Está a punto de ceder el poder de Administrador General a <strong>{selectedUser?.name}</strong>.
                  Usted ({currentAdmin.name}) pasará a ser socio copropietario y no podrá revertir esta acción sin autorización del nuevo administrador.
                </p>
              </div>

              {/* Step 2 Actions */}
              <div className="pt-4 border-t border-[#EAE3D3] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmStep(false)}
                  className="px-3.5 py-2 bg-white hover:bg-[#FAF8F5] border border-[#DDD5BF] text-[#163323] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleExecuteTransfer}
                  className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Confirmar y Transferir Poder</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
