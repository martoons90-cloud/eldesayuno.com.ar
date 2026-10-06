import React, { useState } from 'react';
import { User } from '../types';
import { storageService } from '../services/storageService';
import { KeyRound, Check, X, AlertCircle, Copy, CheckCheck, Lock } from 'lucide-react';

interface PasswordManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: User;
  isSelfChange?: boolean;
  onSuccess?: (newPassword: string) => void;
}

export const PasswordManagementModal: React.FC<PasswordManagementModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  isSelfChange = false,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState(targetUser.password || '');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateRandom = () => {
    // Generate 6-character alphanumeric code (e.g. 3 uppercase letters + 3 numbers)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(code);
    setError(null);
  };

  const handleCopy = () => {
    if (newPassword) {
      navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = newPassword.trim().toUpperCase();

    if (clean.length !== 6) {
      setError('La contraseña debe tener exactamente 6 caracteres alfanuméricos.');
      return;
    }

    const res = storageService.updateUserPassword(targetUser.id, clean);
    if (res.success) {
      setSuccessMsg(`Contraseña actualizada a "${clean}" correctamente.`);
      if (onSuccess) onSuccess(clean);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-[#D5CDBC] max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1B3B2B] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#BFA270]" />
            <h3 className="text-sm font-bold uppercase tracking-wider">
              {isSelfChange ? 'Cambiar Mi Contraseña' : `Gestionar Clave de ${targetUser.name}`}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* User Info Strip */}
          <div className="p-3 bg-[#FAF8F5] border border-[#E6E0CF] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className="w-6 h-6 rounded-full text-white font-bold text-[10px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: targetUser.color }}
              >
                {targetUser.avatarInitials}
              </span>
              <div>
                <span className="font-semibold text-[#163323] block leading-tight">
                  {targetUser.name}
                </span>
                <span className="text-[10px] text-[#7A8E7E]">{targetUser.email}</span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-neutral-100 text-neutral-800 border border-neutral-200">
              {targetUser.partName}
            </span>
          </div>

          {/* Current / New Password input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold uppercase tracking-wider text-[#35483A]">
                Contraseña Alfanumérica (6 Dígitos)
              </label>
              <button
                type="button"
                onClick={handleGenerateRandom}
                className="text-[11px] text-[#1B3B2B] font-semibold hover:underline cursor-pointer"
              >
                Generar automática
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  maxLength={6}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value.toUpperCase().slice(0, 6));
                    setError(null);
                  }}
                  placeholder="ej. ABC123"
                  className="w-full p-2.5 bg-white border border-[#DCD4C0] font-mono font-bold text-center text-base tracking-[0.3em] text-[#163323] focus:outline-none focus:border-[#1E3F20]"
                  required
                />
              </div>

              <button
                type="button"
                onClick={handleCopy}
                disabled={!newPassword}
                className="p-2.5 bg-[#FAF8F5] hover:bg-[#EDE6D8] border border-[#DCD4C0] text-[#163323] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                title="Copiar contraseña al portapapeles"
              >
                {copied ? (
                  <CheckCheck className="w-4 h-4 text-emerald-700" />
                ) : (
                  <Copy className="w-4 h-4 text-[#7A8E7E]" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-[#7A8E7E] mt-1">
              Código de acceso de 6 letras y números. Se guardará de inmediato y sincronizará con la base de datos.
            </p>
          </div>

          {/* Feedback banners */}
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-[#EAE3D3] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-white hover:bg-[#FAF8F5] border border-[#DDD5BF] text-[#163323] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Lock className="w-3.5 h-3.5 text-[#BFA270]" />
              <span>Guardar Contraseña</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
