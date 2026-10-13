import React, { useState } from 'react';
import { Booking, User, TrustSettings } from '../types';
import { storageService } from '../services/storageService';
import { pushService } from '../services/notificationService';
import {
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  FileText,
  Sparkles,
  Info,
} from 'lucide-react';

interface MyBookingsViewProps {
  currentUser: User;
  bookings: Booking[];
  settings: TrustSettings;
  onOpenNewBooking: () => void;
}

export const MyBookingsView: React.FC<MyBookingsViewProps> = ({
  currentUser,
  bookings,
  settings,
  onOpenNewBooking,
}) => {
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationError, setCancellationError] = useState<string | null>(null);

  // Filter only current user's bookings
  const myBookings = bookings.filter((b) => b.userId === currentUser.id);

  const todayStr = '2026-10-05'; // current app simulation date

  const pendingBookings = myBookings
    .filter((b) => b.status === 'pending')
    .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));

  const upcomingBookings = myBookings
    .filter((b) => b.status === 'confirmed' && b.checkOutDate >= todayStr)
    .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));

  const pastBookings = myBookings
    .filter((b) => b.status === 'completed' || (b.status === 'confirmed' && b.checkOutDate < todayStr))
    .sort((a, b) => b.checkInDate.localeCompare(a.checkInDate));

  const cancelledBookings = myBookings
    .filter((b) => b.status === 'cancelled')
    .sort((a, b) => (b.cancelledAt || '').localeCompare(a.cancelledAt || ''));

  // Cancellation allowance check (min days ahead)
  const canCancelBooking = (booking: Booking): { allowed: boolean; daysRemaining: number } => {
    const checkIn = new Date(booking.checkInDate + 'T00:00:00');
    const today = new Date(todayStr + 'T00:00:00');
    const diffDays = Math.round((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return {
      allowed: diffDays >= settings.cancellationMinDays,
      daysRemaining: diffDays,
    };
  };

  const handleConfirmCancel = () => {
    if (!cancellingBookingId) return;
    if (!cancellationReason.trim()) {
      setCancellationError('Por favor indique el motivo de la cancelación.');
      return;
    }

    const booking = myBookings.find((b) => b.id === cancellingBookingId);
    if (!booking) return;

    storageService.cancelBooking(cancellingBookingId, cancellationReason, currentUser.name);

    pushService.triggerPush({
      title: 'Reserva Cancelada con Éxito',
      body: `Se liberaron ${booking.totalDays} días para el período ${booking.checkInDate} al ${booking.checkOutDate}. Cupo restablecido.`,
      type: 'booking_cancelled',
    });

    setCancellingBookingId(null);
    setCancellationReason('');
    setCancellationError(null);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#8C7A53] block">
            Administración de Turnos Propios
          </span>
          <h2
            className="text-2xl font-bold text-[#163323]"
            style={{ fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif" }}
          >
            Mis Estadías en El Desayuno
          </h2>
          <p className="text-xs text-[#526657] mt-1">
            Historial de reservas de {currentUser.name} ({currentUser.partName}).
          </p>
        </div>

        <button
          onClick={onOpenNewBooking}
          className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer self-start sm:self-auto"
        >
          + Solicitar Nueva Reserva
        </button>
      </div>

      {/* Cancellation Policy Banner */}
      <div className="p-4 bg-[#F8F5EC] border-l-4 border-[#BFA270] border-y border-r border-[#E5DEC9] text-xs text-[#4F6254] flex items-start gap-3">
        <Info className="w-4 h-4 text-[#8C7A53] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-[#1B3B2B] block">
            Política de Cancelación y Liberación de Fechas
          </span>
          Las cancelaciones realizadas con al menos {settings.cancellationMinDays} días de
          anticipación permiten liberar inmediatamente las fechas en el calendario común para que otro copropietario pueda aprovecharlas.
        </div>
      </div>

      {/* 0. Solicitudes Pendientes de Aprobación */}
      {pendingBookings.length > 0 && (
        <div className="bg-[#FFFFFF] border border-amber-300 p-6 shadow-xs">
          <div className="pb-4 mb-4 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                <span>Solicitudes Pendientes de Aprobación ({pendingBookings.length})</span>
              </h3>
            </div>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 uppercase tracking-wider">
              En Revisión
            </span>
          </div>

          <p className="text-xs text-[#526657] mb-4">
            Estas fechas ya se encuentran reservadas para usted en el calendario común y no pueden ser tomadas por otro copropietario. Están a la espera de confirmación formal por parte del administrador.
          </p>

          <div className="space-y-4">
            {pendingBookings.map((b) => (
              <div
                key={b.id}
                className="p-5 bg-amber-50/40 border border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono tabular-nums text-xs px-2 py-0.5 bg-amber-100 text-amber-950 font-bold border border-amber-200">
                      {b.totalDays} noches
                    </span>
                    <span className="text-[#7A8E7E]">·</span>
                    <span className="text-[#637568]">
                      Check-in: {b.checkInDate} (14:00 hs)
                    </span>
                    <span className="text-[#7A8E7E]">·</span>
                    <span className="text-[#637568]">
                      Check-out: {b.checkOutDate} (11:00 hs)
                    </span>
                    <span className="text-[#7A8E7E]">·</span>
                    <span className="text-amber-800 font-semibold flex items-center gap-1 text-[11px]">
                      ⏳ Esperando aprobación
                    </span>
                  </div>

                  <div className="text-lg font-bold text-[#163323] flex items-center gap-2">
                    <span>{b.checkInDate}</span>
                    <span className="text-[#BFA270]">→</span>
                    <span>{b.checkOutDate}</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[#526657]">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#7A8E7E]" />
                      {b.guestsCount} personas previstas
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#7A8E7E]" />
                      Arribo aprox: {b.arrivalTime}
                    </span>
                  </div>

                  {b.notes && (
                    <p className="text-xs text-[#4F6254] bg-white p-2.5 border border-[#ECE5D4] italic">
                      “{b.notes}”
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-amber-200">
                  <button
                    onClick={() => {
                      setCancellingBookingId(b.id);
                      setCancellationReason('');
                      setCancellationError(null);
                    }}
                    className="px-3.5 py-2 bg-white hover:bg-red-50 border border-red-300 text-red-700 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Desistir Solicitud</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1. Próximas Estadías Confirmadas */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs">
        <div className="pb-4 mb-4 border-b border-[#EFEAE0] flex items-center justify-between">
          <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>Próximas Estadías Confirmadas ({upcomingBookings.length})</span>
          </h3>
        </div>

        {upcomingBookings.length === 0 ? (
          <div className="py-8 text-center text-[#7A8E7E]">
            <Calendar className="w-8 h-8 mx-auto text-[#C5BAA0] mb-2" />
            <p className="text-sm font-semibold text-[#2D4534]">No tiene estadías próximas reservadas.</p>
            <p className="text-xs text-[#7A8E7E] mt-1">
              Revise el calendario para seleccionar los días que desee disfrutar en el campo.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingBookings.map((b) => {
              const cancelStatus = canCancelBooking(b);
              return (
                <div
                  key={b.id}
                  className="p-5 bg-[#FAF8F5] border border-[#E4DEC9] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono tabular-nums text-xs px-2 py-0.5 bg-[#E8EFE9] text-[#1B3B2B] font-bold">
                        {b.totalDays} noches
                      </span>
                      <span className="text-[#7A8E7E]">·</span>
                      <span className="text-[#637568]">
                        Check-in: {b.checkInDate} (14:00 hs)
                      </span>
                      <span className="text-[#7A8E7E]">·</span>
                      <span className="text-[#637568]">
                        Check-out: {b.checkOutDate} (11:00 hs)
                      </span>
                    </div>

                    <div className="text-lg font-bold text-[#163323] flex items-center gap-2">
                      <span>{b.checkInDate}</span>
                      <span className="text-[#BFA270]">→</span>
                      <span>{b.checkOutDate}</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[#526657]">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[#7A8E7E]" />
                        {b.guestsCount} personas previstas
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#7A8E7E]" />
                        Arribo aprox: {b.arrivalTime}
                      </span>
                    </div>

                    {b.notes && (
                      <p className="text-xs text-[#4F6254] bg-white p-2.5 border border-[#ECE5D4] italic">
                        “{b.notes}”
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-[#EAE3D3]">
                    {cancelStatus.allowed ? (
                      <button
                        onClick={() => {
                          setCancellingBookingId(b.id);
                          setCancellationReason('');
                          setCancellationError(null);
                        }}
                        className="px-3.5 py-2 bg-white hover:bg-red-50 border border-red-300 text-red-700 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancelar Reserva</span>
                      </button>
                    ) : (
                      <div className="text-right">
                        <span className="text-[11px] text-[#A65B32] font-semibold block">
                          Fuera de plazo para cancelación automática
                        </span>
                        <span className="text-[10px] text-[#7A8E7E]">
                          Faltan menos de {settings.cancellationMinDays} días. Contacte al Administrador.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Historial de Estadías Pasadas */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs">
        <div className="pb-4 mb-4 border-b border-[#EFEAE0]">
          <h3 className="text-base font-bold text-[#163323]">
            Historial de Estadías Cumplidas ({pastBookings.length})
          </h3>
        </div>

        {pastBookings.length === 0 ? (
          <p className="text-xs text-[#7A8E7E] italic">
            No registra estadías históricas finalizadas en la temporada en curso.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8F5EE] border-b border-[#E3DFC8] text-[#55695B] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Período</th>
                  <th className="py-2.5 px-3">Días Consumidos</th>
                  <th className="py-2.5 px-3">Huéspedes</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0]">
                {pastBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-[#FAF8F5]">
                    <td className="py-3 px-3 font-semibold text-[#163323]">
                      {b.checkInDate} al {b.checkOutDate}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-right sm:text-left font-bold text-[#19231A]">
                      {b.totalDays} días
                    </td>
                    <td className="py-3 px-3 text-[#4F6254]">{b.guestsCount} pax</td>
                    <td className="py-3 px-3">
                      <span className="text-emerald-800 font-semibold text-[11px]">
                        Cumplida
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#637568] max-w-xs truncate">
                      {b.notes || 'Sin observaciones'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Turnos Cancelados si existen */}
      {cancelledBookings.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs">
          <div className="pb-3 mb-3 border-b border-[#EFEAE0]">
            <h3 className="text-sm font-bold text-[#7A8E7E]">
              Turnos Cancelados ({cancelledBookings.length})
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            {cancelledBookings.map((b) => (
              <div
                key={b.id}
                className="p-3 bg-[#FAF8F5] border border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between text-[#7A8E7E] gap-2"
              >
                <div>
                  <span className="line-through font-mono font-medium">
                    {b.checkInDate} al {b.checkOutDate}
                  </span>{' '}
                  ({b.totalDays} días devueltos a cupo)
                  {b.cancellationReason && (
                    <span className="block text-[11px] text-[#8C5A48] mt-0.5">
                      Motivo: {b.cancellationReason}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[#A68853]">
                  Cancelado por {b.cancelledBy || 'Usuario'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Dialog */}
      {cancellingBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-md border border-[#E3DFC8] shadow-2xl p-6">
            <div className="flex items-center gap-2.5 text-red-800 pb-3 border-b border-[#EFEAE0]">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="text-base font-bold">Confirmar Cancelación de Reserva</h3>
            </div>

            <p className="text-xs text-[#4F6254] mt-3 leading-relaxed">
              ¿Está seguro de que desea cancelar esta estadía? Las fechas volverán a quedar libres en
              el calendario para los demás copropietarios y los días se reintegrarán a su saldo anual.
            </p>

            {cancellationError && (
              <p className="mt-2 text-xs text-red-700 font-semibold">{cancellationError}</p>
            )}

            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                Motivo de la Cancelación
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Ej. Cambio de planes familiares / reprogramación para noviembre."
                rows={2}
                required
                className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none focus:border-[#1E3F20]"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-[#EFEAE0]">
              <button
                type="button"
                onClick={() => setCancellingBookingId(null)}
                className="px-3.5 py-2 text-xs font-semibold text-[#637568] hover:text-[#19231A] cursor-pointer"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
