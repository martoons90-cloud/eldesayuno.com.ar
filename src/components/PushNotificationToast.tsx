import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { pushService } from '../services/notificationService';
import { storageService } from '../services/storageService';
import { NotificationPush } from '../types';

interface ToastItem {
  id: string;
  title: string;
  body: string;
  type: string;
  timestamp: string;
}

export const PushNotificationToast: React.FC = () => {
  const [activeToasts, setActiveToasts] = useState<ToastItem[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    setPermission(pushService.getPermissionStatus());

    const handleCustomToast = (e: Event) => {
      const detail = (e as CustomEvent).detail as ToastItem;
      setActiveToasts((prev) => [detail, ...prev].slice(0, 3));

      // Auto dismiss after 6 seconds
      setTimeout(() => {
        setActiveToasts((prev) => prev.filter((t) => t.id !== detail.id));
      }, 6000);
    };

    window.addEventListener('el-desayuno-push-toast', handleCustomToast);
    return () => {
      window.removeEventListener('el-desayuno-push-toast', handleCustomToast);
    };
  }, []);

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
}> = ({ isOpen, onClose, notifications, onMarkAllRead }) => {
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
          <button
            onClick={onMarkAllRead}
            className="text-[11px] font-semibold text-[#1B3B2B] hover:underline cursor-pointer"
          >
            Marcar todas como leídas
          </button>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#EFEAE0]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-[#7A8E7E]">
              <Bell className="w-8 h-8 mx-auto text-[#BFA270] opacity-40 mb-2" />
              <p className="text-xs">No hay notificaciones registradas.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => storageService.markNotificationAsRead(n.id)}
                className={`p-4 transition-colors cursor-pointer ${
                  !n.read ? 'bg-[#F9F7F2]' : 'bg-[#FFFFFF] hover:bg-[#FAF8F5]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-[#1B3B2B] shrink-0" />
                    )}
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#9E8252]">
                      {n.type === 'booking_created'
                        ? 'Reserva'
                        : n.type === 'booking_cancelled'
                        ? 'Cancelación'
                        : n.type === 'block_added'
                        ? 'Mantenimiento'
                        : 'Sistema'}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#7A8E7E]">
                    {new Date(n.timestamp).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-[#19231A] mt-1">{n.title}</h4>
                <p className="text-xs text-[#4F6254] mt-0.5 leading-relaxed">{n.body}</p>
              </div>
            ))
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
