import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { storageService } from '../services/storageService';
import { User } from '../types';
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, Info } from 'lucide-react';
import { APP_VERSION } from '../version';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Por favor ingrese su correo electrónico.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const res = storageService.login(email, password);
      setLoading(false);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError(res.error || 'Credenciales incorrectas.');
      }
    }, 350);
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[#F4F1E9] text-[#343D39]">
      {/* Decorative top border strip with trust green */}
      <div className="h-1.5 w-full bg-[#18332F]" />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10">
        <div className="w-full max-w-[480px]">
          {/* Main Card */}
          <div className="bg-white border border-[#DCE3DD] shadow-[0_14px_40px_-18px_rgba(24,51,47,0.22)] p-8 sm:p-10">
            {/* Header with Heraldic Seal */}
            <div className="flex flex-col items-center text-center pb-7 border-b border-[#EFE9DA]">
              <BrandLogo size="2xl" variant="seal-only" />

              <div className="mt-4">
                <h1
                  className="text-2xl font-bold tracking-[0.06em] text-[#18332F]"
                  style={{ fontFamily: "'HK Grotesk', 'Avenir Next', Arial, sans-serif" }}
                >
                  EL DESAYUNO
                </h1>
                <div className="text-[11px] font-medium tracking-[0.28em] text-[#657B7B] uppercase mt-1">
                  F I D E I C O M I S O
                </div>
                <div className="text-[10px] tracking-wider text-[#657B7B] uppercase mt-1">
                  Gestión patrimonial privada
                </div>
              </div>
              <div className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1 bg-[#F4F1E9] border border-[#DCE3DD] text-[11px] text-[#18332F] font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#18332F]" />
                <span>Portal Privado de Beneficiarios</span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-6 p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs space-y-1.5 animate-fade-in">
                <div className="flex items-start gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{error}</span>
                </div>
                <p className="text-[11px] text-red-700 pl-6 leading-relaxed">
                  💡 <strong>¿Usas Microsoft Edge o Chrome?</strong> Si el navegador autocompletó tu clave anterior guardada, borra el campo de contraseña e ingresa manualmente tu nuevo código de 6 dígitos. Luego haz clic en "Actualizar contraseña" en la ventana emergente del navegador.
                </p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1.5">
                  Usuario o Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8E7E]" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ingrese usuario o correo electrónico"
                    autoComplete="username"
                    required
                    className="w-full pl-10 pr-3 py-2.5 bg-[#FAF8F5] border border-[#DCD4C0] text-[#19231A] text-sm focus:outline-none focus:border-[#1E3F20] focus:ring-1 focus:ring-[#1E3F20] transition-colors font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A]">
                    Contraseña Alfanumérica (6 Dígitos)
                  </label>
                  <span className="text-[11px] text-[#7A8E7E] italic">Acceso restringido</span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8E7E]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    autoComplete="current-password"
                    required
                    className="w-full pl-10 pr-3 py-2.5 bg-[#FAF8F5] border border-[#DCD4C0] text-[#19231A] text-sm focus:outline-none focus:border-[#1E3F20] focus:ring-1 focus:ring-[#1E3F20] transition-colors font-mono tracking-widest"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-[#18332F] hover:bg-[#0D2522] active:bg-[#081A18] text-white font-semibold text-xs uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <span className="inline-block animate-pulse">Autenticando...</span>
                ) : (
                  <>
                    <span>Ingresar al Panel</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Security note */}
            <div className="mt-6 flex items-start gap-2 text-[11px] text-[#6E8072] leading-tight bg-[#FAF8F5] p-3 border border-[#E9E4D4]">
              <Info className="w-4 h-4 shrink-0 text-[#8C7A53] mt-0.5" />
              <span>
                Esta plataforma es de uso exclusivo y confidencial para los fiduciantes beneficiarios del Fideicomiso El Desayuno. Los nuevos ingresos son gestionados únicamente por el Administrador.
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-[#657B7B] border-t border-[#DCE3DD] bg-[#FCFCF8]">
        <p className="flex items-center justify-center gap-2 flex-wrap">
          <span>El Desayuno Sociedad © {new Date().getFullYear()} · Sistema de Gestión de Estadías y Reserva de Turnos</span>
          <span
            className="font-mono font-bold text-[#163323] bg-[#EFE9DB] px-1.5 py-0.5 rounded text-[10px] border border-[#D5CDBC]"
            title={`Versión de producción: ${APP_VERSION}`}
          >
            {APP_VERSION}
          </span>
        </p>
      </footer>
    </div>
  );
};
