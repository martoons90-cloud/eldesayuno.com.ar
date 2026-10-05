import React from 'react';
import { User, Booking, DateBlock } from '../types';
import { Calendar, CheckCircle2, Clock, CalendarDays, ArrowUpRight, Sparkles, AlertCircle } from 'lucide-react';

interface OwnerQuotaSummaryProps {
  currentUser: User;
  bookings: Booking[];
  blocks: DateBlock[];
  onOpenNewBooking: () => void;
  onGoToCalendar: () => void;
  onGoToMyBookings: () => void;
}

export const OwnerQuotaSummary: React.FC<OwnerQuotaSummaryProps> = ({
  currentUser,
  bookings,
  blocks,
  onOpenNewBooking,
  onGoToCalendar,
  onGoToMyBookings,
}) => {
  const currentYear = 2026;
  const assigned = currentUser.annualQuotaDays;
  const used = currentUser.usedDays;
  const remaining = Math.max(0, assigned - used);
  const percentageUsed = assigned > 0 ? Math.min(100, Math.round((used / assigned) * 100)) : 0;

  // Upcoming bookings for this owner
  const myUpcomingBookings = bookings
    .filter(
      (b) =>
        b.userId === currentUser.id &&
        b.status === 'confirmed' &&
        b.checkOutDate >= new Date().toISOString().split('T')[0]
    )
    .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));

  // Next upcoming stay
  const nextStay = myUpcomingBookings[0];

  return (
    <div className="space-y-6">
      {/* Welcome & Quota Hero Banner */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 sm:p-8 shadow-[0_4px_20px_-4px_rgba(23,43,26,0.06)] relative overflow-hidden">
        {/* Subtle decorative heritage background accent */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#F8F5EE] to-transparent pointer-events-none hidden md:block" />

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#EFEAE0]">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#7A8E7E]">
                <span>Fideicomiso El Desayuno</span>
                <span aria-hidden="true">·</span>
                <span>Temporada {currentYear}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-[#1B3B2B]">{currentUser.partName}</span>
              </div>
              <h1
                className="text-2xl sm:text-3xl font-bold text-[#163323] mt-1.5"
                style={{ fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif" }}
              >
                Bienvenido, {currentUser.name}
              </h1>
              <p className="text-sm text-[#4E6152] mt-1 max-w-2xl leading-relaxed">
                Panel privado de gestión de estadías. Consulte la disponibilidad en tiempo real de la casa de veraneo y reserve sus turnos anuales con confirmación inmediata.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={onOpenNewBooking}
                disabled={remaining === 0}
                className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] active:bg-[#0E2017] text-[#FAF8F5] text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                <CalendarDays className="w-4 h-4 text-[#BFA270]" />
                <span>Solicitar Reserva</span>
              </button>

              <button
                onClick={onGoToCalendar}
                className="px-4 py-2.5 bg-[#F6F2E8] hover:bg-[#EDE6D7] text-[#1B3B2B] border border-[#DDD5BF] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Ver Calendario</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Metric Grid - High density tabular display */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
            {/* Cupo Asignado */}
            <div className="border-l-2 border-[#1B3B2B] pl-4">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6C7E70] block">
                Cupo Anual Asignado
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-[#19231A]">
                  {assigned}
                </span>
                <span className="text-xs text-[#6C7E70] font-medium">días ({currentYear})</span>
              </div>
              <p className="text-xs text-[#7A8E7E] mt-1.5">
                Correspondiente a su participación del 25% indiviso.
              </p>
            </div>

            {/* Días Utilizados */}
            <div className="border-l-2 border-[#BFA270] pl-4">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6C7E70] block">
                Días Utilizados / Comprometidos
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-[#8F6F3A]">
                  {used}
                </span>
                <span className="text-xs text-[#6C7E70] font-medium">días consumidos</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-[#7A8E7E]">
                <span>{percentageUsed}% del cupo ejecutado</span>
              </div>
            </div>

            {/* Días Restantes */}
            <div className="border-l-2 border-emerald-700 pl-4 bg-[#FAF9F5] sm:bg-transparent -ml-2 p-2 sm:p-0 sm:ml-0">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-800 block">
                Saldo Disponible de Estadía
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-[#17341B]">
                  {remaining}
                </span>
                <span className="text-xs text-[#17341B] font-bold">días libres para reservar</span>
              </div>
              <p className="text-xs text-[#4F6254] mt-1.5">
                {remaining > 0
                  ? 'Disponibles para turnos regulares o fines de semana.'
                  : 'Ha completado el cupo asignado para el ejercicio actual.'}
              </p>
            </div>
          </div>

          {/* Quota Progress Bar */}
          <div className="mt-6 pt-4 border-t border-[#F0EAE0]">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-[#2D4534]">Distribución de Días {currentYear}</span>
              <span className="font-mono tabular-nums text-[#6C7E70]">
                {used} / {assigned} días ({percentageUsed}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#EFEAE0] overflow-hidden">
              <div
                className="h-full bg-[#1B3B2B] transition-all duration-500 ease-out"
                style={{ width: `${percentageUsed}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Next Upcoming Stay & House Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Upcoming Stay Card (2 cols) */}
        <div className="lg:col-span-2 bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#EFEAE0]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#1B3B2B]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#163323]">
                  Su Próxima Estadía Confirmada
                </h3>
              </div>
              <button
                onClick={onGoToMyBookings}
                className="text-xs font-semibold text-[#1B3B2B] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver todas mis reservas ({myUpcomingBookings.length})</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {nextStay ? (
              <div className="mt-4 p-4 bg-[#FBF9F5] border border-[#EBE4D5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#7A8E7E] mb-1">
                    <span>Check-in: 14:00 hs</span>
                    <span>·</span>
                    <span>Check-out: 11:00 hs</span>
                    <span>·</span>
                    <span className="font-medium text-[#1B3B2B]">{nextStay.totalDays} noches</span>
                  </div>
                  <div className="text-lg font-bold text-[#163323] flex items-center gap-2">
                    <span>{nextStay.checkInDate}</span>
                    <span className="text-[#BFA270]">→</span>
                    <span>{nextStay.checkOutDate}</span>
                  </div>
                  {nextStay.notes && (
                    <p className="text-xs text-[#4F6254] mt-1.5 italic">
                      “{nextStay.notes}”
                    </p>
                  )}
                  <div className="mt-2 text-[11px] text-[#637568] flex items-center gap-2">
                    <span>Huéspedes previstos: {nextStay.guestsCount} personas</span>
                    <span>·</span>
                    <span className="text-emerald-800 font-semibold">Confirmada por Fideicomiso</span>
                  </div>
                </div>

                <div className="shrink-0 flex sm:flex-col gap-2">
                  <button
                    onClick={onGoToMyBookings}
                    className="px-3 py-1.5 bg-[#FFFFFF] border border-[#D5CDBC] hover:border-[#1B3B2B] text-xs font-semibold text-[#1B3B2B] transition-colors cursor-pointer"
                  >
                    Detalles del Turno
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-[#7A8E7E]">
                <Clock className="w-8 h-8 mx-auto text-[#C5BAA0] mb-2" />
                <p className="text-sm font-medium text-[#2D4534]">No tiene estadías próximas programadas</p>
                <p className="text-xs text-[#7A8E7E] mt-1">
                  Tiene {remaining} días disponibles para disfrutar en la casa de veraneo.
                </p>
                <button
                  onClick={onOpenNewBooking}
                  className="mt-4 px-4 py-2 bg-[#1B3B2B] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#132A1F] transition-colors cursor-pointer"
                >
                  Elegir Fechas en Calendario
                </button>
              </div>
            )}
          </div>

          {/* Quick House Amenities info strip */}
          <div className="mt-6 pt-4 border-t border-[#EFEAE0] flex flex-wrap items-center justify-between text-xs text-[#637568] gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>Casa lista y operativa</span>
            </span>
            <span>Piscina habilitada</span>
            <span>Wi-Fi Fibra 300MB</span>
            <span>Casero permanente (Don Raúl)</span>
          </div>
        </div>

        {/* Casa / Field Information Snapshot (1 col) */}
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-[#EFEAE0]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#A68853]">
                Información de la Propiedad
              </span>
              <h3 className="text-base font-bold text-[#163323] mt-0.5">
                Estancia El Desayuno
              </h3>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <span className="text-[#7A8E7E] block text-[11px]">Ubicación</span>
                <span className="font-medium text-[#19231A]">
                  Ruta Prov. 41, Km 82 (San Antonio de Areco)
                </span>
              </div>
              <div>
                <span className="text-[#7A8E7E] block text-[11px]">Capacidad Autorizada</span>
                <span className="font-medium text-[#19231A]">
                  Hasta 12 huéspedes pernoctando
                </span>
              </div>
              <div>
                <span className="text-[#7A8E7E] block text-[11px]">Horarios Oficiales</span>
                <span className="font-medium text-[#19231A]">
                  Ingreso 14:00 hs · Salida 11:00 hs
                </span>
              </div>
              <div>
                <span className="text-[#7A8E7E] block text-[11px]">Margen Sanitización Post Turno</span>
                <span className="font-medium text-[#19231A]">
                  24 horas bloqueadas para limpieza profunda
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#EFEAE0]">
            <div className="p-3 bg-[#FAF8F5] border border-[#E8E2D2] text-[11px] text-[#4F6254]">
              <span className="font-semibold block text-[#1B3B2B] mb-0.5">
                Regla de Convivencia y Reserva
              </span>
              Para garantizar equidad entre las 4 partes, las cancelaciones deben realizarse con al menos 7 días de antelación.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
