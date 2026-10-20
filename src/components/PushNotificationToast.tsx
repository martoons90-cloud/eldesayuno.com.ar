import React, { useState, useEffect, useMemo } from 'react';
import { Bell, CheckCircle2, AlertTriangle, X, ShieldAlert, Trash2 } from 'lucide-react';
import { pushService } from '../services/notificationService';
import { NotificationPush, User, isUserIntendente } from '../types';

interface ToastItem {
  id: string;
  title: string;
  body: string;
  type: string;
  timestamp: string;
  targetUserId?: string | null;
  bookingUserId?: string | null;
  bookingUserName?: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
}

export const PushNotificationToast: React.FC<{ currentUser?: User }> = ({ currentUser }) => {
  const [activeToasts, setActiveToasts] = useState<ToastItem[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    setPermission(pushService.getPermissionStatus());

    const handleCustomToast = (e: Event) => {
      const detail = (e as CustomEvent).detail as ToastItem;

      // Privacy check: If notification is targeted to a specific user (e.g. rejection),
      // ONLY show to that user or admins!
      if (detail.targetUserId && currentUser) {
        if (detail.targetUserId !== currentUser.id && !isUserIntendente(currentUser)) {
          return; // Suppress for other coproprietors
        }
      }

      // Personalize approval toast:
      let displayTitle = detail.title;
      let displayBody = detail.body;

      if (detail.type === 'booking_approved' && currentUser) {
        if (detail.bookingUserId && detail.bookingUserId === currentUser.id) {
          displayTitle = '¡Tus fechas fueron aprobadas!';
          displayBody = detail.checkInDate && detail.checkOutDate
            ? `Tu estadía del ${detail.checkInDate} al ${detail.checkOutDate} fue confirmada por el administrador.`
            : 'Tu estadía solicitada ha sido confirmada por la administración.';
        } else if (detail.bookingUserName) {
          displayTitle = `Fechas aprobadas: ${detail.bookingUserName}`;
          displayBody = detail.checkInDate && detail.checkOutDate
            ? `El administrador aprobó la estadía de ${detail.bookingUserName} (${detail.checkInDate} al ${detail.checkOutDate}).`
            : `El administrador confirmó la estadía de ${detail.bookingUserName}.`;
        }
      }

      const item: ToastItem = {
        ...detail,
        title: displayTitle,
        body: displayBody,
      };

      setActiveToasts((prev) => [item, ...prev].slice(0, 3));

      // Auto dismiss after 6 seconds
      setTimeout(() => {
        setActiveToasts((prev) => prev.filter((t) => t.id !== detail.id));
      }, 6000);
    };

    window.addEventListener('el-desayuno-push-toast', handleCustomToast);
    return () => {
      window.removeEventListener('el-desayuno-push-toast', handleCustomToast);
    };
  }, [currentUser]);

  const handleDismiss = (id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleRequestNative = async () => {
    const res = await pushService.requestPermission();
    setPermission(res);
    if (res === 'granted') {
      pushService.triggerPush({
        title: 'Notificaciones Push Activadas',
        body: 'Recibirá alertas instantáneas al confirmarse o modificarse reservas.',
        type: 'system',
      });
    }
  };

  return (
    <>
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3 sm:px-0">
        {/* Active Push Toasts */}
        {activeToasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-[#FFFFFF] border-l-4 border-[#17341B] border-y border-r border-[#E0D9C5] shadow-[0_12px_28px_-6px_rgba(20,38,24,0.18)] p-3.5 transition-all transform duration-300 translate-y-0"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 p-1 bg-[#F0EAE1] text-[#17341B]">
                  {toast.type === 'booking_cancelled' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                  ) : toast.type === 'block_added' ? (
                    <ShieldAlert className="w-4 h-4 text-emerald-800" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#17341B]" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#9E8252]">
                      El Desayuno Push
                    </span>
                    <span className="text-[9px] text-[#7A8E7E]">Ahora</span>
                  </div>
                  <h4 className="text-xs font-bold text-[#17341B] mt-0.5">{toast.title}</h4>
                  <p className="text-[11px] text-[#3D4F42] mt-1 leading-snug">{toast.body}</p>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(toast.id)}
                className="text-[#8B9C8E] hover:text-[#17341B] p-1 cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export const NotificationCenterDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationPush[];
  onMarkAllRead: () => void;
  onDeleteNotification: (notificationId: string) => void;
  currentUser?: User;
}> = ({ isOpen, onClose, notifications, onMarkAllRead, onDeleteNotification, currentUser }) => {
  const orderedNotifications = useMemo(
    () => [...notifications].sort((a, b) => {
      if (a.read !== b.read) return Number(a.read) - Number(b.read);
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }),
    [notifications]
  );

  useEffect(() => {
    if (isOpen && notifications.some((notification) => !notification.read)) {
      onMarkAllRead();
    }
  }, [isOpen, notifications, onMarkAllRead]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#FFFFFF] w-full max-w-md h-full flex flex-col shadow-2xl border-l border-[#E2DCcb]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E8E2D2] bg-[#FAF8F5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-[#1B3B2B]" />
            <h3
              className="text-base font-bold text-[#1B3B2B] tracking-wide"
              style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
            >
              Centro de Notificaciones Push
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#637568] hover:text-[#19231A] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action bar */}
        <div className="px-5 py-2.5 bg-[#F6F2E9] border-b border-[#E8E2D2] flex items-center justify-between text-xs">
          <span className="text-[#637568] font-medium">
            Historial de eventos y confirmaciones
          </span>
          <span className="text-[11px] font-semibold text-[#1B3B2B]">
            Se marcan como leídas al abrir
          </span>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#EFEAE0]">
          {orderedNotifications.length === 0 ? (
            <div className="p-8 text-center text-[#7A8E7E]">
              <Bell className="w-8 h-8 mx-auto text-[#BFA270] opacity-40 mb-2" />
              <p className="text-xs">No hay notificaciones registradas.</p>
            </div>
          ) : (
            orderedNotifications.map((n) => {
              const isMyBooking = currentUser && n.bookingUserId && n.bookingUserId === currentUser.id;

              let displayTitle = n.title;
              let displayBody = n.body;
              let typeLabel = 'Sistema';
              let badgeClass = 'bg-[#FAF8F5] text-[#55695B] border border-[#DDD5BF]';

              if (n.type === 'booking_approved') {
                if (isMyBooking) {
                  displayTitle = '¡Tus fechas fueron aprobadas!';
                  displayBody = n.checkInDate && n.checkOutDate
                    ? `Tu estadía del ${n.checkInDate} al ${n.checkOutDate} (${n.totalDays || ''} noches) ha sido confirmada por la administración.`
                    : n.body;
                  typeLabel = 'Tus Fechas Aprobadas';
                  badgeClass = 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold';
                } else {
                  displayTitle = n.bookingUserName ? `Fechas aprobadas: ${n.bookingUserName}` : n.title;
                  displayBody = n.bookingUserName && n.checkInDate
                    ? `El administrador aprobó la estadía de ${n.bookingUserName}${n.bookingPartName ? ` (${n.bookingPartName})` : ''} del ${n.checkInDate} al ${n.checkOutDate} (${n.totalDays || ''} noches).`
                    : n.body;
                  typeLabel = 'Estadía Confirmada';
                  badgeClass = 'bg-[#E8EFE9] text-[#1B3B2B] font-semibold';
                }
              } else if (n.type === 'booking_rejected') {
                displayTitle = 'Solicitud de Reserva Desestimada';
                typeLabel = 'Privado · Solicitante';
                badgeClass = 'bg-amber-100 text-amber-950 border border-amber-300 font-bold';
              } else if (n.type === 'booking_created') {
                typeLabel = 'Nueva Solicitud';
                badgeClass = 'bg-amber-50 text-amber-900 border border-amber-200';
              } else if (n.type === 'booking_cancelled') {
                typeLabel = 'Cancelación';
                badgeClass = 'bg-red-50 text-red-800 border border-red-200';
              } else if (n.type === 'block_added') {
                typeLabel = 'Mantenimiento';
                badgeClass = 'bg-amber-100 text-amber-950 border border-amber-200';
              } else if (n.type === 'account_movement') {
                typeLabel = 'Tu cuenta';
                badgeClass = 'bg-sky-50 text-sky-900 border border-sky-200';
              }

              return (
                <div
                  key={n.id}
                  className={`p-4 transition-colors ${
                    !n.read ? 'bg-amber-50/70 border-l-4 border-l-[#D4A72C]' : 'bg-[#FFFFFF] hover:bg-[#FAF8F5]'
                  } ${isMyBooking && n.type === 'booking_approved' ? 'border-l-4 border-l-emerald-600' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {!n.read && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0 animate-pulse ring-4 ring-amber-200/70" />
                      )}
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 ${badgeClass}`}>
                        {typeLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-[#7A8E7E]">
                        {new Date(n.timestamp).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('¿Eliminar esta notificación?')) onDeleteNotification(n.id);
                        }}
                        className="p-1 text-[#9A7B70] hover:text-red-700 hover:bg-red-50 cursor-pointer"
                        title="Eliminar notificación"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <h4 className="text-xs font-semibold text-[#19231A] mt-1.5">{displayTitle}</h4>
                  <p className="text-xs text-[#4F6254] mt-0.5 leading-relaxed">{displayBody}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E8E2D2] bg-[#FAF8F5] text-center text-[11px] text-[#6E8072]">
          Auditoría de turnos y sincronización en tiempo real
        </div>
      </div>
    </div>
  );
};
