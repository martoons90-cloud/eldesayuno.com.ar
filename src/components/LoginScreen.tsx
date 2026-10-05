import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { storageService, DEFAULT_USERS } from '../services/storageService';
import { User } from '../types';
import { Lock, Mail, ArrowRight, ShieldCheck, KeyRound, AlertCircle, Info } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemoSelector, setShowDemoSelector] = useState(false);

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

  const handleSelectDemoUser = (user: User) => {
    setEmail(user.email);
    setPassword('••••••••••••');
    setError(null);
    setLoading(true);
    setTimeout(() => {
      const res = storageService.login(user.email, 'demo');
      setLoading(false);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      }
    }, 200);
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[#F8F5EE] text-[#19231A]">
      {/* Decorative top border strip with trust green */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#17341B] via-[#2A4D32] to-[#BFA270]" />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10">
        <div className="w-full max-w-[480px]">
          {/* Main Card */}
          <div className="bg-[#FFFFFF] border border-[#E5DEC9] shadow-[0_10px_35px_-10px_rgba(23,43,26,0.1)] p-8 sm:p-10">
            {/* Header with Heraldic Seal */}
            <div className="flex flex-col items-center text-center pb-7 border-b border-[#EFE9DA]">
              <BrandLogo size="2xl" variant="seal-only" />

              <div className="mt-4">
                <h1
                  className="text-2xl font-bold tracking-wider text-[#163323]"
                  style={{ fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif" }}
                >
                  EL DESAYUNO
                </h1>
                <div className="text-[11px] font-semibold tracking-[0.25em] text-[#A68853] uppercase mt-1">
                  S O C I E D A D
                </div>
                <div className="text-[10px] tracking-wider text-[#637568] uppercase mt-1">
                  Cuatro Partes, Un Mismo Objetivo
                </div>
              </div>
              <div className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1 bg-[#F4EFE6] border border-[#E3DFC8] text-[11px] text-[#2D4E35] font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2D4E35]" />
                <span>Portal Privado de Beneficiarios</span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-6 p-3 bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1.5">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8E7E]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="socio@eldesayuno.com"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-3 py-2.5 bg-[#FAF8F5] border border-[#DCD4C0] text-[#19231A] text-sm focus:outline-none focus:border-[#1E3F20] focus:ring-1 focus:ring-[#1E3F20] transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A]">
                    Contraseña
                  </label>
                  <span className="text-[11px] text-[#7A8E7E] italic">Acceso restringido</span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8E7E]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full pl-10 pr-3 py-2.5 bg-[#FAF8F5] border border-[#DCD4C0] text-[#19231A] text-sm focus:outline-none focus:border-[#1E3F20] focus:ring-1 focus:ring-[#1E3F20] transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-[#1B3B2B] hover:bg-[#142D21] active:bg-[#0E2017] text-[#FAF8F5] font-semibold text-xs uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer"
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

            {/* Quick Demo Access Switcher for Testing */}
            <div className="mt-8 pt-6 border-t border-[#EFE9DA]">
              <button
                type="button"
                onClick={() => setShowDemoSelector(!showDemoSelector)}
                className="w-full flex items-center justify-between text-xs text-[#526657] hover:text-[#163323] transition-colors py-1 cursor-pointer font-medium"
              >
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>Acceso Rápido de Prueba (Copropietarios / Admin)</span>
                </span>
                <span className="text-[11px] underline">
                  {showDemoSelector ? 'Ocultar' : 'Ver Cuentas'}
                </span>
              </button>

              {showDemoSelector && (
                <div className="mt-3 space-y-1.5 bg-[#F9F7F1] p-3 border border-[#E6E0CF]">
                  <p className="text-[11px] text-[#6A7C6E] mb-2 leading-relaxed">
                    Haga clic en cualquiera de los perfiles autorizados para ingresar de forma inmediata:
                  </p>
                  {DEFAULT_USERS.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectDemoUser(u)}
                      className="w-full text-left p-2 bg-[#FFFFFF] hover:bg-[#FAF8F5] border border-[#E4DEC9] hover:border-[#1E3F20] transition-all flex items-center justify-between text-xs cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: u.color }}
                        />
                        <div>
                          <span className="font-semibold text-[#1E3F20] group-hover:underline">
                            {u.name}
                          </span>
                          <span className="text-[10px] text-[#637568] block">
                            {u.partName} {u.role === 'admin' ? '(Admin)' : `· Cupo: ${u.annualQuotaDays}d`}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#8C7A53] font-mono group-hover:text-[#1E3F20]">
                        Entrar →
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

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
      <footer className="py-4 text-center text-xs text-[#7B8D7F] border-t border-[#E8E2D2] bg-[#FAF8F4]">
        <p>
          El Desayuno Sociedad © {new Date().getFullYear()} · Sistema de Gestión de Estadías y Reserva de Turnos
        </p>
      </footer>
    </div>
  );
};
