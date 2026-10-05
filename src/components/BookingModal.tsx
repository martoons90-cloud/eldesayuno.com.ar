import React, { useState, useEffect } from 'react';
import { User, Booking, DateBlock } from '../types';
import { storageService } from '../services/storageService';
import { pushService } from '../services/notificationService';
import {
  Calendar,
  Clock,
  Users,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  ShieldCheck,
} from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  bookings: Booking[];
  blocks: DateBlock[];
  initialStartDate?: string | null;
  initialEndDate?: string | null;
  onBookingSuccess: (newBooking: Booking) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  bookings,
  blocks,
  initialStartDate,
  initialEndDate,
  onBookingSuccess,
}) => {
  const [checkInDate, setCheckInDate] = useState(initialStartDate || '');
  const [checkOutDate, setCheckOutDate] = useState(initialEndDate || '');
  const [guestsCount, setGuestsCount] = useState(4);
  const [arrivalTime, setArrivalTime] = useState('14:00');
  const [notes, setNotes] = useState('');
  const [applyCleaningBuffer, setApplyCleaningBuffer] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialStartDate) setCheckInDate(initialStartDate);
    if (initialEndDate) setCheckOutDate(initialEndDate);
  }, [initialStartDate, initialEndDate]);

  if (!isOpen) return null;

  // Calculate days requested
  const calculateDays = (start: string, end: string) => {
    if (!start || !end || end < start) return 0;
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const daysRequested = calculateDays(checkInDate, checkOutDate);
  const remainingQuota = Math.max(0, currentUser.annualQuotaDays - currentUser.usedDays);

  // Validation function
  const validateBooking = () => {
    if (!checkInDate || !checkOutDate) {
      return 'Debe seleccionar ambas fechas: Check-in y Check-out.';
    }
    if (checkOutDate < checkInDate) {
      return 'La fecha de check-out debe ser igual o posterior al check-in.';
    }
    if (daysRequested <= 0) {
      return 'El rango de días no es válido.';
    }

    // Quota validation
    if (currentUser.role === 'owner' && daysRequested > remainingQuota) {
      return `Saldo insuficiente: solicita ${daysRequested} días pero su cupo disponible es de ${remainingQuota} días.`;
    }

    // Overlap validation with active bookings
    const requestedStart = checkInDate;
    const requestedEnd = checkOutDate;

    // Check with bookings
    for (const b of bookings) {
      if (b.status === 'cancelled') continue;
      // Also consider existing booking's cleaning buffer if applied
      const bEffectiveEnd =
        b.cleaningBufferApplied && b.cleaningBufferEndDate ? b.cleaningBufferEndDate : b.checkOutDate;

      const overlap = !(requestedEnd < b.checkInDate || requestedStart > bEffectiveEnd);
      if (overlap) {
        return `Conflicto de fechas: el período se solapa con la reserva de ${b.userName} (${b.checkInDate} al ${b.checkOutDate}${
          b.cleaningBufferApplied ? ' + sanitización' : ''
        }).`;
      }
    }

    // Check with maintenance blocks
    for (const bl of blocks) {
      const overlap = !(requestedEnd < bl.startDate || requestedStart > bl.endDate);
      if (overlap) {
        return `Conflicto con bloqueo oficial: "${bl.title}" del ${bl.startDate} al ${bl.endDate}.`;
      }
    }

    // Capacity check
    if (guestsCount > 12) {
      return 'La capacidad máxima de la propiedad es de 12 huéspedes según reglamento.';
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const valError = validateBooking();
    if (valError) {
      setError(valError);
      return;
    }

    setLoading(true);

    // Calculate buffer end date (day after check-out)
    let bufferEndStr: string | undefined = undefined;
    if (applyCleaningBuffer && checkOutDate) {
      const nextDay = new Date(checkOutDate + 'T00:00:00');
      nextDay.setDate(nextDay.getDate() + 1);
      bufferEndStr = nextDay.toISOString().split('T')[0];
    }

    setTimeout(() => {
      try {
        const newBooking = storageService.createBooking({
          userId: currentUser.id,
          userName: currentUser.name,
          userColor: currentUser.color,
          partName: currentUser.partName,
          checkInDate,
          checkOutDate,
          totalDays: daysRequested,
          status: 'confirmed',
          guestsCount,
          arrivalTime,
          notes: notes.trim() || undefined,
          cleaningBufferApplied: applyCleaningBuffer,
          cleaningBufferEndDate: bufferEndStr,
        });

        // Trigger native push notification
        pushService.triggerPush({
          title: '¡Reserva Confirmada en El Desayuno!',
          body: `Turno asegurado para ${currentUser.name} del ${checkInDate} al ${checkOutDate} (${daysRequested} días).`,
          type: 'booking_created',
          bookingId: newBooking.id,
        });

        setLoading(false);
        onBookingSuccess(newBooking);
        onClose();
      } catch (err: unknown) {
        setLoading(false);
        setError('Ocurrió un error al procesar la reserva. Intente nuevamente.');
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#FFFFFF] w-full max-w-xl border border-[#DED7C2] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-[#BFA270]" />
            <div>
              <h3
                className="text-base font-bold tracking-wide"
                style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
              >
                Nueva Reserva de Estadía
              </h3>
              <p className="text-[11px] text-[#C9D6CC]">
                {currentUser.name} · {currentUser.partName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#C9D6CC] hover:text-white p-1 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quota balance strip */}
        <div className="px-6 py-2.5 bg-[#FAF8F4] border-b border-[#EAE3D3] flex items-center justify-between text-xs">
          <span className="text-[#526657]">
            Su saldo disponible en 2026:{' '}
            <strong className="text-[#17341B] font-mono tabular-nums font-bold">
              {remainingQuota} días
            </strong>
          </span>
          {daysRequested > 0 && (
            <span
              className={`font-semibold font-mono tabular-nums ${
                daysRequested <= remainingQuota ? 'text-emerald-800' : 'text-red-700'
              }`}
            >
              Solicitando: {daysRequested} {daysRequested === 1 ? 'día' : 'días'}
            </span>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Dates row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1.5">
                Fecha de Check-in
              </label>
              <input
                type="date"
                value={checkInDate}
                min="2026-01-01"
                max="2026-12-31"
                onChange={(e) => {
                  setCheckInDate(e.target.value);
                  setError(null);
                }}
                required
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C0] text-[#19231A] text-sm focus:outline-none focus:border-[#1E3F20] transition-colors"
              />
              <span className="text-[10px] text-[#7A8E7E] block mt-1">Horario: desde 14:00 hs</span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1.5">
                Fecha de Check-out
              </label>
              <input
                type="date"
                value={checkOutDate}
                min={checkInDate || '2026-01-01'}
                max="2026-12-31"
                onChange={(e) => {
                  setCheckOutDate(e.target.value);
                  setError(null);
                }}
                required
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C0] text-[#19231A] text-sm focus:outline-none focus:border-[#1E3F20] transition-colors"
              />
              <span className="text-[10px] text-[#7A8E7E] block mt-1">Horario: hasta 11:00 hs</span>
            </div>
          </div>

          {/* Guests count & Arrival time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1.5">
                Cantidad de Huéspedes
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8E7E]" />
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={guestsCount}
                  onChange={(e) => setGuestsCount(parseInt(e.target.value) || 1)}
                  required
                  className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#DCD4C0] text-[#19231A] text-sm focus:outline-none focus:border-[#1E3F20]"
                />
              </div>
              <span className="text-[10px] text-[#7A8E7E] block mt-1">Máximo 12 pax pernoctando</span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1.5">
                Horario Estimado de Llegada
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8E7E]" />
                <input
                  type="text"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  placeholder="ej. 14:30 hs"
                  className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#DCD4C0] text-[#19231A] text-sm focus:outline-none focus:border-[#1E3F20]"
                />
              </div>
              <span className="text-[10px] text-[#7A8E7E] block mt-1">Para recepción por casero</span>
            </div>
          </div>

          {/* Automatic Cleaning Buffer option */}
          <div className="p-3.5 bg-[#F6F4EB] border border-[#E3DFC8] flex items-start gap-3 mt-2">
            <input
              type="checkbox"
              id="cleaningBuffer"
              checked={applyCleaningBuffer}
              onChange={(e) => setApplyCleaningBuffer(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#1B3B2B] cursor-pointer"
            />
            <label htmlFor="cleaningBuffer" className="text-xs text-[#2D4534] cursor-pointer">
              <span className="font-bold flex items-center gap-1.5 text-[#163323]">
                <Sparkles className="w-3.5 h-3.5 text-[#BFA270]" />
                Bloqueo operativo automático de 24 hs posteriores (Sanitización)
              </span>
              <span className="text-[11px] text-[#55695C] block mt-0.5 leading-relaxed">
                Inhabilita automáticamente el día siguiente a su check-out para el recambio integral de sábanas, toallas, limpieza profunda del quincho y acondicionamiento por parte del personal.
              </span>
            </label>
          </div>

          {/* Notes / Special requests */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1.5">
              Observaciones Adicionales (Opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ej. Viajamos con 2 niños, requerimos cuna funcional en suite principal y leña lista para asado de bienvenida."
              className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] text-[#19231A] text-xs focus:outline-none focus:border-[#1E3F20]"
            />
          </div>

          {/* Trust rule confirmation statement */}
          <div className="flex items-center gap-2 text-[11px] text-[#637568] pt-2 border-t border-[#EFEAE0]">
            <ShieldCheck className="w-4 h-4 text-[#8C7A53] shrink-0" />
            <span>
              Al confirmar, el turno impacta de inmediato en el calendario común y notifica al Fideicomiso.
            </span>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#EFEAE0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#637568] hover:text-[#19231A] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || (currentUser.role === 'owner' && daysRequested > remainingQuota)}
              className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] active:bg-[#0E2017] text-[#FAF8F5] text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {loading ? (
                <span>Confirmando reserva...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#BFA270]" />
                  <span>Confirmar Estadía ({daysRequested} días)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
