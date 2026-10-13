import React from 'react';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';

export interface CustomDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'confirm' | 'alert' | 'success' | 'warning';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const CustomDialogModal: React.FC<CustomDialogProps> = ({
  isOpen,
  title,
  message,
  type = 'confirm',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const isConfirm = type === 'confirm' || type === 'warning';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#FAF8F5] border border-[#DDD5BF] shadow-2xl max-w-md w-full overflow-hidden rounded-lg animate-scale-up">
        {/* Header */}
        <div className="bg-[#1B3B2B] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            {type === 'warning' || type === 'confirm' ? (
              <div className="p-2 bg-amber-500/20 rounded-full text-amber-300">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : type === 'success' ? (
              <div className="p-2 bg-emerald-500/20 rounded-full text-emerald-300">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 bg-blue-500/20 rounded-full text-blue-300">
                <Info className="w-5 h-5" />
              </div>
            )}
            <h3 className="font-serif text-lg font-semibold tracking-wide">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-neutral-700 text-sm leading-relaxed whitespace-pre-line font-sans">
            {message}
          </p>
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 bg-[#F2EDE1] border-t border-[#DDD5BF] flex items-center justify-end gap-3">
          {isConfirm && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-700 border border-[#DDD5BF] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer rounded"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer rounded shadow-sm ${
              type === 'warning' || (type === 'confirm' && (confirmText.toLowerCase().includes('eliminar') || confirmText.toLowerCase().includes('borrar')))
                ? 'bg-red-700 hover:bg-red-800'
                : 'bg-[#1B3B2B] hover:bg-[#254A36]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
