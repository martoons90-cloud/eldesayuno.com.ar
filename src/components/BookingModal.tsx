import React, { useState, useEffect, useMemo } from 'react';
import { User, Booking, DateBlock, isUserIntendente } from '../types';
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
  users: User[];
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
  users,
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cloudBookings, setCloudBookings] = useState<Booking[]>(bookings);
  const [reservationForUserId, setReservationForUserId] = useState(currentUser.id);
  const canCreateForOthers = isUserIntendente(currentUser);
  const eligibleReservationUsers = useMemo(
    () => users.filter((user) => user.active !== false && user.role !== 'intendente'),
    [users]
  );
  const reservationOwner = (canCreateForOthers
    ? eligibleReservationUsers.find((user) => user.id === reservationForUserId)
    : currentUser) || currentUser;

  useEffect(() => {
    setCloudBookings(bookings);
  }, [bookings]);

  useEffect(() => {
    if (initialStartDate) setCheckInDate(initialStartDate);
    if (initialEndDate) setCheckOutDate(initialEndDate);
    if (isOpen) {
      if (!canCreateForOthers) {
        setReservationForUserId(currentUser.id);
      } else {
        setReservationForUserId((currentSelection) =>
          eligibleReservationUsers.some((user) => user.id === currentSelection)
            ? currentSelection
            : eligibleReservationUsers[0]?.id || currentUser.id
        );
      }
      // Re-hydrate from cloud to guarantee fresh reservations from all devices
      storageService.hydrateFromAppStateAsync();
      fetch('/api/bookings')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.bookings)) {
            setCloudBookings(data.bookings);
          }
        })
        .catch(() => {});
    }
  }, [initialStartDate, initialEndDate, isOpen, canCreateForOthers, currentUser.id, eligibleReservationUsers]);

  if (!isOpen) return null;

  // Calculate days requested
  const calculateDays = (start: string, end: string) => {
    if (!start || !end || end < start) return 0;
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const daysRequested = calculateDays(checkInDate, checkOutDate);

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

    // Overlap validation with active bookings from cloud and memory
    const requestedStart = checkInDate;
    const requestedEnd = checkOutDate;
    const effectiveBookings = cloudBookings.length >= bookings.length ? cloudBookings : bookings;

    // Check with bookings
    for (const b of effectiveBookings) {
      if (b.status === 'cancelled') continue;
      const bEffectiveEnd = b.checkOutDate;

      const overlap = !(requestedEnd < b.checkInDate || requestedStart > bEffectiveEnd);
      if (overlap) {
        return `Conflicto de fechas en la nube: el período se solapa con la reserva de ${b.userName} (${b.checkInDate} al ${b.checkOutDate}).`;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const valError = validateBooking();
    if (valError) {
      setError(valError);
      return;
    }

    setLoading(true);

    try {
      // Create and lock booking authoritatively on cloud server with pending status
      const newBooking = await storageService.createBookingAsync({
        userId: reservationOwner.id,
        userName: reservationOwner.name,
        userColor: reservationOwner.color,
        partName: reservationOwner.partName,
        checkInDate,
        checkOutDate,
        totalDays: daysRequested,
        status: canCreateForOthers ? 'confirmed' : 'pending',
        guestsCount,
        arrivalTime,
        notes: notes.trim() || undefined,
        cleaningBufferApplied: false,
      });

      // Trigger native push notification
      pushService.triggerPush({
        title: 'Solicitud de Reserva Registrada',
        body: `${canCreateForOthers ? 'Reserva confirmada' : 'Solicitud registrada'} para ${reservationOwner.name} del ${checkInDate} al ${checkOutDate} (${daysRequested} días).${canCreateForOthers ? '' : ' Pendiente de aprobación del administrador.'}`,
        type: 'booking_created',
        bookingId: newBooking.id,
      });

      setLoading(false);
      onBookingSuccess(newBooking);
      onClose();
    } catch (err: unknown) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : 'Ocurrió un error al procesar la reserva en la nube.';
      setError(msg);
    }
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
                {canCreateForOthers ? 'Crear una reserva para un copropietario' : `${currentUser.name} · ${currentUser.partName}`}
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

        {/* Stay summary strip */}
        <div className="px-6 py-2.5 bg-[#FAF8F4] border-b border-[#EAE3D3] flex items-center justify-between text-xs">
          <span className="text-[#526657]">
            Estadía para: <strong className="text-[#17341B] font-semibold">{reservationOwner.name}</strong> ({reservationOwner.partName})
          </span>
          {daysRequested > 0 && (
            <span className="font-semibold font-mono tabular-nums text-emerald-800">
              Duración: {daysRequested} {daysRequested === 1 ? 'noche' : 'noches'}
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
          {canCreateForOthers && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1.5">Reservar para</label>
              <select
                value={reservationForUserId}
                onChange={(e) => setReservationForUserId(e.target.value)}
                className="w-full px-3 py-2 bg-[#F4F8FF] border border-blue-200 text-[#19231A] text-sm font-semibold focus:outline-none focus:border-[#1E3F20]"
              >
                {eligibleReservationUsers.map((user) => (
                  <option key={user.id} value={user.id}>{user.name} · {user.partName}</option>
                ))}
              </select>
              <span className="text-[10px] text-[#637568] block mt-1">Como Intendente, la reserva queda confirmada directamente a nombre de la persona elegida.</span>
            </div>
          )}
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
              {canCreateForOthers
                ? <>La reserva quedará registrada como <strong>Confirmada</strong> y bloqueará las fechas en el calendario.</>
                : <>La solicitud quedará registrada en estado <strong>Pendiente</strong> y bloqueará las fechas en el calendario hasta que sea aprobada por el administrador.</>}
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
              disabled={loading || daysRequested <= 0}
              className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] active:bg-[#0E2017] text-[#FAF8F5] text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {loading ? (
                <span>Enviando solicitud...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#BFA270]" />
                  <span>{canCreateForOthers ? 'Confirmar Reserva' : 'Enviar Solicitud'} ({daysRequested} {daysRequested === 1 ? 'noche' : 'noches'})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
